import process from 'node:process';

import { verifySentryPrivacyControls } from './sentry-build-lib.mjs';

try {
  await verifySentryPrivacyControls({ authToken: process.env.SENTRY_AUTH_TOKEN });
  console.log('Sentry privacy preflight passed.');
} catch {
  console.error('Sentry privacy preflight failed.');
  process.exitCode = 1;
}
