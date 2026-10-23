# Verification: Trusted API bearer boundary (#6)

## Pre-implementation Spec Kit analysis (2026-10-23)

Setup-plan, setup-tasks, and check-prerequisites completed with the selected
feature directory. No `.specify/extensions.yml` hooks exist. Analysis was read-only
after task generation: zero blocking findings, ambiguities, duplicates,
constitution violations, or unmapped tasks. Seven functional requirements and four
success criteria have task coverage (100%); eight tasks, two tasks per user story.

| Requirements                           | Tasks                  | Coverage                                                 |
| -------------------------------------- | ---------------------- | -------------------------------------------------------- |
| FR-001, FR-004, FR-005; SC-001, SC-003 | T004, T005, T008       | Trusted workflows, caller headers, compatibility         |
| FR-002, FR-003, FR-006; SC-002         | T005, T006, T007, T008 | Browser resolution, adversarial matrix, real VIN service |
| FR-007; SC-004                         | T002, T006, T008       | Redirect contract and honest verification limits         |

All task IDs and story labels conform to the task format. MVP is US1; both
stories are required for the authorized local remediation. No parallel source
edits are needed. Proceed with failing regression tests, then minimal source fix.

## Results (2026-10-23 UTC)

Runtime: Node v22.15.0, npm 10.9.2, locked Angular build 21.2.10 and Vitest 4.1.5.
The declared packageManager is npm 11.12.1; no tool installation or lockfile change.

