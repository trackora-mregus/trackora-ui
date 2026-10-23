# Local validation (#6)

Use the issue worktree, locked dependencies, and existing Node/npm tools. No server,
container, credentials, hosted environment, or external HTTP request is needed.

```sh
npm ci --offline --no-audit --no-fund --cache /Users/miguelregusjoa/.npm
npm test -- --watch=false --include=src/app/core/interceptors/auth.interceptor.spec.ts
npm test -- --watch=false
npx tsc -p tsconfig.app.json --noEmit
npm run build
npx prettier --check src/app/core/interceptors/auth.interceptor.ts src/app/core/interceptors/auth.interceptor.spec.ts 'specs/003-trusted-api-bearer/**/*.md'
git diff --check
```

Expected: trusted reads, uploads, and downloads retain authentication; external,
ambiguous, and adversarial requests receive no injected sentinel. Actual VIN
service calls are flushed by HttpTestingController, never sent to NHTSA. The test
matrix exercises both unchanged environment configurations. Record actual results
and limitations in [verification.md](verification.md).
