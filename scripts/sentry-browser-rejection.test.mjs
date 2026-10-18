import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFile = promisify(execFileCallback);
const candidates = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

async function findChrome() {
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the next reviewed browser location.
    }
  }
  throw new Error('A local Chromium browser is required for the isolated rejection test');
}

test('a naturally rejected Promise emits one native unhandledrejection event in Chromium', async () => {
  const chrome = await findChrome();
  const root = await mkdtemp(path.join(tmpdir(), 'trackora-sentry-browser-'));
  const profile = path.join(root, 'profile');
  const page = path.join(root, 'rejection.html');
  await writeFile(
    page,
    `<!doctype html><body data-result="pending"><script>
      let count = 0;
      addEventListener('unhandledrejection', event => {
        event.preventDefault();
        if (event.reason instanceof Error && event.reason.message === 'isolated-natural-rejection') {
          count += 1;
          document.body.dataset.result = String(count);
        }
      });
      setTimeout(() => { void Promise.reject(new Error('isolated-natural-rejection')); }, 0);
    </script></body>`,
  );
  const { stdout } = await execFile(chrome, [
    '--headless=new',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--virtual-time-budget=1000',
    '--dump-dom',
    pathToFileURL(page).href,
  ]);
  assert.match(stdout, /data-result="1"/);
});