| Command                                                                                                                                                                     | Result                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm ci --offline --no-audit --no-fund --cache /Users/miguelregusjoa/.npm`                                                                                                  | PASS: 492 locked packages installed from cache                                                                        |
| `npm test -- --watch=false --include=src/app/core/interceptors/auth.interceptor.spec.ts` before source fix                                                                  | Expected regression failure: 129 failed / 41 passed; includes actual VIN request and overwritten caller credentials   |
| Same focused command after final changes                                                                                                                                    | PASS: 182 tests, 1 file                                                                                               |
| `npm test -- --watch=false` after final changes                                                                                                                             | PASS: 218 tests, 25 files                                                                                             |
| `npx --no-install tsc -p tsconfig.app.json --noEmit`                                                                                                                        | PASS                                                                                                                  |
| `npx --no-install tsc -p tsconfig.spec.json --noEmit`                                                                                                                       | PASS                                                                                                                  |
| `npm run build`                                                                                                                                                             | Native Node SIGABRT / esbuild deadlock; not a passing build                                                           |
| `NG_BUILD_MAX_WORKERS=1 npm run build`                                                                                                                                      | Native abort persisted; installed Node v24.2.0 also aborted                                                           |
| `CI=true npm run build` under restricted network                                                                                                                            | Cache crash avoided, but font inlining failed with `ENOTFOUND fonts.googleapis.com`                                   |
| `CI=true npm run build` with approved command escalation for public font retrieval                                                                                          | PASS: optimized production build; 769.73 kB initial bundle, existing 500 kB warning / 1 MB error thresholds unchanged |
| `npx --no-install prettier --check src/app/core/interceptors/auth.interceptor.ts src/app/core/interceptors/auth.interceptor.spec.ts 'specs/003-trusted-api-bearer/**/*.md'` | PASS                                                                                                                  |
| `git diff --check`                                                                                                                                                          | PASS                                                                                                                  |

Angular's installed cache normalizer disables the default local disk cache in CI
mode. Crash reports identified the native `@lmdb/lmdb-darwin-arm64/node.napi.node`
allocation/free failure; CI mode was used only for the build process. No source,
build budgets, dependencies, or configuration were changed to obtain a pass.
The successful build retrieved public Google Fonts without credentials. It did
not run the application or transmit a Trackora token.

Warnings: initial bundle over the warning budget; CommonJS optimization warnings
for Leaflet/STOMP; full jsdom suite reports unsupported canvas `getContext` while
passing. No linter is configured; no lint result is claimed.

## Source and preservation

- GitHub connector comparison confirmed main identical to
  `9010ed4972b7e762f4334aa13ec2214a0c840172`; local `git ls-remote` failed DNS.
- Local branch: `security/6-trusted-api-bearer`, HEAD still that base SHA. Changes
  are deliberately uncommitted; no final candidate commit or CI run exists yet.
- Source SHA-256: interceptor `67faa73f6704521b8da31c93fa6360c36b2f08b2319f183242d168b204fb1767`;
  test `286e830db36382aeff3f66fdd5a54b2284456e8febf13d94693b29aa2d4865fa`.
- Worktree: `/Users/miguelregusjoa/Documents/Codex/2026-10-22/task-2/trackora-ui-6`.
- Original checkout remains on `feature/2-integrate-sentry-angular` at `9fe66cc`
  with its sole existing modified file `docs/operations/sentry.md`. No staging,
  stashing, reset, cleanup, or source edits occurred there.
- No backend, environment, hosting, CI, lockfile, or session implementation changes.
  Existing login → stored token → me → logout passed using synthetic storage.
- No push, remote branch/PR publication, deployment, Preview access changes,
  account provisioning, Docker workload, merge, or issue closure occurred.
- No denied, pending, or uncertain action remains. Network/build failures above
  were resolved by the documented tool paths; local source work is complete.

Exact modified/added repository files:

```text
src/app/core/interceptors/auth.interceptor.ts
src/app/core/interceptors/auth.interceptor.spec.ts
specs/003-trusted-api-bearer/spec.md
specs/003-trusted-api-bearer/plan.md
specs/003-trusted-api-bearer/tasks.md
specs/003-trusted-api-bearer/research.md
specs/003-trusted-api-bearer/data-model.md
specs/003-trusted-api-bearer/quickstart.md
specs/003-trusted-api-bearer/contracts/bearer-boundary.md
specs/003-trusted-api-bearer/checklists/requirements.md
specs/003-trusted-api-bearer/verification.md
```

## Code review and remaining limits

Repository `$code-review` completed against the entire bounded diff: no blocking
findings. Exact parsed origin and segment boundary, raw/encoded traversal handling,
current browser base resolution, explicit Authorization preservation, immutable
cloning, typed code, real service paths, and error compatibility were reviewed.
All added HTTP tests use HttpTestingController or an in-memory `next` handler.
No HTTP test contacts NHTSA, the API, or another network destination.

Native-browser redirect-hop behavior, protected authenticated pilot workflows,
deployment mapping, final-commit CI links, exposure assessment, and rollout/rollback
execution: NOT RUN. Mocked redirect metadata is response pass-through evidence
only. The boundary intentionally preserves caller-supplied Authorization and
does not sanitize credentials explicitly provided by another caller/interceptor.
No historical third-party receipt or absence of exposure is established. Keep
issue #6 open pending owner-reviewed evidence and separately authorized rollout.

## Small Draft PR description (text only; no PR created)

**Title:** `security: restrict Trackora bearer attachment to trusted API (#6)`

Refs #6. The global interceptor currently adds stored Trackora credentials to
external requests, including VIN decoding. This change validates the initial
parsed API origin and `/api` boundary, resolves relative URLs using the browser
base, rejects ambiguous/escaping paths, and preserves caller Authorization.
Existing API, upload/download, authentication, and error behavior remain covered.

Validation: 182 focused tests and 218 total tests pass; app/spec TypeScript and
Prettier checks pass; optimized production build passes with `CI=true` to avoid
the local native cache crash (public font retrieval required network escalation).
See this feature's spec, plan, tasks, and verification record.

Redirect-hop/native-browser and protected pilot validation remain outstanding.
No deployment is authorized. Rollout must map the final committed SHA to CI and
the deployed build; rollback must retain the credential boundary. Keep #6 open
until the owner separately approves closure.
