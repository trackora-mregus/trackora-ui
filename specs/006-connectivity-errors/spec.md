# UI #11: accurate sign-in and upload failures

Issue: https://github.com/trackora-mregus/trackora-ui/issues/11

## User scenarios and acceptance

1. Sign-in transport failures must not accuse the user of invalid credentials. Status 0 is an uncertain transport outcome. Only the verified readable authentication response identifies a credential rejection (which may also conceal pilot eligibility).
2. Vehicle and maintenance uploads preserve safe readable server messages, clear busy state, retain form choices, and permit deliberate reselection. An unconfirmed upload must not report success or automatically retry; check the list first when the outcome is uncertain.
3. Each failure has one visible feedback owner. Existing error propagation, authentication state, bearer scoping, success navigation and document endpoints remain intact in both presentation modes.
4. Valid readable Retry-After can constrain intentional resubmission. Missing/opaque/malformed headers do not establish a server retry time. No retry timers or automatic requests.
5. Accepted UI #10 manual listing, one list at a time, 11-second pacing, app-instance gate, cancellation and cooldown remain intact. This bound is per running application instance, not across tabs, reloads or the server.

## Safety and exclusions

Readable string messages are preserved verbatim, including harmless markup rendered as text. Nonstring bodies are never stringified. Narrow safety exclusions: credential assignments, bearer/JWT/private-key material, credential-bearing URLs, recognizable stack/SQL internals, absolute machine paths, serialized JSON objects/arrays, control characters and strings over 1000 characters. Unsafe messages use contextual fallbacks. This is defensive presentation, not a backend security boundary or a comprehensive data-loss filter.

## Success criteria and remaining gates

Focused mocked checks demonstrate one feedback owner, message preservation, cleanup, deliberate recovery, no automatic retries, unchanged success contracts and affected UI #10 behavior. Live browser/API, hosted CI, full suite and production build remain unexecuted for this scoped assignment. No runtime or release qualification is implied.
