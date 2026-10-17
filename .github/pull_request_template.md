## Summary

<!-- Explain what changed and why. Keep this PR focused on one issue. -->

## Linked issue

Closes #<!-- required issue number -->

## Spec Kit artifacts

<!-- Link applicable artifacts, or explain why this change does not require them. -->

- Specification:
- Plan:
- Tasks:
- Not required because:

## Changes

-

## Verification

<!-- List exact commands/manual checks and their results. Do not write only "tests pass." -->

- [ ] Focused unit/regression tests:
- [ ] Full unit suite (`npm test -- --watch=false`):
- [ ] TypeScript check (`npx tsc -p tsconfig.app.json --noEmit`):
- [ ] Production build (`npm run build`):
- [ ] Formatting/linting, if configured:
- [ ] Manual browser, accessibility, or operational verification:

## Review checklist

- [ ] Routes and UI state do not substitute for backend authentication, authorization, or tenant isolation.
- [ ] No credentials, tokens, secrets, sensitive documents, precise GPS, raw telemetry, tenant data, or unnecessary personal data are exposed.
- [ ] REST, WebSocket, authentication, and backend compatibility are preserved or have a coordinated rollout plan.
- [ ] RxJS subscriptions, shared streams, map layers, and other resources clean up safely.
- [ ] Partial/out-of-order telemetry and live/history separation remain correct where applicable.
- [ ] TypeScript types, error/loading states, accessibility, and performance are appropriate.
- [ ] Unit and regression coverage is proportionate and has not been weakened.
- [ ] Vercel environment variables and production deployment implications are understood.
- [ ] The diff contains no unrelated refactors, generated artifacts, or local files.

## Risk assessment

**Risk level:** Low / Medium / High / Critical

<!-- Describe user impact, tenant/privacy risk, backend compatibility, and production failure modes. -->

## Rollout plan

<!-- Include backend ordering, environment/configuration changes, monitoring, preview checks, and production verification. -->

## Rollback plan

<!-- Explain how to restore a compatible frontend safely. A merge/revert on main can deploy production. -->

## Reviewer notes

<!-- Highlight the highest-risk areas and any checks reviewers must perform. -->
