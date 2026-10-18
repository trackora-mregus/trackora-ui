import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  createBrowserBuildEnvironment,
  deployPreparedPreviewArtifact,
} from './sentry-build-lib.mjs';

function run(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: environment, shell: false, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Prebuilt command failed (${signal ?? code ?? 'unknown'})`));
    });
  });
}

const action = process.argv[2];
if (!['prepare', 'deploy-preview'].includes(action) || process.argv.length !== 3) {
  throw new Error('Use exactly "prepare" or "deploy-preview"');
}

const outputRoot = path.resolve(process.cwd(), '.vercel', 'output');
if (action === 'prepare') {
  await run(process.execPath, [path.resolve('scripts/sentry-build.mjs')], {
    ...process.env,
    VERCEL_ENV: 'preview',
    TRACKORA_SENTRY_BUILD_MODE: 'trusted-preview',
    TRACKORA_SENTRY_PREBUILT: '1',
  });
  console.log('Trusted Preview artifact prepared; no deployment was created.');
} else {
  const repoConfig = JSON.parse(
    await readFile(path.resolve(process.cwd(), '.vercel', 'repo.json'), 'utf8'),
  );
  await deployPreparedPreviewArtifact({
    repositoryRoot: process.cwd(),
    outputRoot,
    repoConfig,
    repositoryDirectory: '.',
    environment: process.env,
    invoke: run,
  });
}
