# Feature Specification: Privacy-Safe Frontend Error Monitoring

**Feature Branch**: `[feature/2-integrate-sentry-angular]`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "Integrate Sentry with the Trackora Angular frontend under GitHub Issue #2, with strict privacy controls, conservative error sampling, private source maps, Vercel environment and release identification, safe verification, and no change to existing application behavior."

## Problem Statement

Trackora's production frontend currently provides user-facing error notifications and browser-console diagnostics but has no centralized, release-aware record of unexpected browser failures. Operators therefore cannot reliably connect a reported failure to the affected deployment and original source location. Monitoring must improve diagnosis without sending fleet, vehicle, authentication, location, or telemetry data to the monitoring provider and without becoming a new failure mode for the application.

## Clarifications

### Session 2026-10-16

- Q: Should a failed production source-map upload block the production deployment? → A: Yes. Keep the gate mandatory and fail closed. An emergency bypass is not implemented by this feature and requires a separately approved future issue and owner-controlled deployment design.
- Q: Should normal monitoring disablement require a Vercel configuration change followed by a new deployment, rather than introducing a remotely controlled runtime switch? → A: Use Vercel configuration and redeployment normally; reserve provider-side project or key shutdown for emergencies.
- Q: Should deterministic end-to-end acceptance use 100% sampling only in an isolated preview, while production's 25% sampling is validated through configuration and automated tests without intentionally triggering a production error? → A: Use 100% sampling for isolated-preview acceptance; validate production's 25% policy through configuration and automated tests without intentional production errors.

### Session 2026-10-17

- Q: How can isolated Preview verification keep `SENTRY_AUTH_TOKEN` out of Preview variables shared by unrelated branches? → A: Build in a trusted local environment, upload and validate private source maps there, remove them from deployable artifacts, package the exact sanitized output through Vercel's supported Build Output API, and explicitly deploy that output only to Preview.
- Q: What identifies a locally prebuilt deployment before Vercel has assigned its internal deployment-record ID? → A: Generate a unique Vercel-supported custom Build Output deployment ID before compilation and use it unchanged as the Sentry `dist`, browser distribution, and `.vercel/output/config.json` `deploymentId`. The internal server-generated `dpl_...` record ID is separate evidence and is not the Sentry distribution.
- Q: What establishes the release source revision? → A: The trusted workflow derives the full SHA from a clean committed `git HEAD`, rejects a dirty or uncommitted source tree, and does not accept a caller-supplied SHA as authority.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Diagnose Unexpected Frontend Failures Safely (Priority: P1)

As a Trackora maintainer, I can see unexpected frontend failures with their deployment environment, release, and readable source location, so I can diagnose production defects without reproducing every report locally or receiving sensitive customer data.

**Why this priority**: Actionable, privacy-safe error visibility is the central value of this feature and the reason monitoring is being introduced.

**Independent Test**: In one isolated nonproduction build, trigger the named synthetic unexpected error and named unhandled promise rejection independently; confirm exactly one monitoring event per case with the expected environment, release, and readable application frame, and verify that prohibited data is absent.

**Acceptance Scenarios**:

1. **Given** monitoring is configured in an isolated preview, **when** an unexpected application error occurs, **then** exactly one error event is accepted with the correct environment and immutable release identifier.
2. **Given** an unhandled promise rejection occurs, **when** monitoring is enabled, **then** the rejection is reported once and existing application error behavior remains unchanged.
3. **Given** application bootstrap fails after monitoring can initialize, **when** the failure is observed, **then** the failure is reported once without replacing the existing fallback diagnostic behavior.
4. **Given** a captured event originated from optimized application code, **when** a maintainer opens it, **then** its application frames resolve to the original source file, function, and line.
5. **Given** an error contains prohibited data in its message, context, URL, or attached values, **when** the event is prepared for transmission, **then** that data is removed or irreversibly redacted before leaving the browser.

---

### User Story 2 - Preserve Normal Application Behavior (Priority: P1)

As a fleet operator, I continue using authentication, fleet and vehicle views, maps, live telemetry, alerts, and history normally whether monitoring is enabled, disabled, unavailable, or failing.

**Why this priority**: Observability is secondary to the production product and must never interrupt fleet-monitoring workflows or alter their semantics.

**Independent Test**: Exercise representative REST, authentication, map, and live-update flows with monitoring enabled, omitted, blocked, and forced to fail; verify identical user-visible outcomes and no uncaught monitoring failure.

**Acceptance Scenarios**:

