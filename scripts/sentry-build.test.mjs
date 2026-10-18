import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  assertNoPublicSourceMaps,
  cleanupGeneratedSourceMaps,
  createSourceMapArtifactManifest,
  createPrebuiltPreviewCommand,
  createUploadEnvironment,
  createBrowserBuildEnvironment,
  createBuildPlan,
  deriveCleanGitIdentity,
  deployPreparedPreviewArtifact,
  generateCustomDeploymentId,
  inventorySourceMaps,
  packageVercelBuildOutput,
  runEnabledBuildTransaction,
  resolveVercelProjectLink,
  scanVercelBuildOutput,
  snapshotSourceMapArtifacts,
  validateSentryPrivacyControls,
  verifySentryPrivacyControls,
  validateCustomDeploymentId,
} from './sentry-build-lib.mjs';

const execFile = promisify(execFileCallback);

const validEnabledEnvironment = {
  TRACKORA_SENTRY_ENABLED: 'true',
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  TRACKORA_SENTRY_BUILD_MODE: 'trusted-preview',
  TRACKORA_SENTRY_PREBUILT: '1',
  TRACKORA_SENTRY_DSN: 'https://public@example.ingest.sentry.io/123',
  TRACKORA_SENTRY_SAMPLE_RATE: '1',
  SENTRY_ORG: 'trackora-o4',
  SENTRY_PROJECT: 'trackora-ui',
  SENTRY_AUTH_TOKEN: 'test-token-never-log',
};

const identity = {
  sha: 'a'.repeat(40),
  release: `trackora-ui@${'a'.repeat(40)}`,
  dist: 'trk-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
};

const geoSelectors = [
  '$user.geo.city',
  '$user.geo.country_code',
  '$user.geo.region',
  '$user.geo.subdivision',
  '$user.geo.subregion',
];

const geoRemovalConfig = JSON.stringify({
  rules: {
    removeGeo: { type: 'anything', redaction: { method: 'remove' } },
  },
  applications: Object.fromEntries(geoSelectors.map((selector) => [selector, ['removeGeo']])),
});

const privacyProject = (relayPiiConfig = geoRemovalConfig) => ({
  slug: 'trackora-ui',
  scrubIPAddresses: true,
  relayPiiConfig,
});

test('Sentry privacy controls accept all five exact $-prefixed remove-anything selectors', () => {
  assert.doesNotThrow(() => validateSentryPrivacyControls(privacyProject()));
});

test('Sentry privacy controls fail closed when a required selector is missing', () => {
  for (const missingSelector of geoSelectors) {
    const config = JSON.parse(geoRemovalConfig);
    delete config.applications[missingSelector];
    assert.throws(
      () => validateSentryPrivacyControls(privacyProject(JSON.stringify(config))),
      /privacy preflight failed/,
    );
  }
});

test('Sentry privacy controls reject incorrect redaction methods and data types', () => {
  for (const rule of [
    { type: 'anything', redaction: { method: 'mask' } },
    { type: 'pattern', redaction: { method: 'remove' } },
  ]) {
    const config = JSON.parse(geoRemovalConfig);
    config.rules.removeGeo = rule;
    assert.throws(
      () => validateSentryPrivacyControls(privacyProject(JSON.stringify(config))),
      /privacy preflight failed/,
    );
  }
});

test('Sentry privacy controls reject unexpected or malformed rule structures', () => {
  const malformedConfigs = [
    '{',
    JSON.stringify({ rules: [], applications: {} }),
    JSON.stringify({ rules: {}, applications: [] }),
    JSON.stringify({
      rules: {},
      applications: Object.fromEntries(geoSelectors.map((s) => [s, []])),
    }),
    JSON.stringify({
      rules: { removeGeo: null },
      applications: Object.fromEntries(geoSelectors.map((s) => [s, ['removeGeo']])),
    }),
    JSON.stringify({
      rules: { removeGeo: { type: 'anything', redaction: null } },
      applications: Object.fromEntries(geoSelectors.map((s) => [s, ['removeGeo']])),
    }),
    JSON.stringify({
      rules: { removeGeo: { type: 'anything', redaction: { method: 'remove' } } },
      applications: Object.fromEntries(geoSelectors.map((s) => [s, 'removeGeo'])),
    }),
    JSON.stringify({
      rules: { removeGeo: { type: 'anything', redaction: { method: 'remove' } } },
      applications: Object.fromEntries(geoSelectors.map((s) => [s, ['missingRule']])),
    }),
  ];
  for (const relayPiiConfig of malformedConfigs) {
    assert.throws(
      () => validateSentryPrivacyControls(privacyProject(relayPiiConfig)),
      /privacy preflight failed/,
    );
  }
});

