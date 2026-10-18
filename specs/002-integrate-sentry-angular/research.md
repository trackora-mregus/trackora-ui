# Phase 0 Research: Privacy-Safe Angular Error Monitoring

## SDK and capture boundary

**Decision**: Pin `@sentry/angular@11.8.0`, whose published peer range covers Angular 14–22 and RxJS 6–7, and `@sentry/cli@3.8.0` (Node 18+, compatible with the repository's Node 22 build). Use the SDK's verified public APIs: `init(BrowserOptions): Client | undefined`, `getDefaultIntegrations()`, `createErrorHandler(ErrorHandlerOptions)`, `SentryErrorHandler`, and `captureException`. Initialize before `bootstrapApplication`. Keep Angular 21's existing `provideBrowserGlobalErrorListeners()` as the sole browser-global route and wrap/subclass `SentryErrorHandler` to inspect the raw error before delegating eligible values. Explicitly capture the bootstrap rejection consumed by `main.ts`, then retain its current console fallback.

**Rationale**: Angular officially documents that this provider forwards window `error` and `unhandledrejection` to the root `ErrorHandler`. Sentry 11.8.0 defaults include `GlobalHandlers` with both listeners enabled, so retaining it would create a parallel path. Its Angular defaults deliberately omit `BrowserApiErrors`. Its built-in handler can unwrap `HttpErrorResponse`, including constructing a message from a string response body; its extractor cannot suppress capture because a falsy result becomes `Handled unknown error`. Raw classification must therefore precede delegation. The CLI adds debug IDs and uploads artifacts without replacing Angular's application builder.

**Alternatives considered**: Keeping both global-listener systems relies on SDK deduplication after duplicate capture. Using `createErrorHandler` directly cannot safely exclude raw 4xx values. Reimplementing Sentry event creation or adding a custom webpack builder is unnecessary. SDK object marking and `Dedupe` remain defenses, not the primary invariant.

## Exact 11.8.0 integrations and grouping

**Decision**: Derive an explicit allowlist from `getDefaultIntegrations()` and assert installed names through the returned client's public `getIntegrationNames()`. Keep exactly `EventFilters` and `Dedupe`; exclude `FunctionToString`, `ConversationId`, `Breadcrumbs`, `Console`, `GlobalHandlers`, `LinkedErrors`, `HttpContext`, `CultureContext`, and `BrowserSession`. Do not add `BrowserApiErrors`, replay, tracing, profiling, or logs. Retain sanitized exception type and the full safe application stack shape; replace values with stable typed placeholders and do not set a custom fingerprint initially.

**Rationale**: The exact 11.8.0 Angular default order is `EventFilters`, `FunctionToString`, `ConversationId`, `Breadcrumbs`, `Console`, `GlobalHandlers`, `LinkedErrors`, `Dedupe`, `HttpContext`, `CultureContext`, `BrowserSession`. The `integrations` array form is additive to defaults, so the implementation MUST use the callback form to replace defaults with only `EventFilters` and `Dedupe`; using a filtered array would silently retain `GlobalHandlers` and the ambient integrations. `FunctionToString` supports wrapped-function fidelity that this design does not need because `BrowserApiErrors` is absent. Removing linked errors avoids cause-chain leakage. Sentry grouping uses exception and stack information; an allowlisted exception type, safe placeholder, static bundle basename, line, and column preserve useful grouping without sensitive messages. Function names and URL path directories are omitted because they can contain identifiers. Unknown or identifier-bearing frames are dropped. `debug_meta.images[].code_file` receives the same sanitation as frame filenames.

**Alternatives considered**: A blacklist could silently admit future defaults. Custom fingerprints risk over-grouping. Redacting every value to one untyped string while dropping stack structure would collapse unrelated errors.

**Verified initialization options**: Inspection of the installed 11.8.0 declarations confirms that `sendDefaultPii` and the legacy `profilesSampleRate` are not members of this version's `BrowserOptions`; including them would be an untyped, ignored, and misleading control. The approved options use public `dsn`, `environment`, `release`, `dist`, `sampleRate`, `attachStacktrace: true`, `sendClientReports: false`, `maxBreadcrumbs: 0`, `enhanceFetchErrorMessages: false`, callback-form `integrations`, `beforeSend`, and a complete `dataCollection` denial (`userInfo: false`, `cookies: false`, `httpHeaders: false`, `httpBodies: []`, `urlQueryParams: false`, both GraphQL fields false, both generative-AI fields false, `databaseQueryData: false`, `queues: false`, `stackFrameVariables: false`, `frameContextLines: 0`). `profileSessionSampleRate`, `tracesSampleRate`, and `tracesSampler` remain undefined, and no replay/profile/log integrations are present. Stack attachment gives primitive rejections capture-site grouping material while their original values are replaced. In 11.8.0, integration processors and `beforeSend` execute before error `sampleRate`; a thrown `beforeSend` is caught and drops the event.

## Expected-error filtering

**Decision**: Classify before capture with typed exclusion reason codes for `http-4xx`, `cancellation`, `authentication-expiry`, `authorization-denial`, `validation-failure`, `handled-outcome`, and `routine-reconnect`, plus internal `duplicate`, `monitoring-disabled`, and `monitoring-failure` outcomes. Do not add captures to HTTP interceptors, STOMP callbacks, notifications, or console methods. Use final event processing as defense in depth.

**Rationale**: Current 4xx notifications and STOMP reconnect callbacks are normal application behavior. Pre-capture exclusion prevents quota use and preserves existing handling.

**Alternatives considered**: `beforeSend`-only filtering does unnecessary work. Capturing all 5xx responses in the interceptor could duplicate failures and exceeds unexpected-error scope.

## Privacy policy

**Decision**: Explicitly disable every Sentry v11.8 `dataCollection` category (including `userInfo: false`), remove ambient-context integrations, and construct a new event in `beforeSend` from a strict allowlist. Do not add the unsupported `sendDefaultPii` property. Retain only event identity/time, fixed environment/release, minimal verified SDK/platform data, allowlisted exception type, constant-redacted value, sanitized stack coordinates, and debug metadata. Drop on uncertainty or sanitizer failure. Treat the final normalized provider event—not the browser envelope—as the privacy acceptance boundary. Before any enabled monitored build, query the fixed Sentry project read-only and require both project IP scrubbing and explicit pre-storage `remove anything` rules for every `user.geo` field; fail closed without changing provider settings.

**Rationale**: SDK defaults can collect browser context. An allowlist is safer than recursively deleting a denylist and retains only symbolication essentials. Stage-A evidence proved that Sentry ingestion can derive normalized geographic context from network metadata even when the serialized browser envelope has no `user` and requests `infer_ip: never`; server-side controls and normalized-event inspection are therefore mandatory defense in depth. IP scrubbing alone is not accepted as proof that derived geographic fields are absent.

**Alternatives considered**: Regex-only redaction cannot prove nested values safe. Original messages, URLs, request context, breadcrumbs, extras, tags, users, frame variables, and source context can all disclose prohibited data.

## Configuration and sampling

**Decision**: Monitoring is deployment-configured and fail-closed. Normal local/CI is off/0 and requires neither deployment metadata nor credentials; production begins at 0.25 only when explicitly enabled; isolated acceptance preview uses 1.0. Values must be finite within `[0,1]`. Missing or malformed runtime configuration means no `Sentry.init` call. Conversely, an explicitly enabled monitored build with a dirty/uncommitted tree, invalid release, invalid custom Build Output deployment ID, missing DSN, or missing upload credential exits nonzero before a publishable artifact can be produced.

**Rationale**: This follows the clarified policy, avoids SDK instrumentation when unused, keeps preview acceptance deterministic, and prevents configuration defects from breaking startup. Classification precedes capture; `beforeSend` precedes SDK random sampling and transport.

**Alternatives considered**: A remote runtime switch adds infrastructure and trust boundaries. Production 100% is unnecessary for the initial free-tier budget.

## Vercel build, immutable release, and prebuilt identity

**Decision**: Route the existing `npm run build` through a narrow Node wrapper with exactly two successful terminal states: `disabled` or `enabled-prebuilt-ready`; reject every other state. A normal local/CI invocation takes the disabled path and preserves the current build without network access. Trusted monitored builds require a clean committed worktree, derive the full SHA directly from `git rev-parse HEAD`, and reject an arbitrary supplied SHA. They compute exactly once `release = trackora-ui@<full HEAD SHA>` and a unique Vercel-supported custom Build Output deployment ID as `dist`. Generate the ID as `trk-` plus 28 lowercase hexadecimal characters from 14 cryptographically random bytes (32 characters total). The validator enforces Vercel's broader 1–32-character ASCII letter/digit/hyphen/underscore contract, rejects reserved `dpl_`, and rejects reuse within the local Stage/evidence set; Vercel's own project-level duplicate rejection remains the authoritative hosted collision guard. Browser constants, Sentry CLI upload arguments, and `.vercel/output/config.json` receive the exact generated value. The server-generated internal `dpl_...` deployment-record ID is recorded separately and never used as Sentry `dist`.

**Rationale**: A server-generated deployment-record ID does not exist when a local prebuilt bundle and its source maps are created. Vercel's Build Output API supports a caller-generated custom `deploymentId` precisely so a prebuilt deployment can use a stable build-time identity. Git `HEAD`, rather than a variable, anchors the release to reviewed content; cleanliness proves the build contains no uncommitted delta. One validated derivation prevents browser/upload/package drift, while a different unique `dist` distinguishes Stage A, Stage B, and repeated deployments of the same revision.

**Alternatives considered**: Shared Preview variables would expose the upload token to every unassigned branch build. A remote build in a separate verification project reduces branch exposure but still stores the token remotely and rebuilds rather than deploying the locally inspected artifact. A post-deploy upload can race publication. The internal `dpl_...` record ID is unavailable before local compilation. Timestamps, short SHAs, aliases, and package versions provide weaker source correlation.

## Trusted local-prebuilt Preview workflow

**Decision**: The isolated verification path runs from an access-controlled local executor and supplies `SENTRY_AUTH_TOKEN` from an approved secret provider only to the source-map upload process. It pins Vercel CLI `64.5.0`, which is above the documented `>50.3.3` custom-ID requirement and reads the current per-project `orgId` repository-link schema with a legacy top-level fallback, without adding it as an application dependency. Missing or ambiguous organization identities fail closed before deployment invocation. The workflow produces `.vercel/output`, writes and validates the exact custom `deploymentId`, recursively scans the complete output, and invokes only Vercel's explicit prebuilt Preview deployment path. It never downloads or stores the token in a project `.env` file, places it in a CLI argument or deployment metadata, or adds it to shared Preview variables. Verification commands prohibit `--prod`, promotion, production aliases, and Production-variable mutation.

**Rationale**: `vercel deploy --prebuilt` uploads `.vercel/output` without rebuilding, so the reviewed bytes are the deployed bytes and the upload token is not needed by Vercel. Scanning only Angular's intermediate `dist` is insufficient because the packaging step creates the final deployable tree. Explicit Preview targeting prevents an ambiguous CLI default from becoming a production-capable operation.

**Alternatives considered**: Branch-scoped Preview secrets are unavailable in the confirmed Hobby configuration. Supplying a token through `--build-env` or other command arguments risks shell history, process-list, or remote-build exposure. A Git-connected separate project is unnecessary if the exact protected prebuilt deployment can use the existing project; a Git-disconnected isolated project remains a fallback only if Preview access protection or Build Output compatibility cannot be established.

## Source-map lifecycle and promotion gate

**Decision**: Enabled monitored builds generate hidden script maps, resolve the configured Angular browser output, and create an in-memory manifest of only JS/map pairs generated by that invocation. They use CLI 3.8.0 debug-ID injection and source-map upload with `--validate` plus the exact release/dist, treating any nonzero result as failure. A `finally`-equivalent path deletes only manifested maps beneath the canonical output root after success or failure. Packaging then produces `.vercel/output` with the exact custom deployment ID. A recursive final-output scan rejects maps, `sourceMappingURL`, symlinks/path escape, credentials or privileged values, sensitive fixture values, and stage-forbidden verification symbols before the only monitored success state, `enabled-prebuilt-ready`. Upload, cleanup, packaging, identity validation, or final-scan failure always exits nonzero.

**Rationale**: Hidden maps alone may remain guessable. CLI 3.8.0 exposes debug-ID injection, distribution-aware upload, validation, and rejects nonzero commands. Canonical path containment prevents broad cleanup, cleanup-on-failure avoids residue, and upload-before-package plus complete Build Output assertions prevents a later packaging step from silently reintroducing unsafe content. Hosted preview symbolication remains the final server-processing proof because CLI acceptance alone cannot prove that a future event resolves correctly.

**Alternatives considered**: Upload-after-deploy violates promotion requirements; leaving hidden maps deploys source; a CI-only gate cannot guarantee the exact Vercel output.

## Emergency bypass boundary

**Decision**: This feature implements no emergency bypass. Source-map upload or validation failure always blocks an enabled preview or production build. No GitHub URL, approval record, repository input, Vercel variable, token, or other build input is recognized as bypass authorization.

**Rationale**: The current auto-deploy architecture has no independently protected approval mechanism that this feature can rely on without introducing new privileged deployment infrastructure. Hard-disablement is the only unambiguous fail-closed state and prevents a failed upload from appearing as a successful monitored release.

**Future work**: If Trackora needs emergency promotion during a Sentry outage, create a separate GitHub issue and specification for an owner-controlled deployment mechanism. That work must define threat boundaries, approver identity, protected control-plane enforcement, audit evidence, expiry, rollback, and tests before any bypass state or input is added.

## CI and testing

**Decision**: Add deterministic Angular tests, Node build-contract tests with mocked commands/temp fixtures, type checking, and the ordinary optimized build to the existing workflow. Give GitHub CI no Sentry token. Use a mocked SDK/custom transport rather than the community `sentry-testkit` dependency.

**Rationale**: CI validates privacy, duplicate prevention, disabled behavior, failure isolation, release binding, bounded deletion, and mandatory upload-failure blocking without privileged access. Vercel enforces its own source-map transaction.

**Alternatives considered**: Real provider calls in unit tests are nondeterministic and leak credentials. Uploading from pull-request CI expands secret exposure.

## Synthetic verification and operations

**Decision**: On a protected isolated preview, build a clean committed Stage-A revision containing a clearly named one-shot synthetic unexpected error and a separate one-shot unhandled promise rejection through real initialization at 100% sampling. Deploy its exact sanitized prebuilt output and verify exactly one event per case. Remove both mechanisms in a distinct clean Stage-B commit, generate a different custom deployment ID, rebuild and rescan `.vercel/output`, deploy a separate trigger-free prebuilt Preview, and verify absence in source and final bundles. Record both Git SHAs, custom IDs, internal Vercel record IDs, Preview URLs, and artifact evidence without secrets. Validate production's 25% setting via tests/config inspection only. After an authorized production deployment, perform read-only public-artifact probes without generating a production error.

**Rationale**: This proves the hosted path without a persistent endpoint or intentional production error. A dated operations runbook can track the changing free-tier quota, 20% normal target, and 50% action threshold.

**Alternatives considered**: A DevTools throw does not prove optimized application symbolication. A permanent route/button/query trigger violates scope. Local-only testing cannot prove Vercel release matching.

## Primary references

- [Sentry Angular setup](https://docs.sentry.io/platforms/javascript/guides/angular/install/)
- [Pinned Angular 11.8.0 SDK source](https://github.com/getsentry/sentry-javascript/blob/11.8.0/packages/angular/src/sdk.ts)
- [Pinned Angular 11.8.0 error handler source](https://github.com/getsentry/sentry-javascript/blob/11.8.0/packages/angular/src/errorhandler.ts)
- [Pinned GlobalHandlers source](https://github.com/getsentry/sentry-javascript/blob/11.8.0/packages/browser/src/integrations/globalhandlers.ts)
- [Angular browser global error listeners](https://angular.dev/api/core/provideBrowserGlobalErrorListeners)
- [Filtering and `beforeSend`](https://docs.sentry.io/platforms/javascript/guides/angular/configuration/filtering/)
- [Configuration and data collection](https://docs.sentry.io/platforms/javascript/guides/angular/configuration/options/)
- [Sensitive data](https://docs.sentry.io/platforms/javascript/guides/angular/data-management/sensitive-data/)
- [JavaScript source maps](https://docs.sentry.io/platforms/javascript/sourcemaps/)
- [CLI source-map upload](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/cli/)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Vercel local builds](https://vercel.com/docs/cli/build)
- [Vercel prebuilt deployment](https://vercel.com/docs/cli/deploy)
- [Vercel custom Build Output deployment IDs](https://vercel.com/docs/skew-protection#custom-deployment-id)
- [Vercel access roles](https://vercel.com/docs/rbac/access-roles)
- [Vercel Activity Log](https://vercel.com/docs/activity-log)

Repository evidence: `src/main.ts`, `src/app/app.config.ts`, `src/app/core/interceptors/`, `src/app/core/services/*-live.service.ts`, `angular.json`, `package.json`, `.github/workflows/frontend-ci.yml`, and the backend Sentry specification/contract inspected through GitHub.
