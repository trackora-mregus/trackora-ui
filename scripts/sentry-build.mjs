import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import {
  assertNoPublicSourceMaps,
  cleanupGeneratedSourceMaps,
  createBrowserBuildEnvironment,
  createBuildPlan,
  createSourceMapArtifactManifest,
  createUploadEnvironment,
  deriveCleanGitIdentity,
  generateCustomDeploymentId,
  packageVercelBuildOutput,
  runEnabledBuildTransaction,
  scanVercelBuildOutput,
  snapshotSourceMapArtifacts,
} from './sentry-build-lib.mjs';

function run(command, args, environment = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: environment, shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Build command failed (${signal ?? code ?? 'unknown'})`));
    });
  });
}

const buildRoot = path.resolve(process.cwd(), 'dist', 'fleetwise-ui');
const browserOutput = path.join(buildRoot, 'browser');
const outputRoot = path.resolve(process.cwd(), '.vercel', 'output');

if (process.env.TRACKORA_SENTRY_ENABLED !== 'true') {
  await run(process.execPath, [
    path.resolve('node_modules/@angular/cli/bin/ng.js'),
    'build',
    '--configuration=production',
  ]);
  console.log('Monitoring build state: disabled');
} else {
  const gitIdentity = await deriveCleanGitIdentity(process.cwd());
  const identity = { ...gitIdentity, dist: generateCustomDeploymentId() };
  const plan = createBuildPlan(process.env, identity);
  const before = await snapshotSourceMapArtifacts(buildRoot);
  let artifactManifest;
  const browserBuildEnvironment = createBrowserBuildEnvironment(process.env);
  const uploadEnvironment = createUploadEnvironment(process.env);
  const defineArguments = plan.browserDefinitions.flatMap((definition) => ['--define', definition]);
  const sentryCli = path.resolve('node_modules/@sentry/cli/bin/sentry-cli');
  const state = await runEnabledBuildTransaction({
    build: () =>
      run(
        process.execPath,
        [
          path.resolve('node_modules/@angular/cli/bin/ng.js'),
          'build',
          '--configuration=production,sentry',
          ...defineArguments,
        ],
        browserBuildEnvironment,
      ),
    validateArtifacts: async () => {
      artifactManifest = await createSourceMapArtifactManifest(buildRoot, before);
    },
    inject: () =>
      run(sentryCli, ['sourcemaps', 'inject', ...artifactManifest.files], browserBuildEnvironment),
    uploadAndValidate: () =>
      run(sentryCli, [...plan.uploadArguments, ...artifactManifest.files], uploadEnvironment),
    cleanup: () => cleanupGeneratedSourceMaps(buildRoot, before),
    assertClean: () => assertNoPublicSourceMaps(buildRoot),
    packageOutput: () =>
      packageVercelBuildOutput({
        repositoryRoot: process.cwd(),
        browserOutput,
        outputRoot,
        dist: plan.dist,
      }),
    scanOutput: () =>
      scanVercelBuildOutput({
        outputRoot,
        dist: plan.dist,
        secretValues: [process.env.SENTRY_AUTH_TOKEN],
        allowVerificationTriggers: process.env.TRACKORA_SENTRY_VERIFICATION_STAGE === 'stage-a',
      }),
  });
  console.log(`Monitoring build state: ${state} (${plan.release}, ${plan.dist})`);
}
