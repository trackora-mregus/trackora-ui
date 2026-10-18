---
description: 'Dependency-ordered implementation tasks for Trackora Angular privacy-safe Sentry monitoring'
---

# Tasks: Privacy-Safe Frontend Error Monitoring

**Input**: Design documents from `/specs/002-integrate-sentry-angular/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by FR-030 and FR-031. Write each listed test first and confirm that it fails for the expected reason before implementing its corresponding behavior.

**Organization**: Tasks are grouped by user story so runtime diagnosis, behavior preservation, operations, and release safety can be validated as explicit increments.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on unfinished work
- **[Story]**: Maps the task to US1, US2, US3, or US4 from `spec.md`
- Every task names the exact repository path it changes or validates

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add only the approved dependencies and commands without changing application behavior.

- [x] T001 Pin `@sentry/angular@11.8.0` as a runtime dependency and `@sentry/cli@3.8.0` as a development dependency without upgrading unrelated packages in `package.json` and `package-lock.json`
- [x] T002 Add separate commands for the raw Angular build, Angular tests, Node build-contract tests, type checking, and the future guarded build entry point while preserving ordinary `npm run build` semantics in `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish typed configuration and test seams shared by all user stories.

**⚠️ CRITICAL**: Complete this phase before user-story implementation.

- [x] T003 [P] Extend configuration-model tests in `src/app/core/observability/monitoring-config.spec.ts` for explicit enablement, malformed values, safe diagnostics, valid custom Build Output IDs, reserved `dpl_`, unsupported characters, and over-32-character dist rejection; replace legacy internal deployment-ID fixtures with a valid custom ID in `src/testing/monitoring-boundary-fixtures.spec-helper.ts` and the existing observability specs without weakening their assertions
- [x] T004 After T003, update `MonitoringConfiguration` parsing in `src/app/core/observability/monitoring-config.ts` with these exact constraints: `enabled` MUST be explicitly true; `dsn` MUST be an HTTPS Sentry ingestion DSN; `environment` MUST be `production`, `preview`, or `local-verification`; `release` MUST be `trackora-ui@` plus a full commit SHA; `dist` MUST satisfy the 1–32-character custom Build Output ID contract and reject `dpl_`; and `sampleRate` MUST be finite and within `[0,1]`
- [x] T005 [P] Define an injectable monitoring gateway with enabled and disabled/no-op states, safe fixed diagnostic reason codes, and no domain-data fields in `src/app/core/observability/monitoring-gateway.ts`
- [x] T006 [P] Create a custom in-memory Sentry transport and serialized-envelope assertions for deterministic tests in `src/app/core/observability/monitoring-test-transport.ts`

**Checkpoint**: Invalid or absent configuration resolves to a disabled, nonthrowing boundary; tests can inspect final outbound envelopes without network access.

---

## Phase 3: User Story 1 - Diagnose Unexpected Frontend Failures Safely (Priority: P1) 🎯 Diagnostic MVP

**Goal**: Capture one privacy-safe, release-aware event for each eligible Angular, browser, promise, or bootstrap failure while retaining useful source grouping.

**Independent Test**: With the mocked transport and 100% preview sampling, trigger each eligible source independently and verify exactly one outbound event with the expected environment/release/dist, readable sanitized frames, stable grouping material, and no prohibited canary values.

### Tests for User Story 1

- [x] T007 [P] [US1] Write failing allowlist-sanitizer tests that place password, JWT, bearer/header, cookie, session/reset token, identity, GPS, telemetry, fleet/vehicle/device, body, query/fragment, identifier-path, circular/getter/cause, and long-string canaries in every plausible event location in `src/app/core/observability/monitoring-policy.spec.ts`
- [x] T008 [P] [US1] Write failing SDK-option tests for exact `@sentry/angular@11.8.0` APIs, the exact `EventFilters`/`Dedupe` integration allowlist, absent `GlobalHandlers` and ambient integrations, disabled data collection, and fail-closed `beforeSend` behavior in `src/app/core/observability/monitoring-gateway.spec.ts`
- [x] T009 [P] [US1] Write failing Angular boundary tests for framework errors, window `error`, Error-valued and primitive `unhandledrejection`, same-object overlap, distinct errors, and grouping equivalence/differentiation in `src/app/core/observability/monitoring-error-handler.spec.ts`
- [x] T010 [P] [US1] Write failing bootstrap tests proving eligible rejection capture occurs once after successful monitoring initialization while the existing console fallback remains intact in `src/main.spec.ts`