test('Sentry privacy controls require the expected project and IP scrubbing', () => {
  for (const project of [
    { slug: 'trackora-ui', scrubIPAddresses: false, relayPiiConfig: geoRemovalConfig },
    { slug: 'trackora-ui', scrubIPAddresses: true, relayPiiConfig: null },
    { slug: 'another-project', scrubIPAddresses: true, relayPiiConfig: geoRemovalConfig },
  ]) {
    assert.throws(() => validateSentryPrivacyControls(project), /privacy preflight failed/);
  }
});

test('Sentry privacy preflight is read-only and fails closed on unavailable or malformed responses', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        slug: 'trackora-ui',
        scrubIPAddresses: true,
        relayPiiConfig: geoRemovalConfig,
      }),
    };
  };
  await verifySentryPrivacyControls({ authToken: 'private-test-token', fetchImpl });
  assert.equal(request.url, 'https://sentry.io/api/0/projects/trackora-o4/trackora-ui/');
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.headers.Authorization, 'Bearer private-test-token');
  await assert.rejects(
    verifySentryPrivacyControls({
      authToken: 'private-test-token',
      fetchImpl: async () => ({ ok: false, status: 403 }),
    }),
    /privacy preflight failed/,
  );
});

test('ordinary and explicitly disabled builds need no monitoring credentials', () => {
  assert.deepEqual(createBuildPlan({}, identity), { state: 'disabled' });
  assert.deepEqual(createBuildPlan({ VERCEL: '1', TRACKORA_SENTRY_ENABLED: 'false' }), {
    state: 'disabled',
  });
});

for (const key of [
  'VERCEL_ENV',
  'TRACKORA_SENTRY_BUILD_MODE',
  'TRACKORA_SENTRY_PREBUILT',
  'TRACKORA_SENTRY_DSN',
  'TRACKORA_SENTRY_SAMPLE_RATE',
  'SENTRY_ORG',
  'SENTRY_PROJECT',
  'SENTRY_AUTH_TOKEN',
]) {
  test(`enabled build fails closed without ${key}`, () => {
    const environment = { ...validEnabledEnvironment };
    delete environment[key];
    assert.throws(() => createBuildPlan(environment, identity), /Sentry build preflight failed/);
  });
}

for (const [key, value] of [
  ['VERCEL_ENV', 'development'],
  ['TRACKORA_SENTRY_BUILD_MODE', 'untrusted-local'],
  ['TRACKORA_SENTRY_DSN', 'http://example.com/1'],
  ['TRACKORA_SENTRY_SAMPLE_RATE', 'NaN'],
  ['SENTRY_ORG', '../owner'],
  ['SENTRY_PROJECT', ''],
]) {
  test(`enabled build rejects malformed ${key}`, () => {
    assert.throws(
      () => createBuildPlan({ ...validEnabledEnvironment, [key]: value }, identity),
      /Sentry build preflight failed/,
    );
  });
}

test('release and dist are derived once and shared by browser and upload', () => {
  const plan = createBuildPlan(validEnabledEnvironment, identity);
  assert.equal(plan.state, 'enabled-pending');
  assert.equal(plan.release, identity.release);
  assert.equal(plan.dist, identity.dist);
  assert.ok(plan.browserDefinitions.includes(`TRACKORA_SENTRY_RELEASE=\"${plan.release}\"`));
  assert.ok(plan.uploadArguments.includes(plan.release));
  assert.ok(plan.uploadArguments.includes(plan.dist));
});

