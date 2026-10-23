# Tasks: Trusted API bearer boundary (#6)

Input: [spec.md](spec.md), [plan.md](plan.md), and contract/design notes.

## Phase 1: Setup

- [x] T001 Confirm baseline, guidance, clean isolated issue branch, and existing tooling in `AGENTS.md` and `package.json`.
- [x] T002 Specify and review requirements and constitution gates in `specs/003-trusted-api-bearer/spec.md` and `plan.md`.

## Phase 2: Foundation

- [x] T003 Analyze spec/plan/tasks coverage before source changes and record in `specs/003-trusted-api-bearer/verification.md`.

## Phase 3: US1 — Authenticated API workflows (P1)

Goal/independent check: sentinel-authenticated read/upload/download with intact data.

- [x] T004 [US1] Add intercepted trusted URL, absent-token, explicit-header, body/params/upload/download and error tests in `src/app/core/interceptors/auth.interceptor.spec.ts`; establish baseline regression failure.
- [x] T005 [US1] Implement parsed destination guard and explicit-header preservation in `src/app/core/interceptors/auth.interceptor.ts` (FR-001–005).

## Phase 4: US2 — External/adversarial requests (P1)

Goal/independent check: actual VIN service and URL matrix receive zero injected tokens.

- [x] T006 [US2] Add both-environment adversarial/relative URL matrix, actual VIN path, and simulated redirected-response checks in `src/app/core/interceptors/auth.interceptor.spec.ts` (FR-002–007).
- [x] T007 [US2] Verify fail-closed behavior and preserved VIN response semantics against `src/app/core/interceptors/auth.interceptor.ts`.

## Phase 5: Verification

- [x] T008 Run focused/full tests, typecheck, production build, formatting, and review; record commands/results and limitations in `specs/003-trusted-api-bearer/verification.md` (SC-001–004).

## Dependencies and implementation strategy

T001 → T002 → T003 → regression tests (T004/T006) → T005 → T007 → T008.
US1 is the MVP but both stories are required for this security remediation.
Tests share one file: no parallel agent work or concurrent source edits needed.
Independent type/format checks can run together after implementation; no deploy,
push, PR creation, commit, or issue closure is part of this task.
