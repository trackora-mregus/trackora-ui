import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  createBrowserBuildEnvironment,
  createPrebuiltPreviewCommand,
  scanVercelBuildOutput,
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
  if (!['stage-a', 'stage-b'].includes(process.env.TRACKORA_SENTRY_VERIFICATION_STAGE ?? '')) {
    throw new Error('Trusted Preview preparation requires explicit stage-a or stage-b');
  }
  await run(process.execPath, [path.resolve('scripts/sentry-build.mjs')], {
    ...process.env,
    VERCEL_ENV: 'preview',
    TRACKORA_SENTRY_BUILD_MODE: 'trusted-preview',
    TRACKORA_SENTRY_PREBUILT: '1',
  });
  console.log('Trusted Preview artifact prepared; no deployment was created.');
} else {
  const config = JSON.parse(await readFile(path.join(outputRoot, 'config.json'), 'utf8'));
  await scanVercelBuildOutput({
    outputRoot,
    dist: config.deploymentId,
    secretValues: [process.env.SENTRY_AUTH_TOKEN],
    allowVerificationTriggers: process.env.TRACKORA_SENTRY_VERIFICATION_STAGE === 'stage-a',
  });
  const command = createPrebuiltPreviewCommand();
  await run(command.command, command.args, createBrowserBuildEnvironment(process.env));
}