### Implementation for User Story 1

- [x] T011 [US1] Implement centralized `beforeSend` classification and allowlist reconstruction in `src/app/core/observability/monitoring-policy.ts`, retaining only event ID/time, fixed error level/platform, validated environment/release/dist, minimal SDK metadata, bounded exception type, stable typed placeholder value, complete safe app-relative stack shape, and sanitized debug IDs/code-file paths
- [x] T012 [US1] Implement conditional `Sentry.init` and exact 11.8.0 `BrowserOptions` in `src/app/core/observability/monitoring-gateway.ts`, including `attachStacktrace: true`, `sendClientReports: false`, `maxBreadcrumbs: 0`, `enhanceFetchErrorMessages: false`, fully disabled `dataCollection` (including `userInfo: false`), undefined tracing and profile sampling, callback-form replacement of default integrations, and no initialization when disabled; do not add unsupported `sendDefaultPii` or legacy `profilesSampleRate` properties
- [x] T013 [US1] Implement the raw-error-aware Angular boundary by wrapping/subclassing public `SentryErrorHandler` in `src/app/core/observability/monitoring-error-handler.ts`, keeping Angular as the sole global listener path and preserving fallback error handling
- [x] T014 [US1] Register the custom `ErrorHandler` without removing `provideBrowserGlobalErrorListeners()` in `src/app/app.config.ts`
- [x] T015 [US1] Initialize the monitoring gateway before `bootstrapApplication`, capture an eligible consumed bootstrap rejection once, and preserve the existing `console.error` behavior in `src/main.ts`

**Checkpoint**: US1 passes entirely with a mocked transport and provides privacy-safe diagnostic events without needing Vercel or real Sentry access.

---

## Phase 4: User Story 2 - Preserve Normal Application Behavior (Priority: P1) 🚧 Release Minimum

**Goal**: Prove monitoring is an isolated operational side channel that does not alter REST, authentication, notifications, WebSocket/STOMP, Leaflet, telemetry, history, navigation, or state behavior.

**Independent Test**: Run representative expected-error and failure-injection cases with monitoring absent, explicitly disabled, malformed, enabled, provider/transport blocked, and internally failing; application results and notification/reconnect/state semantics remain identical and the monitoring transport emits nothing for expected activity.

### Tests for User Story 2

- [x] T016 [P] [US2] Write failing typed-classifier and interceptor regressions for `http-4xx`, `cancellation`, `authentication-expiry`, `authorization-denial`, `validation-failure`, and `handled-outcome`, including HTTP 400/401/403/404/409/422/429 and a string response-body canary; assert each fixed reason, zero capture, unchanged notification counts, and unchanged rethrows in `src/app/core/observability/monitoring-policy.spec.ts` and `src/app/core/interceptors/error.interceptor.spec.ts`
- [x] T017 [P] [US2] Write failing tests proving routine connect/disconnect/reconnect/success/subscription callbacks emit zero monitoring events and retain the five-second recovery lifecycle in `src/app/core/observability/monitoring-websocket-regression.spec.ts`
- [x] T018 [P] [US2] Write failing tests and reusable fixtures for the complete monitoring-boundary matrix—configuration absent, explicitly disabled, malformed/incomplete, valid and enabled, provider/transport blocked, and internally failing during parsing, initialization, classification, sanitization, capture, or transport—and assert unchanged fallback handling with no recursive event in `src/app/core/observability/monitoring-failure-isolation.spec.ts`
- [x] T019 [US2] After T018, reuse its absent/disabled/malformed/enabled/blocked/failing fixtures across representative existing workflows and assert identical observable results, notification counts, state, and recovery: login/session authentication in `src/app/features/login/login/login.component.spec.ts`; REST loading plus Leaflet marker/viewport behavior, live telemetry, auto-follow, and historical replay isolation in `src/app/features/vehicles/vehicle-details/vehicle-map/vehicle-map.component.spec.ts`; fleet-map rendering in `src/app/features/telematics/telematics/fleet-map/fleet-map.spec.ts`; shared-consumer/fleet-isolation/unsubscribe behavior in `src/app/core/services/fleet-live-location.service.spec.ts`; and partial-update/ordering/application-state semantics in `src/app/shared/models/vehicle-live-state.spec.ts`, without adding monitoring responsibilities to product code

