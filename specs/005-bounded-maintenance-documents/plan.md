# Minimal implementation design

Use existing Angular Signals/RxJS/HTTP services and no dependencies. A root-scoped
maintenance-list gate retains pacing/cooldown across component recreation. A
component-provided `PilotMaintenanceDocuments` service owns typed per-row state,
subscriptions and upload/list coordination; HTTP still goes through the existing
VehicleDocumentService. No scheduling queue or background retry is introduced.

The detail component registers history rows, renders deliberate per-row controls
and subscribes to pilot route-ID changes. Pilot request subscriptions are bounded
by both vehicle scope and component lifetime. Nonpilot branches retain their
current behavior. A single shared state owner avoids mirror-cache races.

Constitution check before code: framework, domain DTOs, service integration,
backend authority and tenant/auth contracts are preserved. Tests remain co-located
or beside the small core service. No integration manifest or accepted reference
evidence is changed. No new permission or backend contract is required.

Only issue-specific spec/plan/tasks and local verification evidence are needed.
Independent review and any future publication/merge require separate action.