1. **Given** monitoring configuration is absent, invalid, or explicitly disabled, **when** the application starts, **then** it starts normally and sends no monitoring traffic.
2. **Given** the monitoring provider is unavailable or rejects an event, **when** an application error occurs, **then** the monitoring failure remains isolated and does not change navigation, notifications, state, or recovery behavior.
3. **Given** an expected client-side HTTP response or a routine live-connection reconnect occurs, **when** existing application handling runs, **then** no monitoring error event is sent.
4. **Given** an existing user-facing error path runs, **when** the underlying error is eligible for monitoring, **then** the existing notification appears once and monitoring adds no duplicate user notification or duplicate event.

---

### User Story 3 - Operate Monitoring Within Privacy and Cost Limits (Priority: P2)

As the Trackora owner, I can control whether error monitoring is enabled and how many eligible events are accepted per environment, so production visibility stays proportionate to privacy, performance, and free-tier constraints.

**Why this priority**: Explicit controls prevent unexpected data transfer, noise, and quota consumption while preserving useful production diagnostics.

**Independent Test**: Apply representative environment configurations and a deterministic stream of eligible and excluded failures; verify enablement, sampling, environment separation, exclusion rules, and documented usage estimates.

**Acceptance Scenarios**:

1. **Given** local development uses default configuration, **when** errors occur, **then** monitoring remains disabled and production data is not polluted.
2. **Given** production or preview monitoring is enabled, **when** an eligible error occurs, **then** the configured error-event sampling rate for that environment is applied.
3. **Given** an HTTP 4xx response, normal live-connection reconnect, or routine application activity occurs, **when** monitoring evaluates it, **then** it is excluded before sampling and consumes no error-event quota.
4. **Given** monitoring volume approaches its documented budget, **when** the owner reviews usage, **then** the sampling configuration and rollback procedure provide a way to reduce or stop new browser events without an application-code rollback.

---

### User Story 4 - Release and Roll Back Monitoring Safely (Priority: P2)

As a release owner, I can deploy monitoring through the existing Vercel workflow, keep upload credentials private, verify a nonproduction release, and disable or roll back monitoring without exposing source maps or changing backend contracts.

**Why this priority**: Main-branch changes deploy production automatically, so release identification, secret handling, validation, and recovery must be explicit before merge.

**Independent Test**: Build an isolated preview with a protected upload credential, verify the matching release and private source maps, confirm public source-map requests fail, and exercise the documented disable-and-rollback procedure.

**Acceptance Scenarios**:

1. **Given** a preview or production build, **when** source maps are uploaded, **then** the upload uses a protected build-time credential that is absent from browser bundles, generated application files, logs, and repository history.
2. **Given** a browser error and its uploaded artifacts, **when** maintainers inspect the release, **then** the browser event and source maps use the same immutable release identifier.
3. **Given** a deployed application, **when** an unauthenticated client requests a generated source-map artifact, **then** the artifact is not publicly retrievable where the build platform permits private upload without public serving.
4. **Given** monitoring causes unexpected noise, overhead, or operational risk, **when** the documented normal disable procedure changes the environment-scoped Vercel configuration and redeploys, **then** new monitoring traffic stops without breaking the application; provider-side project or key shutdown is available only as an emergency fallback, and deployment rollback remains available if needed.
5. **Given** a production source-map upload fails, **when** the deployment pipeline evaluates the release, **then** production deployment is blocked and no repository, build-variable, or approval-reference input can convert that failure into a successful monitored release.

### Edge Cases