### Implementation for User Story 2

- [x] T020 [US2] Implement exhaustive typed candidate classification for `http-4xx`, `cancellation`, `authentication-expiry`, `authorization-denial`, `validation-failure`, `handled-outcome`, `routine-reconnect`, duplicates, monitoring-disabled, and monitoring-internal failures before Sentry delegation in `src/app/core/observability/monitoring-policy.ts`
- [x] T021 [US2] Harden excluded-error and monitoring-failure fallback paths so Angular's existing diagnostic behavior always runs exactly once in `src/app/core/observability/monitoring-error-handler.ts`
- [x] T022 [US2] Contain initialization, capture, sanitizer, and transport failures without leaking raw errors or changing caller behavior in `src/app/core/observability/monitoring-gateway.ts`
- [x] T023 [US2] Verify and, only where necessary for test seams, minimally adapt expected-error handling without adding Sentry calls in `src/app/core/interceptors/error.interceptor.ts`, `src/app/core/services/fleet-live-location.service.ts`, `src/app/core/services/dashboard-live.service.ts`, `src/app/core/services/fleet-alert-live.service.ts`, and `src/app/core/services/safety-live.service.ts`

**Checkpoint**: US1 and US2 form the minimum releasable runtime increment; all existing product behavior remains authoritative when monitoring is disabled or broken.

---

## Phase 5: User Story 3 - Operate Monitoring Within Privacy and Cost Limits (Priority: P2)

**Goal**: Provide environment-scoped enablement and conservative sampling with deterministic configuration, quota, and disable controls.

**Independent Test**: Evaluate local, preview, and production configurations plus invalid boundaries; verify local is off/0, isolated preview is 1.0, production is 0.25, excluded events reach neither sampling nor transport, and owners can follow the documented quota/disable response.

### Tests for User Story 3

- [x] T024 [P] [US3] Re-run and, only as needed for the new valid custom-dist fixture, update environment-policy tests for local off/0, isolated preview 1.0, production 0.25, explicit overrides within inclusive `[0,1]`, and rejection of NaN/infinite/out-of-range values in `src/app/core/observability/monitoring-config.spec.ts`
- [x] T025 [P] [US3] Write failing pipeline-order tests at sample rate 1 proving classification and `beforeSend` precede the verified 11.8.0 error `sampleRate`, while production 0.25 is asserted deterministically without a production error in `src/app/core/observability/monitoring-gateway.spec.ts`

### Implementation for User Story 3

