# Trackora Frontend Agent Guide

## Authority and scope

- This repository contains the Angular frontend. The Spring Boot backend is maintained separately in `mregus/trackora-api`.
- Read `.specify/memory/constitution.md` before planning or implementing non-trivial work. It is the authoritative frontend engineering policy.
- Follow focused guidance in `docs/` and reusable skills under `.agents/skills/` without duplicating or weakening the constitution.
- Preserve unrelated working-tree changes. Never discard, overwrite, stage, or commit another contributor's work without explicit approval.

## Architecture and project conventions

- Preserve the established Angular 21 standalone-component architecture, TypeScript models, Angular Signals, RxJS, Angular Material, Leaflet, and STOMP.js integration.
- Keep presentation and view state in components. Put HTTP, WebSocket, and shared integration behavior in services under `src/app/core/`.
- Keep domain contracts explicit under `src/app/shared/models/`; do not use `any` or cast between raw events and merged state to bypass type safety.
- Use Signals for local reactive state and RxJS for asynchronous streams. Give mutable state one clear owner and prefer immutable updates.
- Lazy-load routed features consistently with `src/app/app.routes.ts`. Preserve existing route guards and do not treat a hidden route or UI control as authorization.
- Keep feature code and tests together under `src/app/features/`. Reuse shared components and services instead of creating parallel abstractions.

The primary structure is:

```text
src/app/
├── core/          # authentication, guards, interceptors, integration services
├── features/      # routed and feature-specific standalone components
└── shared/        # reusable components and typed domain models
```

## Security, privacy, and compatibility

- The backend must enforce authentication, authorization, fleet membership, and tenant isolation. The frontend must preserve those boundaries and must not imply that client-side checks provide authorization.
- Do not trust route parameters, locally stored identifiers, WebSocket destinations, or client-supplied fleet/vehicle IDs as proof of access.
- Never commit or expose credentials, JWTs, reset tokens, API keys, private keys, sensitive documents, unnecessary personal data, or production environment secrets.
- Treat precise GPS positions, vehicle/device identifiers, raw telemetry, trip history, and fleet activity as sensitive tenant data. Keep them out of logs, screenshots, fixtures, monitoring, and issue/PR text unless sanitized and necessary.
- Treat REST DTOs, validation/status/error behavior, authentication, WebSocket destinations, and event payloads from `mregus/trackora-api` as cross-repository contracts. Coordinate breaking changes and deployment order with the backend.
- Preserve the live-data contract: REST establishes authoritative state, WebSockets increment it, and REST recovers missed events. Partial, null, zero-valued, duplicated, and out-of-order telemetry must retain the semantics defined by the constitution.
- Share live streams safely, clean up subscriptions with framework lifecycle tools such as `takeUntilDestroyed`, and ensure one consumer cannot terminate another consumer's updates.

## Spec Kit workflow

- Spec Kit 1.0.8 is installed for Codex. Use the existing `speckit-*` skills and keep feature artifacts under `specs/`.
- Non-trivial architecture, infrastructure, security, data ownership, telemetry, or public-contract changes require a specification before implementation.
- Review specifications and plans before implementation and run `speckit-analyze` after task generation when applicable.
- Do not reinitialize Spec Kit or modify `.specify/` integration/manifest files unless the task explicitly requires an upgrade or configuration change.
- Spec Kit feature-directory numbering is independent of GitHub issue numbers and branch names. Follow `$branching-strategy` when its generated branch name would violate repository policy.

## Branch and Git workflow

- Use `$branching-strategy` when selecting, validating, or creating a working branch.
- Every change must have a GitHub issue. Branch names must match `<type>/<issue-number>-<slug>`, where type is `feature`, `fix`, `security`, or `chore`.
- Never work directly on `main`, push directly to `main`, or merge without explicit user approval. A merge or direct push to `main` triggers the Vercel production deployment.
- Do not commit, push, rebase, force-push, create a pull request, merge, deploy, or change Git configuration unless the user authorizes that action.
- Keep one focused issue per branch and pull request. Pull requests must link the governing issue and contain no unrelated refactors.

## Development and verification

Use the repository's declared npm scripts and locked dependencies:

```bash
npm ci
npm start
npm test -- --watch=false
npm run build
npx tsc -p tsconfig.app.json --noEmit
```

- There is currently no lint script or ESLint configuration. Do not claim a lint check ran or add a linter as incidental work.
- Prettier is configured in `.prettierrc`; use `npx prettier --check <files>` for applicable changed files.
- Run focused tests while iterating, then the full unit suite and production build before requesting merge.
- Add unit/regression tests for meaningful behavior changes, including tenant-bound UI behavior, telemetry merging/order, WebSocket lifecycle, guards, and error paths where applicable.
- Do not weaken, disable, or delete tests or Angular build budgets merely to obtain a passing result.
- A production build is a local verification step; do not manually deploy it or modify Vercel production settings/secrets without explicit authorization.

## Review and completion

- Use `$code-review` before requesting merge approval.
- A change is complete only when the issue and applicable Spec Kit artifacts are satisfied, relevant tests/builds pass, security and tenant isolation are preserved, backend compatibility is safe, and rollout/rollback are understood.
- Record exact verification commands and results in the pull request. Report unavailable checks and residual risks rather than presenting assumptions as validation.
- Do not merge the pull request. Review approval does not authorize a merge or production deployment.