test('protected Production uses the same deterministic identity contract without deployment', () => {
  const plan = createBuildPlan(
    {
      ...validEnabledEnvironment,
      VERCEL: '1',
      VERCEL_ENV: 'production',
      TRACKORA_SENTRY_BUILD_MODE: 'protected-production',
      TRACKORA_SENTRY_PREBUILT: undefined,
      TRACKORA_SENTRY_SAMPLE_RATE: '0.25',
    },
    identity,
  );
  assert.equal(plan.release, identity.release);
  assert.equal(plan.dist, identity.dist);
  assert.ok(plan.browserDefinitions.includes(`TRACKORA_SENTRY_DIST=\"${identity.dist}\"`));
  assert.equal(plan.uploadArguments.at(plan.uploadArguments.indexOf('--dist') + 1), identity.dist);
});

test('the upload token is absent from the Angular browser-build environment', () => {
  const browserEnvironment = createBrowserBuildEnvironment(validEnabledEnvironment);
  assert.equal(browserEnvironment.SENTRY_AUTH_TOKEN, undefined);
  assert.equal(browserEnvironment.TRACKORA_SENTRY_DSN, validEnabledEnvironment.TRACKORA_SENTRY_DSN);
});

test('the upload token is present only in the dedicated upload subprocess environment', () => {
  const browser = createBrowserBuildEnvironment(validEnabledEnvironment);
  const upload = createUploadEnvironment(validEnabledEnvironment);
  assert.equal(browser.SENTRY_AUTH_TOKEN, undefined);
  assert.equal(upload.SENTRY_AUTH_TOKEN, validEnabledEnvironment.SENTRY_AUTH_TOKEN);
  assert.ok(
    !JSON.stringify(createPrebuiltPreviewCommand()).includes(
      validEnabledEnvironment.SENTRY_AUTH_TOKEN,
    ),
  );
});

test('no user-controlled input creates a bypass or third successful state', () => {
  for (const value of ['true', 'https://github.com/owner/repo/issues/1', 'approved', 'owner']) {
    const plan = createBuildPlan(
      {
        ...validEnabledEnvironment,
        SENTRY_BYPASS: value,
        APPROVAL_URL: value,
      },
      identity,
    );
    assert.equal(plan.state, 'enabled-pending');
    assert.equal('bypass' in plan, false);
  }
});

test('generated maps are cleaned without touching the pre-build inventory', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-build-'));
  await mkdir(path.join(root, 'browser'));
  const oldMap = path.join(root, 'browser', 'existing.js.map');
  const generatedMap = path.join(root, 'browser', 'main.js.map');
  await writeFile(oldMap, '{}');
  const before = await inventorySourceMaps(root);
  await writeFile(generatedMap, '{}');
  await cleanupGeneratedSourceMaps(root, before);
  assert.equal(await readFile(oldMap, 'utf8'), '{}');
  await assert.rejects(readFile(generatedMap, 'utf8'));
});

test('source-map manifest requires newly generated or replaced map/JavaScript pairs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-manifest-'));
  await writeFile(path.join(root, 'main.js'), 'before');
  await writeFile(path.join(root, 'main.js.map'), 'before-map');
  const before = await snapshotSourceMapArtifacts(root);
  await writeFile(path.join(root, 'main.js'), 'after');
  await writeFile(path.join(root, 'main.js.map'), 'after-map');
  const manifest = await createSourceMapArtifactManifest(root, before);
  assert.deepEqual(manifest.mapFiles, [path.join(root, 'main.js.map')]);
  assert.deepEqual(manifest.javascriptFiles, [path.join(root, 'main.js')]);
  await cleanupGeneratedSourceMaps(root, before);
  await assert.rejects(readFile(path.join(root, 'main.js.map'), 'utf8'));

  const emptyRoot = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-empty-'));
  await assert.rejects(createSourceMapArtifactManifest(emptyRoot, new Map()), /nonempty/);
  await writeFile(path.join(emptyRoot, 'orphan.js.map'), '{}');
  await assert.rejects(createSourceMapArtifactManifest(emptyRoot, new Map()), /JavaScript pair/);
});

test('public map references and symlinks fail validation', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-build-'));
  await writeFile(path.join(root, 'main.js'), '//# sourceMappingURL=main.js.map');
  await assert.rejects(assertNoPublicSourceMaps(root), /source map reference/);
  await symlink(tmpdir(), path.join(root, 'escape'));
  await assert.rejects(inventorySourceMaps(root), /symbolic link/);
});

test('a symbolic-link artifact root is rejected before CLI processing', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-build-'));
  const target = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-target-'));
  const root = path.join(parent, 'browser');
  await symlink(target, root);
  await assert.rejects(inventorySourceMaps(root), /root is a symbolic link/);
});