- [x] T026 [US3] Implement deployment-scoped enablement and sampling defaults/overrides with no remote runtime switch in `src/app/core/observability/monitoring-config.ts`
- [x] T027 [US3] Add environment-safe compile-time declarations for enabled, DSN, environment, release, dist, and sample rate while excluding the upload credential and defining no bypass input in `src/app/core/observability/monitoring-config.ts` and `src/types.d.ts`
- [x] T028 [US3] Document configuration ownership, current dated free-tier quota, normal target at or below 20%, action threshold at 50%, sampling reduction, and review cadence in `docs/operations/sentry.md`
- [x] T029 [US3] After T028, document normal Vercel-configuration-plus-redeployment disablement, under-ten-minute target, provider project/key emergency shutdown, configuration reconciliation, and the absence of an emergency source-map bypass in `docs/operations/sentry.md`
- [ ] T030 [US3] Add a repeatable operator checklist for environment separation, usage review, and production sampling inspection without intentional production errors, plus a safe isolated-preview or tabletop exercise that records under-ten-minute normal disablement and under-five-minute emergency-shutdown/rollback identification without modifying Production configuration, in `docs/operations/sentry.md`

**Checkpoint**: Owners can configure, budget, reduce, or disable error events without an application-code rollback or remote application switch.

---

## Phase 6: User Story 4 - Release and Roll Back Monitoring Safely (Priority: P2)

**Goal**: Make monitored publication depend on a clean committed source revision, exact release/custom-dist source-map validation, safe local prebuilt packaging, and a complete final-output scan while keeping maps and credentials private and every bypass hard-disabled.

**Independent Test**: Run mocked build and packaging transactions for ordinary and trusted prebuilt modes without provider calls, then perform two distinct clean-commit prebuilt Preview stages: Stage A with one unexpected-error case and one unhandled-rejection case proving exact clean-HEAD release/custom-dist matching and symbolication, followed by trigger-free Stage B proving no verification mechanism remains in source or `.vercel/output`. No public map or secret exists, upload/package/scan failure always blocks, explicit Preview targeting is mandatory, and no input can create a bypass or production-capable verification state.

### Tests for User Story 4

- [x] T031 [US4] Write failing Node tests proving non-Vercel local/CI and explicitly disabled Vercel builds require no DSN/token/metadata, perform no upload, and preserve ordinary build behavior in `scripts/sentry-build.test.mjs`
- [x] T032 [US4] After T031, write failing Node tests with temporary Git repositories proving trusted monitored builds derive the full release SHA from actual clean committed `HEAD`, reject staged/unstaged/untracked content and caller-supplied SHA authority, and reject missing DSN, sampling, fixed org/project, or locally supplied upload token in `scripts/sentry-build.test.mjs`
- [x] T033 [US4] After T032, write failing Node tests with stubbed entropy proving generation is `trk-` plus 28 lowercase hex characters from 14 random bytes; validation accepts only unique 1–32-character `[A-Za-z0-9_-]` values; reserved `dpl_`, unsupported characters, oversize values, and known Stage/evidence collisions fail; a hosted collision remains fatal without post-build regeneration; and the same ID is required in browser definitions, Sentry CLI `--dist`, and fixture `.vercel/output/config.json`, in `scripts/sentry-build.test.mjs`
- [x] T034 [US4] After T033, write failing Node tests for pre-build inventory, symlink/path-escape rejection, partial-build cleanup, upload-success/failure cleanup, exact prebuilt packaging, and recursive final `.vercel/output` rejection of `.map`, `sourceMappingURL`, credential/privileged values, sensitive fixtures, and stage-forbidden verification files/symbols/imports/sentinels; prove actual secret-value comparison remains in scanner memory and never appears in arguments, logs, or finding text, in `scripts/sentry-build.test.mjs`
- [x] T035 [US4] After T034, write failing Node tests proving upload/validation, cleanup, packaging, identity mismatch, or final-scan failure always exits nonzero; the upload token reaches only the mocked Sentry upload subprocess; and command construction permits only explicit prebuilt Preview while rejecting `--prod`, production targets, promotion, production aliases, Production-variable mutation, secret-bearing arguments/metadata, bypass inputs, or any terminal success other than `disabled` and `enabled-prebuilt-ready` in `scripts/sentry-build.test.mjs`

### Implementation for User Story 4

