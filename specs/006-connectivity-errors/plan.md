# Implementation plan

Use a typed shared HTTP failure classifier and an HttpContext flag for local feedback ownership. Mark only login and the two upload POSTs. Keep the global interceptor's propagation; the baseline has no logout or session mutation there. Components render strings through Angular text interpolation; pilot maintenance uses its existing row message. Finalize subscriptions to clear busy/input state, guard repeated submissions, and honor only readable valid Retry-After without timers.

Source contract inspection: the backend AuthService delegates to authenticationManager and deliberately maps pilot ineligibility to BadCredentialsException. SecurityExceptionHandler/GlobalExceptionHandler return 401 with message `Invalid email or password`; a bare 401 does not establish that diagnosis. No live requests or credentials are used.

UI #10 overlap is limited to upload feedback/cleanup in the store, vehicle-detail upload handling/markup, and tests for those paths. Do not alter MaintenanceDocumentListGate or list scheduling. Preserve the original checkout and its nine-file patch; record incremental and combined diffs outside the repository.

Constitution review: existing Angular Signals/RxJS/HTTP services, no new dependency, no API contract or security changes. Minimal spec artifacts only; no .specify changes. Test with existing offline dependencies and finite focused execution, then app/spec TypeScript checks. Independent review belongs to Othello.