test('partial build and upload failures always clean up and reject publication', async () => {
  for (const failingAction of ['build', 'validateArtifacts', 'inject', 'uploadAndValidate']) {
    const calls = [];
    const actions = {
      build: async () => {
        calls.push('build');
      },
      validateArtifacts: async () => {
        calls.push('validateArtifacts');
      },
      inject: async () => {
        calls.push('inject');
      },
      uploadAndValidate: async () => {
        calls.push('uploadAndValidate');
      },
      cleanup: async () => {
        calls.push('cleanup');
      },
      assertClean: async () => {
        calls.push('assertClean');
      },
    };
    actions[failingAction] = async () => {
      calls.push(failingAction);
      throw new Error('controlled failure');
    };
    await assert.rejects(runEnabledBuildTransaction(actions), /controlled failure/);
    assert.deepEqual(calls.slice(-2), ['cleanup', 'assertClean']);
  }
});

test('enabled-prebuilt-ready is the sole enabled success state', async () => {
  const action = async () => undefined;
  assert.equal(
    await runEnabledBuildTransaction({
      build: action,
      validateArtifacts: action,
      inject: action,
      uploadAndValidate: action,
      packageOutput: action,
      scanOutput: action,
      cleanup: action,
      assertClean: action,
    }),
    'enabled-prebuilt-ready',
  );
});

test('artifact assertion still runs when cleanup fails', async () => {
  const assertClean = mockFunction();
  await assert.rejects(
    runEnabledBuildTransaction({
      build: async () => undefined,
      validateArtifacts: async () => undefined,
      inject: async () => undefined,
      uploadAndValidate: async () => undefined,
      packageOutput: async () => undefined,
      scanOutput: async () => undefined,
      cleanup: async () => {
        throw new Error('cleanup failed');
      },
      assertClean,
    }),
    /cleanup failed/,
  );
  assert.equal(assertClean.calls, 1);
});

test('clean Git identity comes only from the actual full HEAD and rejects every dirty state', async () => {
  const repo = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-git-'));
  await execFile('git', ['init', '-q'], { cwd: repo });
  await execFile('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: repo });
  await execFile('git', ['config', 'user.name', 'Tests'], { cwd: repo });
  await writeFile(path.join(repo, 'tracked.txt'), 'committed');
  await execFile('git', ['add', 'tracked.txt'], { cwd: repo });
  await execFile('git', ['commit', '-qm', 'fixture'], { cwd: repo });
  const expectedSha = (await execFile('git', ['rev-parse', 'HEAD'], { cwd: repo })).stdout.trim();
  assert.deepEqual(await deriveCleanGitIdentity(repo), {
    sha: expectedSha,
    release: `trackora-ui@${expectedSha}`,
  });
  await writeFile(path.join(repo, 'untracked.txt'), 'dirty');
  await assert.rejects(deriveCleanGitIdentity(repo), /clean committed HEAD/);
  await unlink(path.join(repo, 'untracked.txt'));
  await writeFile(path.join(repo, 'tracked.txt'), 'unstaged');
  await assert.rejects(deriveCleanGitIdentity(repo), /clean committed HEAD/);
  await execFile('git', ['add', 'tracked.txt'], { cwd: repo });
  await assert.rejects(deriveCleanGitIdentity(repo), /clean committed HEAD/);
});

test('caller-supplied release and deployment identity has no authority', () => {
  const plan = createBuildPlan(
    {
      ...validEnabledEnvironment,
      VERCEL_GIT_COMMIT_SHA: 'b'.repeat(40),
      VERCEL_DEPLOYMENT_ID: 'dpl_untrusted',
      TRACKORA_SENTRY_DIST: 'untrusted',
    },
    identity,
  );
  assert.equal(plan.release, identity.release);
  assert.equal(plan.dist, identity.dist);
});

test('custom deployment IDs use 14 bytes of entropy and enforce uniqueness and Vercel syntax', () => {
  const generated = generateCustomDeploymentId(() => Buffer.alloc(14, 0xab));
  assert.equal(generated, 'trk-' + 'ab'.repeat(14));
  assert.equal(validateCustomDeploymentId(generated), generated);
  for (const invalid of ['dpl_internal', 'has.dot', '../escape', 'x'.repeat(33)]) {
    assert.throws(() => validateCustomDeploymentId(invalid), /custom deployment ID/);
  }
  assert.throws(() => validateCustomDeploymentId(generated, new Set([generated])), /collision/);
});

test('prebuilt packaging preserves one browser/upload/config deployment identity', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-package-'));
  const browser = path.join(root, 'browser');
  const output = path.join(root, '.vercel', 'output');
  await mkdir(browser, { recursive: true });
  await writeFile(path.join(browser, 'index.html'), '<script src="main.js"></script>');
  await writeFile(
    path.join(browser, 'main.js'),
    `globalThis.__DIST__=${JSON.stringify(identity.dist)}`,
  );
  await packageVercelBuildOutput({
    repositoryRoot: root,
    browserOutput: browser,
    outputRoot: output,
    dist: identity.dist,
  });
  const config = JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8'));
  assert.equal(config.deploymentId, identity.dist);
  assert.equal(
    await readFile(path.join(output, 'static', 'main.js'), 'utf8'),
    `globalThis.__DIST__=${JSON.stringify(identity.dist)}`,
  );
  await scanVercelBuildOutput({
    outputRoot: output,
    dist: identity.dist,
    secretValues: ['never-written-secret'],
  });
});

