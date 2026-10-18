import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { cp, lstat, mkdir, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const CUSTOM_ID_PATTERN = /^(?!dpl_)[A-Za-z0-9_-]{1,32}$/;
const VERIFICATION_MARKERS = [
  'sentry-preview-verification',
  'synthetic-unexpected-error',
  'synthetic-unhandled-rejection',
];
const FIXTURE_MARKERS = [
  'CANARY_PASSWORD',
  'CANARY_JWT',
  'CANARY_COOKIE',
  'CANARY_RESPONSE_BODY',
  'CANARY_AUTHORIZATION',
  'CANARY_GPS',
  'CANARY_TELEMETRY',
];
const REQUIRED_GEO_SELECTORS = [
  '$user.geo.city',
  '$user.geo.country_code',
  '$user.geo.region',
  '$user.geo.subdivision',
  '$user.geo.subregion',
];

function preflightFailure() {
  throw new Error('Sentry build preflight failed');
}

function privacyPreflightFailure() {
  throw new Error('Sentry privacy preflight failed');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateSentryPrivacyControls(project) {
  try {
    if (
      !project ||
      project.slug !== 'trackora-ui' ||
      project.scrubIPAddresses !== true ||
      typeof project.relayPiiConfig !== 'string'
    ) {
      privacyPreflightFailure();
    }
    const config = JSON.parse(project.relayPiiConfig);
    const rules = config?.rules;
    const applications = config?.applications;
    if (!isRecord(rules) || !isRecord(applications)) privacyPreflightFailure();
    for (const selector of REQUIRED_GEO_SELECTORS) {
      const ruleIds = applications[selector];
      if (
        !Array.isArray(ruleIds) ||
        ruleIds.length === 0 ||
        !ruleIds.every(
          (ruleId) =>
            typeof ruleId === 'string' &&
            isRecord(rules[ruleId]) &&
            rules[ruleId].type === 'anything' &&
            isRecord(rules[ruleId].redaction) &&
            rules[ruleId].redaction.method === 'remove',
        )
      ) {
        privacyPreflightFailure();
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Sentry privacy preflight failed') throw error;
    privacyPreflightFailure();
  }
}

export async function verifySentryPrivacyControls({ authToken, fetchImpl = globalThis.fetch }) {
  if (typeof authToken !== 'string' || authToken.length < 1 || typeof fetchImpl !== 'function') {
    privacyPreflightFailure();
  }
  try {
    const response = await fetchImpl('https://sentry.io/api/0/projects/trackora-o4/trackora-ui/', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      redirect: 'error',
    });
    if (!response.ok) privacyPreflightFailure();
    validateSentryPrivacyControls(await response.json());
  } catch (error) {
    if (error instanceof Error && error.message === 'Sentry privacy preflight failed') throw error;
    privacyPreflightFailure();
  }
}

function validDsn(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /(^|\.)ingest(?:\.[a-z0-9-]+)?\.sentry\.io$/i.test(url.hostname) &&
      /^\/\d+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function runCaptured(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve(stdout.trim()) : reject(new Error('Git identity check failed')),
    );
  });
}

export async function deriveCleanGitIdentity(repositoryRoot, runGit = runCaptured) {
  const status = await runGit(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    repositoryRoot,
  );
  if (status !== '') throw new Error('Trusted monitoring build requires a clean committed HEAD');
  const sha = await runGit('git', ['rev-parse', '--verify', 'HEAD'], repositoryRoot);
  if (!SHA_PATTERN.test(sha))
    throw new Error('Trusted monitoring build requires a clean committed HEAD');
  return { sha, release: `trackora-ui@${sha}` };
}

export function validateCustomDeploymentId(value, knownIds = new Set()) {
  if (!CUSTOM_ID_PATTERN.test(value ?? '')) throw new Error('Invalid custom deployment ID');
  if (knownIds.has(value)) throw new Error('Custom deployment ID collision');
  return value;
}

export function generateCustomDeploymentId(entropy = randomBytes, knownIds = new Set()) {
  const bytes = entropy(14);
  if (!Buffer.isBuffer(bytes) || bytes.length !== 14)
    throw new Error('Custom deployment ID entropy failed');
  return validateCustomDeploymentId(`trk-${bytes.toString('hex')}`, knownIds);
}

export function createBuildPlan(environment, identity) {
  if (environment.TRACKORA_SENTRY_ENABLED !== 'true') return { state: 'disabled' };
  const preview =
    environment.VERCEL_ENV === 'preview' &&
    environment.TRACKORA_SENTRY_BUILD_MODE === 'trusted-preview' &&
    environment.TRACKORA_SENTRY_PREBUILT === '1';
  const production =
    environment.VERCEL === '1' &&
    environment.VERCEL_ENV === 'production' &&
    environment.TRACKORA_SENTRY_BUILD_MODE === 'protected-production';
  if (!preview && !production) preflightFailure();
  if (
    !identity ||
    !SHA_PATTERN.test(identity.sha) ||
    identity.release !== `trackora-ui@${identity.sha}`
  )
    preflightFailure();
  let dist;
  try {
    dist = validateCustomDeploymentId(identity.dist);
  } catch {
    preflightFailure();
  }
  if (!validDsn(environment.TRACKORA_SENTRY_DSN)) preflightFailure();
  const sampleRate = Number(environment.TRACKORA_SENTRY_SAMPLE_RATE);
  if (
    !environment.TRACKORA_SENTRY_SAMPLE_RATE ||
    !Number.isFinite(sampleRate) ||
    sampleRate < 0 ||
    sampleRate > 1
  )
    preflightFailure();
  if (environment.SENTRY_ORG !== 'trackora-o4' || environment.SENTRY_PROJECT !== 'trackora-ui')
    preflightFailure();
  if (typeof environment.SENTRY_AUTH_TOKEN !== 'string' || environment.SENTRY_AUTH_TOKEN.length < 1)
    preflightFailure();
  const definitionValues = {
    TRACKORA_SENTRY_ENABLED: 'true',
    TRACKORA_SENTRY_DSN: environment.TRACKORA_SENTRY_DSN,
    TRACKORA_SENTRY_ENVIRONMENT: environment.VERCEL_ENV,
    TRACKORA_SENTRY_RELEASE: identity.release,
    TRACKORA_SENTRY_DIST: dist,
    TRACKORA_SENTRY_SAMPLE_RATE: String(sampleRate),
  };
  const browserDefinitions = Object.entries(definitionValues).map(
    ([key, value]) => `${key}=${JSON.stringify(value)}`,
  );
  const uploadArguments = [
    'sourcemaps',
    'upload',
    '--org',
    'trackora-o4',
    '--project',
    'trackora-ui',
    '--release',
    identity.release,
    '--dist',
    dist,
    '--validate',
  ];
  return {
    state: 'enabled-pending',
    release: identity.release,
    dist,
    browserDefinitions,
    uploadArguments,
  };
}

export function createBrowserBuildEnvironment(environment) {
  const result = { ...environment };
  delete result.SENTRY_AUTH_TOKEN;
  return result;
}

export function createUploadEnvironment(environment) {
  return {
    ...createBrowserBuildEnvironment(environment),
    SENTRY_AUTH_TOKEN: environment.SENTRY_AUTH_TOKEN,
  };
}

function assertContained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Artifact path escapes build output');
}

