---
name: 'code-review'
description: 'Review Trackora Angular changes for correctness, tenant isolation, telemetry privacy, frontend/backend compatibility, tests, and Vercel deployment safety.'
metadata:
  author: 'trackora'
  source: 'repository-workflow'
---

# Code Review

Perform a findings-first frontend review. Review only; do not edit, commit, push, approve, merge, or deploy unless separately requested and authorized.

## Establish context

1. Read `AGENTS.md`, `.specify/memory/constitution.md`, the linked GitHub issue, and applicable Spec Kit artifacts.
2. Identify the intended base and inspect the complete diff, including TypeScript, templates, styles, tests, configuration, documentation, and generated contract changes.
3. Confirm the branch matches `<type>/<issue-number>-<slug>` and the pull request links the governing issue.
4. Distinguish defects introduced by the change from pre-existing conditions. Report relevant pre-existing risks separately.

## Review priorities

### Authentication, authorization, and tenant isolation

- Route guards, hidden controls, local storage, and client-side fleet/vehicle IDs are not treated as authorization.
- Auth tokens, reset links, cookies, and credentials are not exposed in source, URLs, logs, errors, screenshots, fixtures, or monitoring.
- Every fleet-, vehicle-, document-, alert-, telemetry-, and Copilot-related request preserves the backend's tenant boundary; direct navigation and identifier substitution fail safely.
- New routes use the appropriate guards, but backend authorization remains required.

### Sensitive data and external integrations

- Precise GPS, trip history, device identifiers, raw telemetry, documents, personal data, and AI content are not unnecessarily logged, persisted in the browser, or sent to third parties.
- Error handling and observability scrub authentication and tenant data.
- External services have justified data sharing, safe configuration, failure handling, and no client-bundled secrets.

### API and WebSocket compatibility

- REST DTOs, URLs, status/error behavior, nullability, and authentication remain compatible with `mregus/trackora-api` or include a coordinated rollout.
- WebSocket destinations, payloads, and lifecycle remain compatible; subscriptions reconnect and clean up without leaks or cross-consumer interference.
- REST establishes authoritative state, WebSockets increment it, and REST recovers missed events.
- Partial, null, zero, duplicate, malformed, delayed, and out-of-order telemetry cannot erase or regress newer known state.
- Live updates remain isolated from historical route and replay state.

### Angular and TypeScript correctness

- Components own presentation/view state; services own HTTP, STOMP, and shared integration behavior.
- Types preserve domain meaning and avoid unjustified `any`, unsafe assertions, hidden mutation, or truthiness checks that reject valid zero coordinates/telemetry.
- Signals and RxJS have clear ownership. Long-lived subscriptions use lifecycle cleanup such as `takeUntilDestroyed`, and shared streams have safe reference-count behavior.
- Loading, empty, error, retry, navigation, concurrency, and teardown paths behave predictably.
- Templates use stable keys and safe bindings; user-controlled content is not bypassing Angular sanitization.

### Accessibility and performance

- Interactive controls are keyboard accessible, labelled, focus-safe, and usable with screen readers; errors are perceivable without relying on color alone.
- Change detection, subscriptions, rendering, map layers, charts, and large collections avoid unnecessary work or retained resources.
- Lazy loading, production bundle budgets, and asset sizes are preserved. New dependencies are justified and non-duplicative.

### Tests, configuration, and deployment

- Meaningful behavior has proportionate unit and regression coverage, including negative tenant/security cases where applicable.
- Tests verify behavior and were not weakened or disabled.
- Environment values contain no secrets and development/production endpoints are not accidentally swapped.
- Vercel build/runtime configuration and rollout order are safe. A merge to `main` is treated as a production deployment event.
- The pull request records exact focused/full test and production-build results, plus manual checks or unavailable validation.
- Rollback restores a compatible frontend without requiring unsafe backend or data rollback.

## Output

- List findings first, ordered by severity: critical, high, medium, then low.
- For every finding, cite the affected file and line, explain the concrete impact, and recommend the smallest safe correction.
- Separate blocking defects from non-blocking suggestions and pre-existing risks.
- State explicitly when no blocking findings were found.
- End with test evidence, assumptions/unavailable context, and residual production-deployment risk.