- The monitoring data source name is present but blank, malformed, or for the wrong project.
- The enable flag is on while the environment, release, or sampling value is missing or invalid.
- A release identifier is unavailable in a local build or an isolated preview.
- The same exception reaches both a framework-level handler and a browser-level unhandled-error hook.
- A rejected promise wraps an HTTP 4xx response that has already been handled by the existing interceptor.
- An error message embeds a bearer token, reset token, email address, vehicle or fleet identifier, coordinate pair, request payload, or sensitive URL segment.
- An exception object has circular values, custom properties, or nonstandard causes that the sanitizer cannot safely inspect.
- A WebSocket/STOMP reconnect emits transient errors repeatedly before reconnecting successfully.
- A malformed live message contains raw telemetry or a subscription destination containing a fleet identifier.
- The monitoring library, transport, sanitizer, or source-map upload fails independently of the application build or runtime.
- The trusted prebuilt workflow is run from a dirty tree, detached content that does not match `HEAD`, or an uncommitted verification mechanism.
- A custom Build Output deployment ID is malformed, uses the reserved `dpl_` prefix, exceeds 32 characters, or is reused for another deployment.
- Vercel packaging introduces a source map, source-map reference, credential marker, sensitive fixture value, or temporary verification symbol after the Angular output was cleaned.
- Event volume spikes from a repeated defect and threatens the monthly monitoring budget.
- Public artifact probing uses guessed hashed filenames, direct map URLs, or source map comments in generated scripts.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The frontend MUST use the official Angular error-monitoring integration that declares compatibility with the repository's installed framework and reactive-library versions at implementation time.
- **FR-002**: Monitoring MUST use the existing `trackora-ui` project in the verified Trackora organization; creating another frontend or backend monitoring project is outside this feature.
- **FR-003**: Monitoring MUST capture unexpected framework errors, unhandled browser errors, unhandled promise rejections, and eligible bootstrap failures when configured and enabled.
- **FR-004**: A single logical failure MUST produce no more than one accepted error event even when it passes through multiple framework, browser, promise, or bootstrap handlers.
- **FR-005**: Existing user-facing notifications, browser fallback diagnostics, application error propagation, and recovery behavior MUST remain functionally unchanged.
- **FR-006**: HTTP responses with status codes from 400 through 499 MUST be excluded from monitoring as expected application responses.
- **FR-007**: Normal WebSocket/STOMP disconnects, reconnect attempts, reconnect success, subscription lifecycle activity, and other routine application activity MUST be excluded from error monitoring.
- **FR-008**: Expected errors MUST be classified through typed exclusion categories for `http-4xx`, `cancellation`, `authentication-expiry`, `authorization-denial`, `validation-failure`, `handled-outcome`, and `routine-reconnect`. Each category MUST be excluded before capture and MUST NOT be reported as an unexpected error.
- **FR-009**: Monitoring MUST be disabled by default for local development and MUST send no events unless a complete, valid environment configuration explicitly enables it. Normal production disablement MUST use an environment-scoped Vercel configuration change followed by redeployment and MUST NOT introduce a remotely controlled application runtime switch.
- **FR-010**: Missing, malformed, partial, or disabled monitoring configuration MUST fail closed for telemetry and MUST NOT prevent application startup or operation.
- **FR-011**: Failures inside initialization, sanitization, sampling, transport, or monitoring callbacks MUST be contained and MUST NOT interrupt application behavior or recursively generate monitoring events.
- **FR-012**: Before transmission, every event MUST pass through a centralized, testable, allowlist-based sanitization boundary.
- **FR-013**: No password, access token, refresh token, reset token, JSON Web Token, authorization header, cookie, session value, credential, or secret MAY leave the browser through monitoring.
- **FR-014**: No GPS coordinate, raw telemetry value or payload, trip/history payload, vehicle identifier, fleet identifier, device identifier, document content, sensitive request body, or authenticated WebSocket message MAY leave the browser through monitoring.
- **FR-015**: Monitoring MUST NOT attach user-identifying context automatically, including names, email addresses, account identifiers, IP-address-derived identity, or persistent user/session identifiers.
- **FR-016**: Request and response bodies, headers, cookies, query strings, form values, local or session storage values, and arbitrary application extras MUST be removed rather than transmitted.
- **FR-017**: URLs MUST be reduced to an approved nonsensitive origin and route shape; query strings, fragments, credentials, identifiers, reset-token paths, and other sensitive path values MUST be removed or replaced before transmission.
- **FR-018**: Exception messages and custom values MUST be redacted or the event dropped when prohibited data cannot be proven absent; sanitization uncertainty MUST fail closed.

FR-013 and FR-014 define prohibited credential/identity and Trackora domain data respectively; FR-016 defines prohibited ambient request, response, form, and browser-storage containers; FR-017 governs URL reduction; and FR-018 governs fail-closed handling when the sanitizer cannot prove safety. These responsibilities are cumulative rather than interchangeable.

