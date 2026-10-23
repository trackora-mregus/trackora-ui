# Bearer attachment contract (#6)

The active `environment.apiBaseUrl` is the only trust root. Its current path is
`/api`. Match origin exactly after URL parsing, then require path equality or
`/api/` descendants. Default ports are equivalent to omitted default ports.
Host casing follows URL normalization; subdomains and trailing-dot hosts differ.
Reject non-HTTP(S), user-info, malformed URLs, whitespace/control/backslash tricks,
and scheme shorthand without `//`. Protocol-relative references inherit the
browser document base scheme. Other relative references use that same base,
including its `<base>` element. An absent/invalid base cannot establish trust
for a relative request; absolute trusted requests do not need it.

Before parsing removes dot segments, inspect raw path segments (excluding query
and fragment). Decode each once; reject `.`/`..`, decoded slash/backslash/percent,
control characters, invalid encoding, and malformed escapes. Reject redundant
leading authority slashes and empty HTTP authorities. Safe encoded filename
characters remain valid. Query and fragment decoys cannot establish trust.
No URL rewriting or changes to caller params occur.

If Authorization exists (case-insensitive, including an empty/multiple value),
pass through unchanged. Otherwise add exactly `Bearer <stored token>` only when
trusted and a token exists. All other request/response/error behavior is preserved.
Caller-supplied credentials remain the caller's responsibility.

## Redirect limitation and safe verification

This interceptor validates only the initial destination. Browser redirects occur
inside the transport and do not re-enter the Angular interceptor per hop. A trusted
endpoint must not be assumed safe merely because its initial URL passes; it must
avoid untrusted redirects. No cross-hop guarantee is made for XHR, Fetch, browser
versions, proxies, or server-side internal redirects by this change.

Local tests intercept all HTTP and can simulate redirected response metadata only.
They make no external connections and do not prove native redirect header handling.
Before a separately approved rollout, use synthetic tokens and local/approved
controlled sinks or browser interception that prevents all external transmission;
check supported transports, same/cross-origin redirects, and preflight versus
actual request receipt. Never send a token to NHTSA to test this. Hosted/native
redirect verification remains NOT RUN under current authorization.
