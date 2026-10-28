# Issue #8 local verification

Issue: https://github.com/trackora-mregus/trackora-ui/issues/8
Branch: `feature/8-pilot-safe-workspace`
Base/unchanged HEAD: `6d4aaf0697e7b28556484baa2882cb6798b8c328`
Working directory: isolated `trackora-ui-8` checkout; changes uncommitted/unstaged.

## Results

Final focused run: **223 passed, 0 failed, 7 files** (41 new pilot tests plus
182 existing bearer/error-interceptor regressions). All HTTP uses
`HttpTestingController`; STOMP activation/WebSocket construction are intercepted.
The nonpilot map lifecycle test stubs only the map initialization method, keeping
real tab/child creation without tiles, live traffic or backend calls. Material
animations are disabled in that test fixture for deterministic jsdom portals.

| File                                                                      | Passed |
| ------------------------------------------------------------------------- | -----: |
| `src/app/app.pilot.spec.ts`                                               |      2 |
| `src/app/core/config/pilot-presentation.spec.ts`                          |      9 |
| `src/app/core/guards/pilot-feature.guard.spec.ts`                         |     16 |
| `src/app/core/interceptors/auth.interceptor.spec.ts` (unchanged)          |    182 |
| `src/app/features/login/login/login.pilot.spec.ts`                        |      4 |
| `src/app/features/vehicles/vehicle-details/vehicle-details.pilot.spec.ts` |      6 |
| `src/app/features/vehicles/vehicles/vehicles.pilot.spec.ts`               |      4 |

Exact focused command:

```sh
NG_CLI_ANALYTICS=false npm test -- --watch=false --include='src/app/**/*.pilot.spec.ts' --include='src/app/core/config/pilot-presentation.spec.ts' --include='src/app/core/guards/pilot-feature.guard.spec.ts' --include='src/app/core/interceptors/auth.interceptor.spec.ts' --reporters=json --output-file=../evidence-ui-8/focused-results.json
```

Angular's unit-test builder compiles development test bundles for this command;
no application production build was run.

Additional commands:

```sh
./node_modules/.bin/tsc -p tsconfig.app.json --noEmit
./node_modules/.bin/tsc -p tsconfig.spec.json --noEmit
git diff --check
```

All passed. Existing dependencies are linked from the earlier UI #6 checkout;
no packages were installed/downloaded or dependency manifests changed.

Formatting: Prettier passes for all new TypeScript/specification files. Full
changed-file Prettier check reports the eight modified existing files; each also
fails the same check at the frozen baseline. Their unrelated formatting was
preserved to keep the source change focused. `../evidence-ui-8/baseline-format.log`
records the baseline comparison; `format-current.log` records current warnings.

## Behavior covered

- Literal true through the real configuration factory, omitted/false/malformed
  values, both existing environments disabled, and OWNER-independent selection.
- Pilot/nonpilot successful login, failed login, no `/auth/me`, excluded direct
  paths (including map/safety/copilot/admin), included detail paths and auth guard.
- Shell bootstrap suppression, hidden search/navigation, search debounce absence;
  nonpilot notification/alert bootstrap retained.
- Returned-fleet selection, inventory reads/refresh, no membership/invitation
  component creation; fleet/inventory errors and excluded create/decode handlers.
- Exact GET vehicle/maintenance/document/device contracts; multipart POST vehicle
  and maintenance documents; blob GET download and URL cleanup; document validation,
  upload/list/download denial feedback and device empty/denied reads.
- No pilot fuel/alerts/AI/current/history/map/WS work even after all visible tabs
  are selected or excluded source handlers are invoked. Nonpilot reads, controls,
  tabs and map child lifecycle are retained.

## Completion boundaries

Implementation/test evidence is ready for Othello's independent review. This is
not independent approval, backend acceptance or merge readiness. The repository's
full suite and production-build gates were not run because this assignment limits
verification to focused mocked tests/typechecking and expressly prohibits the
production build. Browser/live backend acceptance, Docker, push, commit, remote PR,
merge, deployment and hosting changes were not performed. Production remains NO-GO;
incremental spending is $0.

No implementation permission or missing-dependency blocker remains. The required
frozen commit fetch initially failed sandbox DNS and succeeded once approved for
read-only network access. An attempted interim checkpoint to the parent cloud
thread `01a166bb-f61d-70e3-b1a8-8a4e0093d0c1` through the local Codex messaging tool
failed with “thread not found”; it was not delivered and is not pending. Final
handoff uses the platform's automatic parent notification.

The earlier UI #6 checkout remains clean; the primary checkout's unrelated
`docs/operations/sentry.md` modification remains present. Accepted reference
artifacts, environment/auth/interceptor/service contracts and dependencies are
unchanged. The new issue specification does not replace the accepted reference
package or frozen release baseline.

External local evidence: `../evidence-ui-8/` contains Draft PR text, the complete
tracked/untracked patch, changed-file list, SHA-256 manifest, JSON test results and
verification logs. Manifest hashes identify this working-tree candidate without
creating a commit or publishing a PR.