- **FR-019**: Session Replay, distributed tracing, performance transactions, profiling, browser breadcrumbs, console capture, network payload capture, and automatic user context MUST be disabled for the initial release.
- **FR-020**: Only error events and the minimum metadata required to identify the application, environment, release, exception type, and readable source location MAY be transmitted initially.
- **FR-021**: Error-event sampling MUST be configurable independently by environment, MUST reject invalid values safely, and MUST be applied only after exclusion and sanitization eligibility are determined.
- **FR-022**: The initial production error-event sampling rate MUST default to 25%, local development MUST default to 0%, and deterministic end-to-end acceptance MUST use 100% sampling only in an isolated preview. Production's 25% sampling policy MUST be validated through deterministic automated tests and deployment-configuration inspection rather than by intentionally triggering production errors. Any override MUST remain within the inclusive range from 0% to 100%.
- **FR-023**: Every accepted event MUST identify an explicit deployment environment and immutable release; production, Vercel preview, and local verification data MUST be distinguishable.
- **FR-024**: The release identifier MUST be `trackora-ui@<full-git-head-sha>`, where the SHA is derived by the trusted build from the actual clean, committed Git `HEAD`; a caller-supplied SHA MUST NOT be accepted as authority. The same release MUST be used for browser events, source-map uploads, Build Output evidence, and the deployed revision.
- **FR-025**: Browser-visible configuration MUST contain only values safe for public inspection. The event-ingestion address MAY be browser-visible; source-map upload credentials and other privileged tokens MUST NOT be browser-visible.
- **FR-026**: Source maps for optimized preview and production builds MUST be uploaded privately to the matching monitoring release using a protected build-time credential.
- **FR-027**: Source-map upload credentials MUST NOT appear in source files, frontend environment files, generated browser bundles, build output, logs, test fixtures, committed configuration, or repository history.
- **FR-028**: Production source maps MUST NOT be publicly served when the build and hosting pipeline can upload them privately and then exclude them from deployment artifacts; implementation planning MUST document and verify the chosen mechanism.
- **FR-029**: A failed production source-map upload MUST block production deployment, MUST be visible to release owners without exposing credentials, and MUST NOT be converted to success by any repository value, URL, approval reference, Vercel variable, or other build input. This feature MUST NOT implement an emergency bypass. Any future owner-controlled bypass requires a separate approved GitHub issue, specification, threat review, and deployment-control design before implementation.
- **FR-030**: Automated tests MUST cover sanitization of every prohibited data category, URL reduction, every typed expected-error exclusion category from FR-008, duplicate-event prevention, sampling boundaries, disabled and malformed configuration, and failure isolation.
- **FR-031**: Automated tests MUST use a mocked monitoring boundary and MUST verify that existing notification, REST, authentication, WebSocket, Leaflet, telemetry, and application-state behavior is not changed by monitoring paths.
- **FR-032**: Formal end-to-end acceptance MUST use two clearly named, one-shot cases in the same isolated preview through the real application initialization path with error-event sampling set to 100%: one synthetic unexpected error and one unhandled promise rejection. A local dry run MAY precede preview verification but does not replace it.
- **FR-033**: Both synthetic verification mechanisms MUST be unavailable in public production, MUST NOT expose a public error endpoint or persistent user-facing trigger, and MUST be removed before the final production-candidate preview. Their absence MUST be verified in the final source tree and generated browser bundles.
- **FR-034**: Isolated-preview verification MUST confirm exactly one event for each of the two synthetic acceptance cases, the expected preview environment and release, readable original source frames, the absence of all prohibited data, and the inability to retrieve deployed source maps publicly. Production acceptance MUST inspect the 25% sampling configuration, pass deterministic sampling tests, and perform only read-only public-artifact checks without intentionally generating a production error.
- **FR-035**: Operational documentation MUST identify configuration ownership, monitoring ownership, alert review, environment and release naming, protected build secrets, verification steps, expected event volume, quota review, deployment sequencing, the normal Vercel-configuration-and-redeployment disable procedure, emergency provider-side project or key shutdown, rollback steps, and incident escalation.
- **FR-036**: Expected free-tier usage MUST be documented as a monthly budget based on the provider's then-current included error-event quota, with an initial target not exceeding 20% of that quota during normal operation and an action threshold at 50%.
- **FR-037**: The initial release MUST NOT add monitoring alerts, paging, backend monitoring changes, Session Replay, tracing, profiling, analytics, user tracking, or additional application logging unless separately reviewed and approved.

FR-019 controls which Sentry SDK collection capabilities are disabled in the initial runtime configuration. FR-037 separately defines feature-scope exclusions and prevents adjacent monitoring, backend, analytics, or logging work from entering this change.