async function walk(root, current, visit) {
  let entries;
  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    const candidate = path.join(current, entry.name);
    assertContained(root, candidate);
    const stat = await lstat(candidate);
    if (stat.isSymbolicLink()) throw new Error('Generated artifact tree contains a symbolic link');
    if (stat.isDirectory()) await walk(root, candidate, visit);
    else if (stat.isFile()) await visit(candidate);
  }
}

export async function inventorySourceMaps(root) {
  const maps = new Set();
  try {
    const stat = await lstat(root);
    if (stat.isSymbolicLink()) throw new Error('Generated artifact root is a symbolic link');
    if (!stat.isDirectory()) throw new Error('Generated artifact root is not a directory');
  } catch (error) {
    if (error?.code === 'ENOENT') return maps;
    throw error;
  }
  await walk(root, root, async (file) => {
    if (file.endsWith('.map')) maps.add(path.resolve(file));
  });
  return maps;
}

export async function snapshotSourceMapArtifacts(root) {
  const snapshot = new Map();
  for (const file of await inventorySourceMaps(root)) {
    const digest = createHash('sha256')
      .update(await readFile(file))
      .digest('hex');
    snapshot.set(file, digest);
  }
  return snapshot;
}

export async function createSourceMapArtifactManifest(root, before = new Map()) {
  const after = await snapshotSourceMapArtifacts(root);
  const mapFiles = [...after]
    .filter(([file, digest]) => before.get(file) !== digest)
    .map(([file]) => file)
    .sort();
  if (mapFiles.length === 0) throw new Error('Source-map artifact set must be nonempty');
  const javascriptFiles = [];
  for (const mapFile of mapFiles) {
    const javascriptFile = mapFile.slice(0, -4);
    if (!javascriptFile.endsWith('.js'))
      throw new Error('Source-map artifact has no JavaScript pair');
    try {
      const stat = await lstat(javascriptFile);
      if (!stat.isFile() || stat.isSymbolicLink())
        throw new Error('Source-map artifact has no JavaScript pair');
    } catch {
      throw new Error('Source-map artifact has no JavaScript pair');
    }
    javascriptFiles.push(javascriptFile);
  }
  return { mapFiles, javascriptFiles, files: [...javascriptFiles, ...mapFiles] };
}

