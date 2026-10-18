# Contract: Runtime Monitoring Boundary

## Capture matrix

| Source                                                  | Result                                               | Control                                                           |
| ------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| Unexpected Angular error                                | Capture once                                         | One custom Angular `ErrorHandler`.                                |
| Browser `error`/`unhandledrejection`                    | Capture once                                         | Existing Angular global listeners; Sentry global handlers absent. |
| Bootstrap rejection after initialization                | Capture once, then preserve current console fallback | Existing catch is the only path.                                  |
| HTTP 400–499                                            | Exclude                                              | Classifier and final event defense.                               |
| Cancellation                                            | Exclude                                              | Typed `cancellation` reason.                                      |
| Authentication expiry                                   | Exclude                                              | Typed `authentication-expiry` reason.                             |
| Authorization denial                                    | Exclude                                              | Typed `authorization-denial` reason.                              |
| Validation failure                                      | Exclude                                              | Typed `validation-failure` reason.                                |
| Explicitly handled outcome                              | Exclude                                              | Typed `handled-outcome` reason.                                   |
| Handled HTTP error/notification                         | No implicit capture                                  | Interceptor behavior unchanged.                                   |
| Routine STOMP reconnect/callback                        | Exclude                                              | No capture calls or console/breadcrumb capture.                   |
| Console/routine activity                                | Exclude                                              | Console and breadcrumb integrations absent.                       |
| Unexpected WebSocket application error reaching Angular | Capture once                                         | Same boundary and sanitizer.                                      |
| Monitoring/config/sanitizer failure                     | Drop and isolate                                     | Application handling continues.                                   |

No component, interceptor, live service, Leaflet integration, authentication service, or telemetry store may call the Sentry transport directly.

## Initialization contract

- Do not call `Sentry.init` unless configuration is complete, valid, and explicitly enabled.
- Target exactly `@sentry/angular@11.8.0`. Use only verified public APIs: `init`, `getDefaultIntegrations`, `SentryErrorHandler`/`createErrorHandler` behavior, and `captureException`. There is no assumed `provideErrorHandler` helper.
- The validated 11.8.0 `BrowserOptions` set includes only the public DSN, environment, release, dist, error `sampleRate`, `attachStacktrace: true`, `sendClientReports: false`, `maxBreadcrumbs: 0`, `enhanceFetchErrorMessages: false`, callback-form integration replacement, `beforeSend`, and fully disabled `dataCollection`. The installed 11.8.0 declaration does not expose `sendDefaultPii` or legacy `profilesSampleRate`; do not add ignored, untyped options. Explicit stack attachment gives primitive rejection events capture-site grouping material without retaining their values. Leave `tracesSampleRate`, `tracesSampler`, and `profileSessionSampleRate` undefined so tracing/profiling is not enabled; no replay/profile/log options or integrations are supplied.
- Allow error events only. Disable replay, traces, profiles, logs, feedback, sessions, metrics, and automatic user context.
- Supply an explicit integration allowlist derived from `getDefaultIntegrations()`: exactly `EventFilters` and `Dedupe`. Remove `FunctionToString`, `ConversationId`, `Breadcrumbs`, `Console`, `GlobalHandlers`, `LinkedErrors`, `HttpContext`, `CultureContext`, and `BrowserSession`; do not add `BrowserApiErrors`, replay, tracing, or profiling. Assert the exact installed integration names using the returned client's `getIntegrationNames()`.
- Disable all optional `dataCollection` categories: user information, cookies, HTTP headers/bodies, URL queries, GraphQL documents/variables, generative-AI inputs/outputs, database queries, queues, stack variables, and frame context lines.
- Set `dataCollection.userInfo: false`; never call `setUser`; never attach storage, domain objects, requests, extras, or tags.
- Keep Angular's `provideBrowserGlobalErrorListeners()` for both browser event types. Raw-error classification must run before delegating eligible errors to the Sentry handler because 11.8.0 can unwrap a `HttpErrorResponse` and expose a string response body; returning null from its extractor does not suppress capture. Excluded values go through Angular's existing fallback handling without Sentry.
- Keep Dedupe and the SDK's same-object captured marker only as defense in depth. The architecture must not intentionally submit the same error twice.
- Guard monitoring calls so they cannot replace Angular's normal handling. Bootstrap capture must run only after successful initialization and retain the existing `console.error` fallback.

## Sanitizer allowlist

`beforeSend` constructs a fresh event containing only event ID/time; fixed level/platform; validated environment/release/dist; minimal SDK name/version; exception type with a stable typed placeholder value; sanitized application-relative code filename/function/line/column; `in_app`; and symbolication debug metadata.

Absolute URLs become allowlisted app-relative static-code paths. Apply the same rule to `debug_meta.images[].code_file`. Origin, query, fragment, credentials, dynamic route identifiers, non-code URLs, frame source/context, and variables are removed. Request, user, breadcrumb, context, extra, tag, fingerprint, module, attachment, trace/transaction/profile/replay/log, original-error, and arbitrary mechanism fields are rejected. Sanitizer uncertainty or exception returns `null`.

No custom fingerprint is set initially. Stable sanitized exception type/value plus the complete safe stack structure are the approved grouping inputs. Two errors differing only in prohibited identifiers must yield identical grouping-relevant sanitized shapes; differing exception types or top in-app frames must remain distinguishable. An event without trustworthy grouping/source material is dropped rather than collapsed into a generic issue.

## Required automated tests

- Place canaries for passwords, JWT/Bearer/auth headers, cookies, reset/session tokens, names/emails/account/IP identity, GPS pairs, raw telemetry, fleet/vehicle/device IDs, bodies, queries/fragments, identifier paths, circular values, getters, causes, and long strings in every plausible nested location. Serialize the mocked outbound event and assert all canaries absent.
- Independently dispatch an Angular error, window `error`, `Error`-valued and primitive `unhandledrejection`, and bootstrap rejection through the actual Angular-configured listener; each reportable case produces exactly one envelope. Exercise the same object through Angular/global/bootstrap overlap; it remains one. Distinct errors remain distinct after SDK deduplication and allowlist sanitization.
- Run a separate isolated Chromium test using a naturally rejected Promise and assert one native `unhandledrejection` event. Keep that test distinct from the deterministic `PromiseRejectionEvent` dispatch used to verify Angular forwarding; neither path may add an application global handler.
- Stage-A diagnostics may emit only fixed case and lifecycle identifiers for trigger, handler, transport-ready, and accepted/failed transport. They must never log an error object, event payload, event details, URL, credential, or tenant data.
- HTTP 400/401/403/404/409/422/429—including a string response-body canary—cancellation, authentication expiry, authorization denial, validation failure, handled outcomes/notifications, reconnect lifecycle, and console calls each produce zero events and never pass raw values to Sentry capture. Assert the exact typed exclusion reason for every category.
- Assert the 11.8.0 installed integration names, Sentry `GlobalHandlers` absence, Angular global-listener forwarding, exact `beforeSend` output, and sanitized grouping invariants.
- Force parsing, classification, sanitization, initialization, capture, and transport failures. Existing notifications, propagation, state, navigation, and recovery remain unchanged, with no recursive event.
- Use a mocked SDK/custom in-memory transport. Real network verification is restricted to the isolated preview.
- Run sanitizer/filter cases at sample rate 1. Assert production 0.25 configuration separately, reflecting the verified 11.8.0 order: integrations/processors and `beforeSend` run before error-event `sampleRate`, then transport.
