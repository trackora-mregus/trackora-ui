# Feature Specification: Trusted API bearer boundary

**Feature Branch**: `security/6-trusted-api-bearer`
**Created**: 2026-10-23
**Status**: Reviewed for bounded local implementation
**Issue**: https://github.com/trackora-mregus/trackora-ui/issues/6
**Input**: Separately approved frontend pilot remediation; no hosted execution.

## User Scenarios & Testing

### User Story 1 — Preserve authenticated API workflows (Priority: P1)

As a signed-in user, I can read vehicle data and upload/download documents using
the existing approved API. This is essential to retain pilot functionality.

**Independent Test**: Intercept read/upload/download requests with a synthetic
sentinel credential; verify one bearer header and unchanged request/response data.

**Acceptance Scenarios**:

1. Given a stored token, when the destination is the exact configured API origin
   at `/api` or beneath `/api/`, then attach the token unless Authorization exists.
2. Given no token, when any request runs, then add no Authorization header.
3. Given caller-supplied Authorization, when any request runs, then preserve it,
   including empty values, without appending or replacing it.

### User Story 2 — Keep Trackora credentials out of other requests (Priority: P1)

As a signed-in user, I can decode a synthetic VIN without adding my Trackora
credential to the external request. This prevents unintended credential sharing.

**Independent Test**: Invoke the real VIN service through an intercepted transport;
also exercise external and adversarial destinations without network access.

**Acceptance Scenarios**:

1. Given a token, when VIN decoding or another third-party request runs, then no
   Trackora credential is injected and third-party credentials are preserved.
2. Given a malformed, ambiguous, or escaping destination, then pass the request
   through unchanged without adding a Trackora credential.
3. Given a relative destination, resolve trust using the browser's actual base;
   never silently redirect the destination to the configured API.

### Edge Cases

Origin lookalikes/subdomains, user-info, wrong effective ports/schemes, `/apievil`,
query/fragment decoys, dot segments before normalization, encoded separators,
double encoding, invalid escapes, browser base changes, protocol-relative URLs,
existing credentials, and redirected responses all require explicit treatment.

## Requirements

- **FR-001**: Trust only the active environment's exact HTTP(S) API origin and
  `/api` or `/api/` descendant path; no additional approved origin.
- **FR-002**: Resolve relative and protocol-relative destinations using the
  actual browser document base, preserving the original request URL.
- **FR-003**: Default to no injection for unsupported schemes, malformed or
  ambiguous URLs, user-info, wrong ports/hosts, path collisions, raw dot segments,
  encoded traversal/separators, nested encoding, or invalid path encoding.
- **FR-004**: Preserve existing Authorization verbatim, including third-party and
  empty headers. Never strip a caller's credential as part of this change.
- **FR-005**: Preserve bodies, params, other headers, response types, status/error
  behavior, and existing authentication lifecycle. Without a token, inject none.
- **FR-006**: Verify the actual VIN service path using only synthetic data and
  intercepted transports. Never send credentials or test requests externally.
- **FR-007**: Describe the initial-destination-only redirect limit. Mocked
  redirects must not claim validation of browser redirect-hop credential handling.

## Success Criteria

- **SC-001**: All approved read/upload/download scenarios retain exactly the
  intended authentication and data behavior in local intercepted checks.
- **SC-002**: Every external/adversarial destination in the regression matrix
  receives zero injected Trackora credentials.
- **SC-003**: Every supplied Authorization value is preserved without duplication.
- **SC-004**: Focused/full tests, type checking, formatting, and production build
  have recorded results; unavailable hosted/browser checks remain explicit.

## Assumptions

The existing authentication service and approved environment URLs remain intact.
Backend token validity, authorization, and tenant isolation remain server duties.
This local implementation neither establishes historical exposure nor closes #6.
Session changes require a reproducible included workflow defect and owner report.
Rollout, protected environment checks, redirects in supported native browsers,
final committed SHA/CI evidence, and closure require later authorized work.
