# Research: Trusted API bearer boundary (#6)

- **Decision**: Use `environment.apiBaseUrl` unchanged and compare parsed origins.
  **Rationale**: Scheme, host, and effective port are compared together; trusting
  a raw prefix or maintaining a second origin list can widen the boundary.
- **Decision**: Resolve with injected `DOCUMENT.baseURI` for browser semantics.
  **Rationale**: Resolving relative paths against the backend would misclassify
  UI-relative URLs. Preserve the original URL for the actual transport.
- **Decision**: Inspect raw path segments before parsing; reject literal/encoded
  dot segments, encoded slashes/backslashes/percent, invalid encoding, control
  characters, backslashes, whitespace, and nonstandard scheme shorthand.
  **Rationale**: URL normalization removes traversal evidence. Safe percent-encoded
  filename characters remain allowed; nested escapes fail closed. Query/fragment
  text cannot confer trust. Permissive decoding is unnecessary for current services.
- **Decision**: Existing Authorization always wins, including empty headers.
  **Rationale**: Avoid accidental overwrites/duplication and preserve third-party
  authentication. This boundary does not sanitize credentials supplied by callers.
- **Decision**: Use the installed unit-test builder and HttpTestingController.
  **Rationale**: Real service construction is exercised with synthetic data and
  no network. A mocked redirected response only checks response pass-through;
  it cannot demonstrate native redirect-hop credential behavior.
- **Alternatives rejected**: Backend-relative rewriting, substring matching,
  regex-only origin matching, broad third-party header stripping, transport
  replacement, changing CORS, or adding session behavior would expand scope.

Source baseline: GitHub comparison confirmed main identical to
`9010ed4972b7e762f4334aa13ec2214a0c840172` on 2026-10-23. The existing Sentry
branch remains isolated. Feature number 003 avoids the 002 Sentry artifacts in
that checkout. No technology selection or unknown requires delegated research.