- **FR-038**: The integration MUST preserve existing Angular, REST, authentication, WebSocket/STOMP, Leaflet, vehicle/fleet authorization, live telemetry, history replay, and Vercel deployment behavior.
- **FR-039**: No unrelated dependency, framework, state-management system, transport abstraction, application refactor, backend contract change, or production-secret change MAY be introduced.
- **FR-040**: The production build MUST remain within existing bundle budgets, and measured startup and routine interaction performance MUST not regress by more than 5% in repeatable before-and-after checks attributable to monitoring.
- **FR-041**: Sentry `dist` MUST be a unique Vercel-supported custom Build Output deployment ID generated before compilation, not Vercel's internal server-generated deployment-record ID. It MUST be 1–32 characters, contain only ASCII letters, digits, hyphen, or underscore, MUST NOT begin with `dpl_`, and MUST NOT be reused within the Vercel project.
- **FR-042**: The exact custom deployment ID MUST be used unchanged in browser Sentry configuration, private source-map upload, and `.vercel/output/config.json` as `deploymentId`; any absence or mismatch MUST block the monitored artifact.
- **FR-043**: Trusted isolated-preview verification MUST build and upload source maps locally, remove them before packaging completes, and deploy the exact sanitized `.vercel/output` through Vercel's supported prebuilt mechanism without a Vercel rebuild.
- **FR-044**: Before prebuilt Preview deployment, the complete `.vercel/output` MUST be recursively checked for source maps, `sourceMappingURL` references, credentials or privileged variable values, sensitive fixture values, path escape or symlinks, and temporary verification code forbidden for the applicable stage. Any finding MUST block deployment.
- **FR-045**: Trusted prebuilt deployment MUST explicitly target Preview and MUST prohibit Production targeting, `--prod`, promotion, Production aliases, and Production-variable changes. No command in the verification workflow may authorize or imply a production deployment.
- **FR-046**: For trusted prebuilt Preview verification, `SENTRY_AUTH_TOKEN` MUST be supplied only to the local source-map upload process from an approved secret provider; Production retains its separately protected build-secret scope. The token MUST NOT be stored in Git, frontend environment files, generated browser files, `.vercel/output`, shell command arguments, deployment metadata, logs, or shared Vercel Preview variables.
- **FR-047**: Automated build-contract tests MUST deterministically cover clean-HEAD release derivation, dirty-tree rejection, custom deployment-ID validation and collision rejection, release/dist consistency, Build Output configuration, exact prebuilt packaging, final-output scanning, cleanup after success and failure, explicit Preview targeting, and rejection of every production-capable operation without deploying or contacting Production.
- **FR-048**: Stage A and Stage B MUST be separate clean commits and separate prebuilt Preview deployments with different custom deployment IDs. Evidence MUST record both Git SHAs, custom deployment IDs, internal Vercel deployment-record IDs, Preview URLs, artifact scans, and stage-specific trigger presence or absence without recording secrets.

### Key Entities

- **Error Event**: One eligible unexpected frontend failure containing only an exception classification, sanitized message, readable application frames, environment, release, and other explicitly allowed diagnostic metadata.
- **Monitoring Configuration**: Publicly inspectable enablement, ingestion destination, environment, release, and error-sampling values; incomplete or invalid configuration disables telemetry.
- **Sanitization Policy**: The fail-closed allowlist and exclusion rules applied before an event may leave the browser.
- **Deployment Environment**: An explicit label separating production, isolated preview, and local verification events.
- **Release Identifier**: An immutable deployment revision shared by browser events and privately uploaded source maps.
- **Custom Build Output Deployment ID**: A unique pre-build Vercel identifier shared unchanged by browser `dist`, Sentry artifact `dist`, and Build Output `deploymentId`; distinct from Vercel's internal `dpl_...` deployment-record ID.
- **Prebuilt Preview Artifact**: The exact `.vercel/output` tree produced from a clean committed revision after private source-map upload, bounded cleanup, Build Output configuration, and final privacy/artifact scanning.
- **Source-Map Artifact**: Build output used privately by maintainers to restore original source locations; it is not a public application asset.
- **Synthetic Verification Error**: A temporary, nonproduction-only failure used to verify the real capture and symbolication path without exposing a production trigger.
- **Usage Budget**: The documented monthly error-event allowance, normal-use target, warning threshold, and response actions for the current service tier.

### Scope Boundaries

In scope are frontend error capture, privacy filtering, environment and release correlation, private source-map handling, nonproduction verification, automated regression coverage, and operational documentation. Backend monitoring already exists and requires no contract or implementation change.

Out of scope are Session Replay, tracing, profiling, metrics, logs, browser breadcrumbs, automatic user context, analytics, public diagnostic endpoints, backend changes, new alerting or paging automation, and unrelated application or infrastructure refactoring.