test('prebuilt cleanup is confined to the repository-owned .vercel/output path', async () => {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-contained-'));
  const browserOutput = path.join(repositoryRoot, 'browser');
  await mkdir(browserOutput);
  await writeFile(path.join(browserOutput, 'index.html'), 'safe');
  await assert.rejects(
    packageVercelBuildOutput({
      repositoryRoot,
      browserOutput,
      outputRoot: path.join(tmpdir(), '.vercel', 'output'),
      dist: identity.dist,
    }),
    /not contained/,
  );
});

test('complete Build Output scan rejects maps, references, secrets, fixtures, triggers, and symlinks safely', async () => {
  for (const [name, content, reason] of [
    ['main.js.map', '{}', 'source-map'],
    ['main.js', '//# sourceMappingURL=main.js.map', 'source-map-reference'],
    ['main.js', 'never-written-secret', 'sensitive-value'],
    ['main.js', 'CANARY_PASSWORD', 'sensitive-fixture'],
    ['sentry-preview-verification.ts', 'synthetic-unhandled-rejection', 'verification-trigger'],
  ]) {
    const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-scan-'));
    await writeFile(
      path.join(root, 'config.json'),
      JSON.stringify({ version: 3, deploymentId: identity.dist }),
    );
    await mkdir(path.join(root, 'static'));
    await writeFile(path.join(root, 'static', name), content);
    await assert.rejects(
      scanVercelBuildOutput({
        outputRoot: root,
        dist: identity.dist,
        secretValues: ['never-written-secret'],
      }),
      (error) =>
        new RegExp(reason).test(error.message) && !error.message.includes('never-written-secret'),
    );
  }
});

test('complete Build Output scan cannot be configured to allow verification triggers', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-trigger-'));
  await writeFile(
    path.join(root, 'config.json'),
    JSON.stringify({ version: 3, deploymentId: identity.dist }),
  );
  await mkdir(path.join(root, 'static'));
  await writeFile(path.join(root, 'static', 'main.js'), 'synthetic-unhandled-rejection');
  await assert.rejects(
    scanVercelBuildOutput({
      outputRoot: root,
      dist: identity.dist,
      allowVerificationTriggers: true,
    }),
    /verification-trigger/,
  );
});

