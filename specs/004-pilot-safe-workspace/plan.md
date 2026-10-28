# Issue #8 implementation design

Read `spec.md` before implementation. Angular standalone components, Signals,
existing HTTP services and Material controls remain in place. No new dependencies.

1. Add a boolean injection token under `core/config` with a strict opt-in factory
   reading the selected environment. Do not edit either existing environment.
2. Add a presentation canMatch guard to excluded routes before routed components
   are created. Preserve existing auth guards and normal-mode routing.
3. Use the same token in login, shell, Vehicles and detail. Guard source methods
   as well as markup. Do not instantiate the map tab/child in pilot mode. Preserve
   assigned-device reads and document/maintenance discovery in detail.
4. Add co-located mocked tests using HttpTestingController and real templates,
   plus router-harness tests and existing bearer regression tests. Use installed
   dependencies without downloads and retain all existing tests.

Constitution review before implementation: existing architecture, typed domain
contracts, shared integration services, lifecycle ownership, tenant/security and
privacy constraints are preserved. Specification exists before code changes.
No unresolved architectural alternatives: a shared interceptor denylist would
hide source defects and alter error behavior; use presentation/source guards.
No new data model or API contract is needed.

Quality gate limitation: repository full suite and production build are pre-merge
requirements. This assignment expressly authorizes only focused mocked tests and
necessary typechecking and prohibits production build/browser acceptance. Record
those gates as unrun; do not claim merge readiness. Independent review follows.

Rollout is a separately approved dedicated pilot environment with literal
`pilotPresentation: true`, or explicit `PILOT_PRESENTATION` provider. The flag is
public, static configuration and grants no access. Current environments omit it
and remain disabled. Rollback is disabling the flag/reverting this focused change;
no data migration or backend deployment is required.