### Dependencies

- Existing GitHub Issue #2 and the Trackora frontend constitution govern scope and acceptance.
- The existing private Sentry project `trackora-ui` remains available to authorized maintainers.
- Vercel supports local Build Output generation, custom Build Output deployment IDs, explicit Preview targeting, and prebuilt deployment without rebuilding the uploaded output.
- Authorized maintainers can create a least-privilege source-map upload credential and inspect captured preview events.
- An authorized maintainer has a trusted local secret provider and can run the prebuilt workflow without placing the upload token in shared Vercel Preview variables or command arguments.
- The monitoring provider's current free-tier quota is confirmed when implementation and operational documentation are prepared.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In an isolated preview configured for 100% error-event sampling, 100% of synthetic unexpected errors and unhandled rejections produce exactly one accepted event, while 100% of excluded HTTP 4xx and routine reconnect scenarios produce zero events.
- **SC-002**: Across automated privacy tests covering every prohibited category, zero passwords, credentials, tokens, headers, cookies, personal identifiers, coordinates, telemetry, fleet or vehicle identifiers, sensitive bodies, or sensitive URLs appear in outbound event data.
- **SC-003**: The application starts and completes representative authentication, REST, map, and live-update workflows in 100% of tests where monitoring is absent, disabled, malformed, blocked, or internally failing.
- **SC-004**: Every verified preview and production event is assigned the intended environment, clean-HEAD release, and matching custom Build Output distribution, and 100% of sampled application frames resolve to an original source file, function, and line.
- **SC-005**: Public artifact checks retrieve zero source maps from the deployed preview and, after an authorized production deployment, from the production asset set, while authorized maintainers can use the privately uploaded artifacts for readable stack traces. Production verification is read-only and generates no intentional production error.
- **SC-006**: Monitoring-related production output stays within existing size limits, and repeatable startup and routine interaction measurements show no more than 5% degradation attributable to monitoring.
- **SC-007**: During normal operation, accepted error events remain at or below 20% of the current monthly free-tier allowance; reaching 50% triggers the documented sampling or disable response before quota exhaustion.
- **SC-008**: In a safe isolated preview or tabletop exercise that does not modify production configuration, a release owner demonstrates the normal Vercel-configuration-and-redeployment disable procedure in under 10 minutes and demonstrates identification of the provider-side emergency shutdown and prior deployment for rollback in under 5 minutes, with elapsed times recorded. The production runbook uses the same reviewed procedure.
- **SC-009**: Before production approval, maintainers complete distinct clean-commit Stage-A and Stage-B prebuilt Preview deployments showing exactly one sanitized event for the Stage-A synthetic unexpected error and exactly one for the unhandled promise rejection, exact clean-HEAD release/custom-dist correlation, readable source, private artifacts, a fully scanned `.vercel/output`, and no persistent verification trigger in the Stage-B candidate.
- **SC-010**: Existing automated tests and production build checks pass with zero changes to externally observable authentication, REST, WebSocket/STOMP, Leaflet, telemetry, history, notification, or authorization behavior.

## Assumptions

- The actual private GitHub repository is `trackora-mregus/trackora-ui`; the local `origin` still uses its former `mregus/trackora-ui` address and resolves through GitHub's repository redirect.
- GitHub Issue #2 remains the governing P1 DevOps issue for this feature.
- The frontend remains an Angular 21 standalone application using RxJS 7, and the current official Angular monitoring package declares compatibility with those versions.
- The existing `trackora-ui` monitoring project is correctly owned and does not need to be created or renamed.
- The browser ingestion destination is public by design, while any token capable of uploading artifacts or managing the monitoring account is a protected secret.
- Local development monitoring is opt-in only; normal local work sends no events.
- Production starts with 25% eligible-error sampling, local development defaults to 0%, and an isolated preview uses 100% only for deterministic acceptance verification. Production sampling is validated through automated tests and deployment configuration without an intentional production error. Owners may lower or disable these values through environment-scoped Vercel configuration and redeployment without changing application behavior; provider-side project or key shutdown is reserved for emergencies.
- Existing backend monitoring is privacy-safe and remains separate; no browser event is enriched with backend payloads or cross-service tracing in this feature.
- Existing user-facing error notifications remain the product experience; monitoring is an operational side channel only.
- Main-branch changes deploy production automatically, so implementation, isolated preview verification, privacy review, and source-map checks occur before merge.