- [x] T036 [US4] Implement pure clean-Git-HEAD derivation, custom-ID generation/validation/collision checks, release/dist single-source identity, build-state, path-containment, artifact-manifest, Build Output config, full-output scan, and Preview-command validation helpers in `scripts/sentry-build-lib.mjs` with exactly two terminal success states—`disabled` and `enabled-prebuilt-ready`—and no bypass or production-verification transition
- [x] T037 [US4] Implement the guarded trusted transaction across `scripts/sentry-build.mjs` and `scripts/sentry-prebuilt.mjs`: clean-commit preflight; read-only Sentry project privacy preflight requiring project IP scrubbing plus explicit removal of every normalized `user.geo` field; optimized hidden-map build; debug-ID injection; `@sentry/cli@3.8.0` upload with `--validate` and exact release/custom dist; upload-only token environment; mandatory failure propagation; bounded `finally` cleanup; Vercel Build Output packaging; exact `config.json` deployment ID; recursive privacy/artifact/Stage scan; and non-secret final-state logging; recognize no bypass input or success state
- [x] T038 [US4] Configure production script source maps as hidden and non-public while preserving existing optimization and bundle budgets in `angular.json`
- [x] T039 [US4] Keep ordinary `npm run build`, raw Angular, and Node build-contract commands credential-free while adding an explicit trusted prebuilt-Preview command pinned to Vercel CLI `50.4.0` outside application dependencies, never embedding a secret in arguments and never targeting Production; retain the separately protected automatic Production path and make its deterministic no-deploy packaging validation fail if it cannot preserve the same custom browser/upload/config identity, in `package.json` and repository build scripts without adding dependencies
- [x] T040 [US4] Add Angular tests, Node build-contract tests, type checking, and the ordinary optimized build to `.github/workflows/frontend-ci.yml` without adding Sentry/Vercel secrets or privileged pull-request execution
- [ ] T041 [US4] After T030, document clean-HEAD release derivation, custom Build Output dist/internal-record-ID separation, trusted local secret handling, exact prebuilt Preview targeting, full `.vercel/output` scanning, mandatory upload/package/scan failure blocking, prohibited Production operations, rollback, and the future separately approved issue boundary for any owner-controlled bypass in `docs/operations/sentry.md`
- [x] T042 [US4] Execute Preview Stage A from a clean committed revision only after the read-only privacy preflight passes: use temporary one-shot synthetic unexpected-error and deterministic `PromiseRejectionEvent` cases through the real Angular initialization/listener path, fixed payload-free trigger/handler/transport diagnostics, accepted-transport sequencing, and a separate isolated-Chromium naturally unhandled Promise test; generate a unique custom ID, produce/scan `enabled-prebuilt-ready`, and explicitly deploy the exact output only to an access-controlled Preview; verify exactly one privacy-safe symbolicated normalized event per case, no `user.geo`, no duplicates, exact clean-HEAD release/browser-upload-config dist matching, no public maps, and retain non-secret Stage-A commit/custom-ID/internal-record-ID/URL evidence
- [ ] T043 [US4] Execute separate Preview Stage B from a distinct clean commit by removing `src/app/core/observability/sentry-preview-verification.ts` and both cases/imports/references/sentinels, generating a different custom ID, proving absence in the source tree and complete `.vercel/output`, and explicitly deploying the exact trigger-free prebuilt output only to Preview; record both Preview URLs/clean commit SHAs/custom IDs/internal record IDs, Stage-A event counts, production 0.25 inspection, exact release/dist/config match, zero deployed maps/secrets, and absence evidence in `docs/operations/sentry.md`

**Checkpoint**: A monitored artifact cannot appear Preview-ready without a clean commit, accepted source maps, exact custom identity, safe packaging, and a clean complete Build Output; upload, validation, cleanup, packaging, or scan failure always blocks, and no bypass or production-capable verification state exists.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete documentation, security, performance, and full-repository validation across all stories.

