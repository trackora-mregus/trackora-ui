# Implementation Plan: Privacy-Safe Frontend Error Monitoring

**Branch**: `[feature/2-integrate-sentry-angular]` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-integrate-sentry-angular/spec.md`

**Note**: This template is filled in by the `$speckit-plan` command; its definition describes the execution workflow.

## Summary

Integrate the official Sentry Angular SDK at the existing standalone bootstrap boundary. A small core observability service will classify eligible failures, sanitize events with a strict allowlist, and fail closed without changing existing REST, notification, WebSocket, authentication, map, or telemetry behavior. A repository-owned trusted prebuilt workflow will derive the release from a clean committed Git `HEAD`, bind browser events and private source maps to one custom Build Output deployment ID, block publication when upload, packaging, identity validation, or final-output scanning fails, and deploy only the exact sanitized `.vercel/output` to an isolated Vercel Preview.

## Technical Context

**Language/Version**: TypeScript 5.9, JavaScript ES2022, Node.js 22 in CI

**Primary Dependencies**: Angular 21.2 standalone APIs, RxJS 7.8, verified official `@sentry/angular@11.8.0`, and pinned `@sentry/cli@3.8.0` for build-only artifact injection/upload

**Storage**: No application storage changes; public-safe deployment configuration, ephemeral trusted-local secret injection, generated `.vercel/output`, and private Sentry release artifacts only

**Testing**: Angular unit runner with Vitest globals, Node's built-in test runner for build/prebuilt packaging automation, TypeScript compilation, Angular production build, deterministic local Build Output fixtures, isolated Vercel Preview verification

**Target Platform**: Modern browsers deployed as a static Angular application on Vercel; Node.js 22 build host

**Project Type**: Single Angular web application with repository-owned build automation

**Performance Goals**: Error-only monitoring; current Angular bundle budgets preserved; no more than 5% repeatable startup or routine-interaction regression

**Constraints**: No authentication, tenant, GPS, telemetry, vehicle, fleet, request, or sensitive URL data may leave the browser; no replay/tracing/profiling/breadcrumbs/user context; monitoring failures never interrupt the app; enabled publication requires a clean committed revision, private source-map upload/validation, exact custom-ID consistency, bounded cleanup, and a clean final `.vercel/output`; no emergency bypass exists; verification cannot target or modify Production

**Scale/Scope**: One Angular bootstrap path and error boundary, two HTTP interceptors, four STOMP live services, one Vercel build path, and the current frontend CI workflow

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Architecture consistency — PASS**: Only the official Angular monitoring SDK and its build CLI are added; no UI, state, map, HTTP, or WebSocket abstraction is replaced.
- **Component/service ownership — PASS**: Monitoring is a core integration service and Angular `ErrorHandler`; components remain unaware of transport details.
- **Typed state/domain integrity — PASS**: Configuration and decisions are typed. Fleet, vehicle, telemetry, GPS, authentication, and tenant values are prohibited from events.
- **REST/WebSocket semantics — PASS**: HTTP interceptors and STOMP services retain current behavior. Expected 4xx responses and routine reconnects are not capture sources.
- **Security/privacy — PASS**: Browser configuration is public-safe, the Preview upload token remains only in the trusted local upload process and never enters shared Preview variables or deployable output, Production retains its separately protected build-secret scope, and sanitization fails closed.
- **Testing/release safety — PASS**: Unit, build-contract, optimized-build, artifact, and isolated-preview checks precede the automatic production merge path.
- **Simplicity — PASS**: A narrow wrapper coordinates the existing Angular and Sentry commands; no new infrastructure service or backend change is introduced.

**Post-design re-check**: PASS. The Phase 1 contracts preserve one monitoring boundary, current application behavior, private artifacts, and auditable release controls. No exception is required.

## Project Structure

### Documentation (this feature)

```text
specs/002-integrate-sentry-angular/
├── plan.md              # This file ($speckit-plan command output)
├── research.md          # Phase 0 output ($speckit-plan command)
├── data-model.md        # Phase 1 output ($speckit-plan command)
├── quickstart.md        # Phase 1 output ($speckit-plan command)
├── contracts/           # Phase 1 output ($speckit-plan command)
└── tasks.md             # Phase 2 output ($speckit-tasks command - NOT created by $speckit-plan)
```

### Source Code (repository root)

```text
src/
├── main.ts
├── app/
│   ├── app.config.ts
│   └── core/
│       ├── interceptors/                 # Behavior unchanged; regression targets
│       ├── observability/
│       │   ├── monitoring-config.ts
│       │   ├── monitoring-error-handler.ts
│       │   ├── monitoring-gateway.ts
│       │   ├── monitoring-policy.ts
│       │   └── *.spec.ts
│       └── services/*-live.service.ts    # Behavior unchanged; regression targets
└── environments/

scripts/
├── sentry-build.mjs
├── sentry-build-lib.mjs
├── sentry-prebuilt.mjs
└── sentry-build.test.mjs

docs/operations/sentry.md
.github/workflows/frontend-ci.yml
angular.json
package.json
package-lock.json
```

**Structure Decision**: Extend the existing single Angular application. Runtime policy lives under `src/app/core/observability`; privileged build behavior remains outside browser code in `scripts/`. Existing interceptors and STOMP services are regression-test targets, not new capture points. Compile-time runtime values are public-safe; upload credentials never enter Angular environment files.

## Implementation Sequence

1. Add exact `@sentry/angular@11.8.0` and `@sentry/cli@3.8.0` without unrelated upgrades; separate Angular-build, guarded-build, unit, build-contract, and validation commands.
2. Implement typed configuration parsing that disables monitoring safely when public configuration is absent, disabled, malformed, or incomplete.
3. Implement and exhaustively test classification and allowlist sanitization before SDK wiring.
4. Initialize with `Sentry.init(BrowserOptions)` before bootstrap and an explicit safe integration allowlist derived from the package's public `getDefaultIntegrations()`. Keep Angular's existing `provideBrowserGlobalErrorListeners()` as the sole `error`/`unhandledrejection` route; remove Sentry `GlobalHandlers` and wrap/subclass the public `SentryErrorHandler` so raw errors are classified before `super.handleError` can unwrap an HTTP body. Preserve Angular's fallback handling for excluded errors and explicitly capture the consumed bootstrap rejection once.
5. Preserve HTTP interceptor and STOMP behavior. Tests prove 4xx responses, reconnect callbacks, console activity, and routine application work create no event.
6. Add explicit build modes. Ordinary local/CI builds use the current optimized build, require no Sentry credential, and perform no upload. Trusted monitored builds require a clean committed tree, derive `release = trackora-ui@<git rev-parse HEAD>`, generate one unique Vercel-supported custom Build Output deployment ID as `dist`, reject caller-controlled SHA authority or unsupported/reused IDs, and perform a read-only project privacy preflight requiring both IP scrubbing and explicit removal of every normalized `user.geo` field.
7. Add the guarded artifact transaction: build hidden maps, record only generated artifact paths under the resolved browser output, inject debug IDs, upload/validate them, and use a `finally`-equivalent cleanup to remove only those generated maps. Produce `.vercel/output`, set the same custom ID in `config.json`, then scan the complete output for maps, map references, secrets, privileged values, sensitive fixtures, symlinks/path escape, and stage-forbidden verification code before returning `enabled-prebuilt-ready`.
8. Keep emergency bypass unimplemented and hard-disabled. The guarded workflow has only `disabled` and `enabled-prebuilt-ready` terminal success states; every upload, validation, cleanup, packaging, identity, or scan failure exits nonzero regardless of repository values, URLs, approval references, or build variables. Document a separately approved future issue as the only path to designing an owner-controlled bypass mechanism.
9. Expand CI with unit, Node build-contract, type, ordinary production-build, and deterministic fixture-based Build Output packaging checks, without giving CI a Sentry token or contacting Vercel/Sentry.
10. Document trusted local secret injection, custom-ID generation and evidence, exact prebuilt Preview commands, quota review, preview acceptance, normal deployment-based disablement, emergency provider shutdown, rollback, mandatory upload blocking, the future-bypass issue boundary, and safe timing exercises. Prohibit token-bearing arguments/files/metadata and every production-capable verification command.
11. Run two distinct prebuilt Preview stages. Stage A uses a clean commit with a temporary named synthetic unexpected error and deterministic `PromiseRejectionEvent` through Angular's existing listener at 100% sampling. Emit fixed, payload-free trigger/handler/transport lifecycle evidence and begin the unexpected case only after accepted rejection transport completion. Separately run an isolated Chromium test proving naturally unhandled Promise rejection emits the native event. Use a unique custom ID and exact locally scanned `.vercel/output`; confirm exactly one sanitized, symbolicated normalized event per case with exact release/dist and no `user.geo`. Stage B uses a different clean commit and custom ID, removes both mechanisms and every reference, proves absence in the source tree and final Build Output, and deploys a separate trigger-free production-candidate Preview. Record internal Vercel deployment-record IDs separately. Only the Stage-B commit is eligible to merge; never target, promote, alias, reconfigure, or intentionally trigger Production.
12. Before merge eligibility, use deterministic no-deploy fixtures to prove the existing automatic Production build path can preserve the same custom browser/upload/Build Output identity and fail-closed transaction. If actual Vercel Production packaging cannot honor the custom ID, stop; do not change Production, fall back to its internal record ID, or weaken the source-map gate.

## Validation Strategy

- Unit tests verify the exact 11.8.0 initialization surface, installed integration names, browser errors, `Error` and primitive unhandled rejections, bootstrap failures, raw/string-body HTTP 4xx exclusion, duplicates, stable privacy-safe grouping material, all prohibited categories, sampling boundaries, malformed/disabled configuration, and monitoring failure isolation.
- Existing authentication, interceptor, Leaflet/map, live-service, historical replay, notification, and state behavior is checked across the complete absent, explicitly disabled, malformed/incomplete, valid-and-enabled, provider/transport-blocked, and internally failing monitoring matrix using the actual login, error-interceptor, vehicle-map, fleet-map, fleet-live-location, and vehicle-live-state test suites.
- Node build-contract tests use temporary fixture repositories, fixture `.vercel/output` trees, and mocked command execution to prove ordinary credential-free local/CI behavior; clean-HEAD release derivation and dirty-tree rejection; custom-ID syntax, reserved-prefix, length, mismatch, and collision rejection; browser/upload/config consistency; unconditional upload-failure blocking; cleanup after success and failure; complete final-output privacy scanning; exact prebuilt Preview command construction; and rejection of production-capable operations without contacting Sentry, Vercel, or Production.
- CI runs TypeScript checks, Angular tests, Node build tests, and the existing optimized build. Bundle budgets remain enforced.
- Preview verification follows both distinct clean-commit prebuilt stages in [quickstart.md](./quickstart.md): Stage A proves sanitized symbolication for the unexpected-error and unhandled-rejection cases, and Stage B proves the final candidate is trigger-free in source, `.vercel/output`, and deployed behavior. Emitted Stage-A events must satisfy [runtime-monitoring.md](./contracts/runtime-monitoring.md). The runbook also requires a safe timed disablement/recovery exercise and post-production read-only artifact probes.
- Compare at least five equivalent optimized-build/browser runs per variant; the median attributable regression must not exceed 5%.

## Future Emergency-Bypass Boundary

No operational decision blocks this implementation: source-map upload remains mandatory and fail-closed. Emergency bypass is explicitly outside scope and no bypass state, input, credential, or authorization adapter will be implemented. A future bypass requires its own approved GitHub issue, specification, threat review, owner-controlled deployment mechanism, and audit design.

## Complexity Tracking

No constitution violations require justification.
