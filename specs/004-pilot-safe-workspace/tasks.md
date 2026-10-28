# Issue #8 tasks

- [x] T001 [US1] Add strict pilot configuration and guard in `src/app/core/config/pilot-presentation.ts` and `src/app/core/guards/pilot-feature.guard.ts`; test configuration/navigation.
- [x] T002 [US1] Gate excluded routes in `src/app/app.routes.ts`, shell in `src/app/app.ts` and `src/app/app.html`, and login in `src/app/features/login/login/login.component.ts`; test bootstrap and login.
- [x] T003 [US2] Preserve fleet selection/reads and gate excluded actions in `src/app/features/vehicles/vehicles/vehicles.component.ts` and its template; test exact requests and errors.
- [x] T004 [US2] Guard detail sources and map creation in `src/app/features/vehicles/vehicle-details/vehicle-details.component.ts` and its template; test documents, devices, errors and excluded activity.
- [x] T005 [US3] Add focused nonpilot regressions alongside affected components; run existing bearer tests and necessary typechecking.
- [x] T006 Record exact commands/results, changed-file hashes, diff and local Draft PR text in issue-specific verification evidence.

Dependencies: T001 precedes T002–T004; T005 follows code changes; T006 follows
verification. Tasks may be executed sequentially in this one assignment.

Pre-implementation cross-artifact analysis (Spec Kit analyze criteria): FR1/FR2
map to T001/T002; FR3 to T002/T004; FR4/FR5 to T003/T004; FR6 to all;
SC1/SC2 to T005/T006. Six requirements covered, six tasks, no ambiguity,
duplication or unmapped tasks. The explicit full-suite/build limitation is recorded
in plan.md and will remain a completion boundary. No constitution amendment or
accepted-reference rewrite is proposed.