- [x] T044 [P] Update the frontend development documentation with deterministic monitoring tests, trusted prebuilt Preview commands, clean-commit/custom-ID requirements, local-secret boundaries, and the no-production-deploy/no-production-synthetic-error rules in `docs/development/github-workflow.md`
- [x] T045 [P] Add a concise operations link without duplicating the runbook in `README.md`
- [ ] T046 Measure at least five equivalent optimized-build startup and dashboard/map/live-update runs before and after integration, confirm median attributable regression is at most 5%, and record results in `docs/operations/sentry.md`
- [ ] T047 Scan generated browser artifacts, the complete `.vercel/output`, and build logs for fixture secrets, privileged variable names/values, upload tokens, public maps, source-map references, prohibited integrations, and stage-forbidden verification symbols; also perform a read-only Git-history scan using credential names and approved non-secret fingerprints/patterns without supplying or printing real credential values or rewriting history; record the repeatable commands in `docs/operations/sentry.md`
- [x] T048 Run the complete supported validation set (`npm test -- --watch=false`, `npm run test:build`, `npx tsc --noEmit`, `npm run build`, deterministic prebuilt-package validation without deployment/provider contact, and `git diff --check`) and record outcomes in `docs/operations/sentry.md`
- [x] T049 Use `.agents/skills/code-review/SKILL.md` to review authentication/tenant privacy, GPS/telemetry leakage, duplicate capture, SDK option accuracy, clean-HEAD/custom-ID trust, local secret isolation, Build Output scanning, Preview-only command enforcement, cleanup containment, release matching, Spec Kit alignment, tests, and unrelated diffs; fix findings in the affected implementation files
- [ ] T050 Audit the complete pre-merge evidence required by `specs/002-integrate-sentry-angular/quickstart.md`—Stage A from a clean commit with isolated unexpected-error plus unhandled-rejection verification and Stage B from a distinct clean trigger-free commit, each with a different custom ID and prebuilt Preview deployment—then re-run Stage-B deterministic, source-tree, complete `.vercel/output`, identity, secret, and Preview checks from the final candidate
- [ ] T051 After a release owner separately authorizes and completes production deployment, perform and record the read-only public-artifact verification from `specs/002-integrate-sentry-angular/quickstart.md` in `docs/operations/sentry.md`, confirming zero retrievable source maps and matching immutable release/deployment metadata without triggering a production error, changing configuration, authorizing deployment, or modifying application code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Starts immediately.
- **Foundational (Phase 2)**: Depends on Setup and blocks every user story.
- **US1 (Phase 3)**: Depends on Foundational and establishes the runtime monitoring path.
- **US2 (Phase 4)**: Depends on US1's boundary so behavior-preservation and failure-isolation tests exercise the real integration.
- **US3 (Phase 5)**: Depends on US1 configuration/runtime contracts; it may proceed in parallel with US2 after US1.
- **US4 (Phase 6)**: Depends on US1 and US3 for browser configuration/release inputs; its build tests can begin in parallel with US2, but hosted preview acceptance waits for US2.
- **Polish (Phase 7)**: Depends on all four stories and a trigger-free preview commit.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 -> US2 -----------\
                         \-> US3 -> US4 ------> Polish
                              \----> US4