test('identity mismatch, packaging failure, and final-scan failure cannot become ready', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-identity-'));
  await writeFile(
    path.join(root, 'config.json'),
    JSON.stringify({ version: 3, deploymentId: 'trk-bbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
  );
  await mkdir(path.join(root, 'static'));
  await assert.rejects(
    scanVercelBuildOutput({ outputRoot: root, dist: identity.dist }),
    /identity mismatch/,
  );

  const action = async () => undefined;
  for (const failingAction of ['packageOutput', 'scanOutput']) {
    const actions = {
      build: action,
      validateArtifacts: action,
      inject: action,
      uploadAndValidate: action,
      cleanup: action,
      assertClean: action,
      packageOutput: action,
      scanOutput: action,
    };
    actions[failingAction] = async () => {
      throw new Error(`${failingAction} failed`);
    };
    await assert.rejects(
      runEnabledBuildTransaction(actions),
      new RegExp(`${failingAction} failed`),
    );
  }
});

test('prebuilt deploy command is pinned and Preview-only with no secret-bearing arguments', () => {
  assert.deepEqual(createPrebuiltPreviewCommand(), {
    command: 'npx',
    args: ['--yes', 'vercel@64.5.0', 'deploy', '--prebuilt', '--target=preview'],
  });
  for (const args of [
    ['--prod'],
    ['--target=production'],
    ['--target', 'production'],
    ['--force'],
    ['--scope', 'another-team'],
    ['promote'],
    ['alias'],
    ['env', 'add'],
  ]) {
    assert.throws(() => createPrebuiltPreviewCommand(args), /Preview-only/);
  }
});

test('Vercel repo linkage accepts per-project orgId and legacy top-level fallback', () => {
  assert.deepEqual(
    resolveVercelProjectLink(
      {
        orgId: 'team_legacy_not_selected',
        projects: [
          { id: 'prj_current', name: 'trackora-ui', directory: '.', orgId: 'team_current' },
        ],
      },
      '.',
    ),
    { projectId: 'prj_current', orgId: 'team_current', directory: '.' },
  );
  assert.deepEqual(
    resolveVercelProjectLink(
      {
        orgId: 'team_legacy',
        projects: [{ id: 'prj_legacy', name: 'trackora-ui', directory: '.' }],
      },
      '.',
    ),
    { projectId: 'prj_legacy', orgId: 'team_legacy', directory: '.' },
  );
});

test('Vercel repo linkage fails closed for missing or ambiguous organization IDs', () => {
  for (const config of [
    { projects: [{ id: 'prj_missing', name: 'trackora-ui', directory: '.' }] },
    {
      projects: [
        { id: 'prj_one', name: 'one', directory: '.', orgId: 'team_one' },
        { id: 'prj_two', name: 'two', directory: '.', orgId: 'team_two' },
      ],
    },
    { orgId: 'team_legacy', projects: [] },
    { orgId: 'team_legacy', projects: 'malformed' },
  ]) {
    assert.throws(() => resolveVercelProjectLink(config, '.'), /Vercel repo linkage failed/);
  }
});

test('prepared Preview deployment only scans and invokes the pinned CLI', async () => {
  const calls = [];
  await deployPreparedPreviewArtifact({
    outputRoot: '/prepared/.vercel/output',
    dist: identity.dist,
    repositoryDirectory: '.',
    repoConfig: {
      projects: [{ id: 'prj_current', name: 'trackora-ui', directory: '.', orgId: 'team_current' }],
    },
    environment: validEnabledEnvironment,
    scanOutput: async (options) => {
      calls.push({ action: 'scan', options });
    },
    invoke: async (command, args, environment) => {
      calls.push({ action: 'invoke', command, args, environment });
    },
  });

  assert.deepEqual(
    calls.map(({ action }) => action),
    ['scan', 'invoke'],
  );
  assert.equal(calls[0].options.dist, identity.dist);
  assert.deepEqual(calls[1].args, [
    '--yes',
    'vercel@64.5.0',
    'deploy',
    '--prebuilt',
    '--target=preview',
  ]);
  assert.equal(calls[1].environment.SENTRY_AUTH_TOKEN, undefined);
  assert.equal(
    calls.some(({ action }) => ['build', 'generate-id', 'upload-maps'].includes(action)),
    false,
  );

  let invoked = false;
  await assert.rejects(
    deployPreparedPreviewArtifact({
      outputRoot: '/prepared/.vercel/output',
      dist: identity.dist,
      repoConfig: {
        projects: [
          { id: 'prj_current', name: 'trackora-ui', directory: '.', orgId: 'team_current' },
        ],
      },
      environment: validEnabledEnvironment,
      scanOutput: async () => {
        throw new Error('artifact scan failed');
      },
      invoke: async () => {
        invoked = true;
      },
    }),
    /artifact scan failed/,
  );
  assert.equal(invoked, false);
});

function mockFunction() {
  const callable = async () => {
    callable.calls += 1;
  };
  callable.calls = 0;
  return callable;
}