export async function cleanupGeneratedSourceMaps(root, before = new Map()) {
  for (const file of await inventorySourceMaps(root)) {
    assertContained(root, file);
    if (before instanceof Map) {
      const digest = createHash('sha256')
        .update(await readFile(file))
        .digest('hex');
      if (before.get(file) !== digest) await unlink(file);
    } else if (!before.has(file)) {
      await unlink(file);
    }
  }
}

export async function assertNoPublicSourceMaps(root) {
  if ((await inventorySourceMaps(root)).size)
    throw new Error('Generated output contains a public source map');
  await walk(root, root, async (file) => {
    if (/\.(?:js|css)$/i.test(file) && /sourceMappingURL\s*=/.test(await readFile(file, 'utf8')))
      throw new Error('Generated output contains a source map reference');
  });
}

export async function packageVercelBuildOutput({
  repositoryRoot,
  browserOutput,
  outputRoot,
  dist,
}) {
  validateCustomDeploymentId(dist);
  const resolvedRepository = path.resolve(repositoryRoot);
  const resolved = path.resolve(outputRoot);
  if (resolved !== path.join(resolvedRepository, '.vercel', 'output'))
    throw new Error('Build Output cleanup is not contained');
  assertContained(resolvedRepository, browserOutput);
  const browserStat = await lstat(browserOutput);
  if (browserStat.isSymbolicLink() || !browserStat.isDirectory())
    throw new Error('Browser output root is invalid');
  await walk(browserOutput, browserOutput, async () => undefined);
  try {
    const parent = await lstat(path.dirname(resolved));
    if (parent.isSymbolicLink()) throw new Error('Build Output parent is a symbolic link');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await rm(resolved, { recursive: true, force: true });
  await mkdir(resolved, { recursive: true });
  await cp(browserOutput, path.join(resolved, 'static'), {
    recursive: true,
    errorOnExist: true,
    force: false,
    verbatimSymlinks: true,
  });
  const config = {
    version: 3,
    deploymentId: dist,
    routes: [{ handle: 'filesystem' }, { src: '/(.*)', dest: '/index.html' }],
  };
  await writeFile(path.join(resolved, 'config.json'), `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
}

export async function scanVercelBuildOutput({ outputRoot, dist, secretValues = [] }) {
  validateCustomDeploymentId(dist);
  const rootStat = await lstat(outputRoot);
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
    throw new Error('Build Output root is invalid');
  const privateValues = secretValues.filter(
    (value) => typeof value === 'string' && value.length > 0,
  );
  const configText = await readFile(path.join(outputRoot, 'config.json'), 'utf8');
  if (
    configText.includes('SENTRY_AUTH_TOKEN') ||
    privateValues.some((value) => configText.includes(value))
  )
    throw new Error('Build Output scan failed: sensitive-value');
  let config;
  try {
    config = JSON.parse(configText);
  } catch {
    throw new Error('Build Output config is invalid');
  }
  if (config.version !== 3 || config.deploymentId !== dist)
    throw new Error('Build Output identity mismatch');
  await walk(outputRoot, outputRoot, async (file) => {
    if (file.endsWith('.map')) throw new Error('Build Output scan failed: source-map');
    const content = await readFile(file, 'utf8');
    if (/sourceMappingURL\s*=/.test(content))
      throw new Error('Build Output scan failed: source-map-reference');
    if (
      content.includes('SENTRY_AUTH_TOKEN') ||
      privateValues.some((value) => content.includes(value))
    )
      throw new Error('Build Output scan failed: sensitive-value');
    if (FIXTURE_MARKERS.some((marker) => content.includes(marker)))
      throw new Error('Build Output scan failed: sensitive-fixture');
    if (VERIFICATION_MARKERS.some((marker) => file.includes(marker) || content.includes(marker)))
      throw new Error('Build Output scan failed: verification-trigger');
  });
}

function normalizeRepoDirectory(value) {
  if (value === '' || value === '.') return '.';
  if (typeof value !== 'string' || path.isAbsolute(value))
    throw new Error('Vercel repo linkage failed');
  const normalized = value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (!normalized || normalized === '..' || normalized.startsWith('../'))
    throw new Error('Vercel repo linkage failed');
  return normalized;
}

export function resolveVercelProjectLink(repoConfig, repositoryDirectory = '.') {
  if (!isRecord(repoConfig) || !Array.isArray(repoConfig.projects) || !repoConfig.projects.length)
    throw new Error('Vercel repo linkage failed');
  const target = normalizeRepoDirectory(repositoryDirectory);
  const matches = repoConfig.projects
    .filter(isRecord)
    .map((project) => ({ ...project, directory: normalizeRepoDirectory(project.directory) }))
    .filter(
      (project) =>
        project.directory === '.' ||
        target === project.directory ||
        target.startsWith(`${project.directory}/`),
    )
    .sort((left, right) => right.directory.split('/').length - left.directory.split('/').length);
  if (!matches.length) throw new Error('Vercel repo linkage failed');
  const deepestDirectory = matches[0].directory;
  const selected = matches.filter((project) => project.directory === deepestDirectory);
  if (selected.length !== 1) throw new Error('Vercel repo linkage failed');
  const project = selected[0];
  const orgId = project.orgId ?? repoConfig.orgId;
  if (
    typeof project.id !== 'string' ||
    project.id.length === 0 ||
    typeof orgId !== 'string' ||
    orgId.length === 0
  )
    throw new Error('Vercel repo linkage failed');
  return { projectId: project.id, orgId, directory: project.directory };
}

export function createPrebuiltPreviewCommand(extraArguments = []) {
  if (extraArguments.length) throw new Error('Preview-only deployment command rejected');
  return {
    command: 'npx',
    args: ['--yes', 'vercel@64.5.0', 'deploy', '--prebuilt', '--target=preview'],
  };
}

export async function deployPreparedPreviewArtifact({
  outputRoot,
  dist,
  repoConfig,
  repositoryDirectory = '.',
  environment,
  scanOutput = scanVercelBuildOutput,
  invoke,
}) {
  if (typeof scanOutput !== 'function' || typeof invoke !== 'function')
    throw new Error('Prepared Preview deployment failed');
  resolveVercelProjectLink(repoConfig, repositoryDirectory);
  await scanOutput({
    outputRoot,
    dist,
    secretValues: [environment?.SENTRY_AUTH_TOKEN],
  });
  const command = createPrebuiltPreviewCommand();
  await invoke(command.command, command.args, createBrowserBuildEnvironment(environment ?? {}));
}

export async function runEnabledBuildTransaction(actions) {
  let uploaded = false;
  try {
    await actions.build();
    await actions.validateArtifacts();
    await actions.inject();
    await actions.uploadAndValidate();
    uploaded = true;
  } finally {
    try {
      await actions.cleanup();
    } finally {
      await actions.assertClean();
    }
  }
  if (!uploaded)
    throw new Error('Enabled monitoring build did not complete artifact upload and validation');
  await actions.packageOutput();
  await actions.scanOutput();
  return 'enabled-prebuilt-ready';
}
