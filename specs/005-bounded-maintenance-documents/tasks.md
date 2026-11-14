# Tasks

- [x] T001 Implement typed row ownership, cancellation and browser-root list admission in `src/app/core/services/pilot-maintenance-documents.service.ts` (R1–R5).
- [x] T002 Connect pilot route lifecycle and per-row controls in `src/app/features/vehicles/vehicle-details/vehicle-details.component.ts` and `.html`, preserving nonpilot branches (R1–R6).
- [x] T003 Add focused service and component HTTP/virtual-time tests beside changed code; adapt the affected pilot regression expectations for deliberate list loading (R1–R6).
- [x] T004 Run finite focused mocked tests and necessary type/format checks; retain exact exit codes, source identities and sanitized complete diff outside the checkout.

Pre-code spec/plan/task analysis: all six requirements map to implementation and
test tasks. No uncovered requirement or architecture/contract conflict was found.
No reviewer-owned checklist exists for this new feature. The full-suite/build and
browser/hosted acceptance gates remain unrun by scope, not silently waived.