```

- **US1**: Independently testable with a mocked transport; provides the diagnostic MVP.
- **US2**: Requires US1 implementation but independently proves application behavior preservation; US1 + US2 is the minimum releasable runtime.
- **US3**: Requires typed configuration from Foundation and SDK options from US1; independently proves environment/cost controls.
- **US4**: Requires runtime release/dist inputs from US1/US3; independently proves the deployment and artifact contract.

### Within Each User Story

- Write listed tests first and confirm expected failures.
- Implement typed policy/models before the services that consume them.
- Complete deterministic tests before isolated-preview work.
- Never supply real upload credentials to local or GitHub CI tests.
- Do not proceed from a failed upload to publication; cleanup still runs, but no bypass condition or successful bypass state exists.

### Parallel Opportunities

- T003, T005, and T006 can proceed in parallel after dependency setup.
- US1 test tasks T007–T010 can be authored in parallel.
- US2 test tasks T016–T018 can be authored in parallel; T019 depends on the reusable matrix from T018 and runs afterward, before T020–T023 modify policy/boundary/integration areas with coordination.
- US3 documentation tasks T028–T030 are serialized because they update the same operations runbook.
- US4 build tests T031–T035 are serialized because they update the same Node test file; implementations T036, T037, and T039 follow those tests in order; T041 can proceed alongside build implementation.
- Documentation tasks T044 and T045 can proceed in parallel after story behavior stabilizes.
- T051 is an explicitly post-deployment, read-only release-owner follow-up and cannot authorize or perform the merge or deployment it observes.

---

## Parallel Example: User Story 1

```text
Task T007: Sanitizer canary and hostile-value tests in monitoring-policy.spec.ts
Task T008: Exact Sentry 11.8.0 option/integration tests in monitoring-gateway.spec.ts
Task T009: Angular/browser/promise/duplicate/grouping tests in monitoring-error-handler.spec.ts
Task T010: Bootstrap rejection and fallback tests in main.spec.ts
```

## Parallel Example: User Story 2

```text
Task T016: Typed expected-error and HTTP 4xx/body exclusion tests
Task T017: WebSocket/STOMP lifecycle regression tests in monitoring-websocket-regression.spec.ts
Task T018: Monitoring failure-isolation tests in monitoring-failure-isolation.spec.ts

After T018 completes:
Task T019: Apply its six-state monitoring matrix to authentication, REST, map, telemetry, history, and state regression suites
```

## Parallel Example: User Story 4

```text
Task T031: Ordinary local/CI build-mode tests
Task T032: Clean-HEAD derivation and trusted-input tests
Task T033: Custom-ID constraints, uniqueness, and three-way consistency tests
Task T034: Packaging, cleanup, and complete Build Output scan tests
Task T035: Mandatory failure, local-secret isolation, Preview-only, and no-bypass tests
```

---

## Implementation Strategy

### Diagnostic MVP: User Story 1

1. Complete Setup and Foundation.
2. Complete US1 tests and runtime integration.
3. Stop and validate the mocked-transport acceptance criteria.
4. Do not release this increment until US2 is also complete.

### Minimum Releasable Runtime: User Stories 1 + 2

1. Complete US1 diagnostic capture.
2. Complete US2 expected-error exclusion and failure isolation.
3. Run all existing authentication, REST, WebSocket, map, telemetry, history, and notification regression tests.
4. Stop if monitoring changes any user-visible or state behavior.

### Incremental Delivery

1. Setup + Foundation establish typed seams.
2. US1 + US2 establish safe runtime capture.
3. US3 adds sampling, quota, and disable operations.
4. US4 adds private source maps, trusted local prebuilt packaging, explicit Vercel Preview gating, verification, and rollback evidence.
5. Polish completes performance, security review, and full validation before PR approval.

### Parallel Team Strategy

After US1 stabilizes, one implementer can complete US2 runtime regressions while another authors US3 operational documentation and US4 build-contract tests. Changes to shared monitoring files and `package.json` remain serialized to avoid conflicts.

## Notes

- `[P]` tasks touch different files or are test-authoring tasks that can proceed without unfinished implementation.
- Every user-story task includes its `[US#]` label; Setup, Foundation, and Polish tasks intentionally do not.
- No task introduces backend changes, tracing, replay, profiling, logging capture, analytics, alerts, new state management, or unrelated dependencies.
- Emergency bypass is unimplemented and hard-disabled; any future owner-controlled mechanism requires a separately approved issue and specification.
- The temporary preview verification file and both verification cases must not exist in the production-approved diff or generated browser bundles.
- Shared Vercel Preview variables never hold `SENTRY_AUTH_TOKEN`; Stage A and Stage B use distinct clean commits, custom IDs, artifacts, and Preview deployments.
