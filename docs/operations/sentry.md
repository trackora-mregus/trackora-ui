# Sentry operations

Trackora UI uses Sentry only for sampled unexpected browser errors. Monitoring is an optional operational side channel: absent, incomplete, malformed, blocked, or failing monitoring must never change authentication, REST, notification, WebSocket/STOMP, Leaflet, telemetry, history, navigation, or application-state behavior.

Session Replay, tracing, profiling, browser breadcrumbs, automatic user context, cookies, headers, bodies, query parameters, and frame variables are disabled. The final event is reconstructed from an allowlist. Passwords, tokens, authorization data, cookies, identity, GPS coordinates, telemetry, vehicle/fleet/device identifiers, request bodies, and sensitive URLs are prohibited.

## Configuration and ownership

Repository and Vercel owners control configuration. Monitoring has no remote application switch and is disabled unless every browser value is valid and `TRACKORA_SENTRY_ENABLED` is exactly `true`.

| Variable                      | Scope                                                                  | Notes                                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `TRACKORA_SENTRY_ENABLED`     | Preview or Production                                                  | Explicit `true`; omit or set false to disable on the next deployment.                                                                  |
| `TRACKORA_SENTRY_DSN`         | Preview or Production                                                  | Public ingestion DSN; compiled into the browser only for an enabled build.                                                             |
| `TRACKORA_SENTRY_SAMPLE_RATE` | Preview or Production                                                  | `1` for isolated verification; production default/policy is `0.25` and should normally be reduced to `0.20` or lower after acceptance. |
| `SENTRY_ORG`                  | Protected build environment                                            | `trackora-o4`.                                                                                                                         |
| `SENTRY_PROJECT`              | Protected build environment                                            | `trackora-ui`.                                                                                                                         |
| `SENTRY_AUTH_TOKEN`           | Trusted local Preview upload process; protected Production build scope | Minimum source-map release/upload scope; never place in shared Preview variables, files, arguments, metadata, browser output, or logs. |

The wrapper sets `TRACKORA_SENTRY_BUILD_MODE=trusted-preview` and `TRACKORA_SENTRY_PREBUILT=1` only inside the trusted local preparation subprocess. An enabled automatic Production build requires the separately protected value `TRACKORA_SENTRY_BUILD_MODE=protected-production`; do not add it during Preview verification. These mode values authorize no bypass and contain no credential.

The trusted monitored build requires a clean committed repository and derives `release=trackora-ui@<full-40-character-git-HEAD-SHA>` directly from Git; a supplied SHA is not authoritative. It generates a unique Vercel-supported custom Build Output deployment ID and uses it unchanged as browser Sentry `dist`, Sentry upload `--dist`, and `.vercel/output/config.json` `deploymentId`. A custom ID is 1–32 ASCII letters/digits/hyphen/underscore, must not start `dpl_`, and must not be reused within the Vercel project. Vercel's later internal `dpl_...` deployment-record ID is separate evidence, not Sentry `dist`.

As reviewed on 2026-10-17, monitor the current Sentry plan limits in the owner console because free-tier quotas can change. Review weekly during rollout and monthly afterward. The normal usage target is at or below 20%; investigate and reduce sampling at 50%. Expected 4xx responses and routine reconnect activity are excluded before event sampling.

## Build and source-map gate

`npm run build` is credential-free when monitoring is absent or disabled. Trusted monitored packaging fails closed unless Git cleanliness, release identity, custom dist, public configuration, local upload credentials, and hosted privacy controls validate. It then:

1. reads the `trackora-ui` project settings and requires both project IP scrubbing and explicit `remove anything` rules for Sentry API selectors `$user.geo.city`, `$user.geo.country_code`, `$user.geo.region`, `$user.geo.subdivision`, and `$user.geo.subregion`; these selectors correspond to normalized event fields `user.geo.city`, `user.geo.country_code`, `user.geo.region`, `user.geo.subdivision`, and `user.geo.subregion`. It never changes provider settings and does not accept IP scrubbing alone as proof;
2. creates optimized hidden script source maps in generated output;
3. injects debug IDs;
4. uploads and validates maps with the pinned Sentry CLI and exact release/dist;
5. deletes only maps generated by that transaction in a bounded `finally` cleanup;
6. packages the exact sanitized application into `.vercel/output` and writes the same custom ID to `config.json`;
7. scans the complete Build Output for symlinks/path escape, maps, `sourceMappingURL`, credentials or privileged values, sensitive fixtures, and stage-forbidden verification code;
8. returns `enabled-prebuilt-ready` only when the artifact is safe for an explicit prebuilt Preview upload.

Upload, validation, cleanup, packaging, identity-matching, or final-scan failure is unconditionally fatal for an enabled build. No emergency bypass exists in this release, and no URL, variable, CLI flag, PR value, or approval reference authorizes one. Any owner-controlled bypass requires a separately approved GitHub issue, threat review, specification, and protected manual gate.

## Trusted local secret and prebuilt boundary

For prebuilt Preview verification, use an approved local secret provider that injects `SENTRY_AUTH_TOKEN` into the trusted process without echoing it. Never type the token into a shell command, pass it with Vercel `--build-env`/`--env`, write it to `.env` or `.vercel`, add it to deployment metadata, or configure it in shared Preview variables. The local workflow removes the token from Angular, packaging, and Vercel deployment subprocess environments; only the Sentry upload subprocess receives it. Production retains its separately protected build-secret scope and is not changed by this Preview procedure.

Use a clean isolated worktree and Vercel CLI `64.5.0`, pinned outside application dependencies. This version accepts both the current per-project `orgId` repository-link schema and the legacy top-level fallback; missing or ambiguous organization identities fail closed before invocation. Deterministic tests validate linkage, packaging, and the scan-only prepared-artifact deployment path with temporary repositories and fixture `.vercel/output` trees without deploying or contacting Production. Hosted verification may proceed only after those tests pass. The final scanner may compare the in-memory token value with artifact bytes, but it must never put that value in a child-process argument, output, or finding; findings use fixed reason codes only.

Prepare without deployment:

```bash
# Have the approved local secret provider inject SENTRY_AUTH_TOKEN into this process.
TRACKORA_SENTRY_ENABLED=true \
VERCEL_ENV=preview \
npm run build:prebuilt-preview
```

Do not paste the token into this command or shell history. The preparation command derives Git `HEAD`, generates the custom ID, uploads maps, removes them, packages `.vercel/output`, recursively scans it, and stops. After review and separate deployment authorization, `npm run deploy:prebuilt-preview` uses only the fixed pinned-CLI Preview command; it does not rebuild.

The same read-only provider check can be run independently with `npm run verify:sentry-privacy` while the approved secret provider supplies `SENTRY_AUTH_TOKEN`. A failure reports only the fixed reason `Sentry privacy preflight failed`; it must not print settings, response bodies, geographic values, or the credential. The final normalized event remains the acceptance boundary even after this preflight passes.

The only permitted hosted verification operation is the reviewed equivalent of:

```text
vercel deploy --prebuilt --target=preview
```

The workflow must reject an implicit target, `--prod`, a production target, promotion, production aliases, Production-variable changes, source deployment that rebuilds, and any argument or metadata containing a secret. Inspect the returned Preview deployment read-only and record its internal `dpl_...` ID separately from the custom Sentry dist. Never reuse the Stage-A custom ID for Stage B.

This procedure does not deploy or reconfigure Production. Deterministic no-deploy tests must prove the existing automatic Production build can preserve the same custom browser/upload/Build Output identity and fail-closed gate. If the Vercel Production builder cannot preserve the custom ID, merge and Production monitoring enablement remain blocked; never substitute the internal `dpl_...` record ID or weaken the gate.

## Disable, recover, and roll back

Normal disablement is deployment-based: a Vercel owner removes or sets `TRACKORA_SENTRY_ENABLED=false` in the affected scope and redeploys the same known-good commit. Target identification and initiation within ten minutes. Do not change Production while practicing this procedure.

If provider-side shutdown is urgent, a Sentry owner disables/revokes the project key, then a Vercel owner reconciles configuration and redeploys. Target identification and initiation within five minutes. A provider shutdown can stop ingestion but does not replace configuration reconciliation.

For an application regression, promote the last known-good immutable commit through the normal protected deployment path. Never expose tokens, add a public error endpoint, or weaken the source-map gate to recover a release.

Repeatable tabletop checklist (no Production changes): identify the affected Vercel environment and immutable commit; identify the owner who can disable the environment variable and redeploy; identify the Sentry owner who can revoke the project key; identify the last known-good commit and protected rollback path; confirm the operator will record start, target-identification, initiation, and recovery timestamps without credentials. The acceptance targets are under ten minutes to identify/initiate normal disablement and under five minutes to identify/initiate provider shutdown or rollback.

Tabletop record (2026-10-17): documentation-only walkthrough identified the normal Vercel variable/redeployment path and provider-key emergency path. No Production configuration was inspected or changed. Authorized owner timing evidence remains required before release acceptance, so T030 is not complete.

## Preview verification

Use two distinct protected previews and the checklist in the feature quickstart:

- Stage A: a clean committed revision, unique custom ID, and isolated access-controlled prebuilt Preview at sampling `1` with a deterministic one-shot `PromiseRejectionEvent` through Angular's existing listener, followed only after accepted transport by the unexpected-error trigger. Fixed diagnostics identify trigger, handler, transport-ready, and accepted/failed transport without logging payloads. Run the separate isolated-Chromium natural-rejection test. Confirm one normalized event per case, no `user.geo`, sanitized payloads, grouping, symbolication, three-way browser/upload/config identity, and clean local/deployed artifacts.
- Stage B: a distinct clean commit and different custom ID; remove the verification source, imports, references, and sentinels; scan the source and complete `.vercel/output`; deploy a separate exact trigger-free prebuilt Preview. Confirm production sampling configuration by inspection only.

Never trigger a synthetic production error. Preview evidence must record deployment URLs and immutable commit SHAs without including tokens or prohibited event data.

## Repeatable verification commands

```bash
npm test -- --watch=false
npm run test:build
npm run test:browser-rejection
npm run typecheck
npm run build
git diff --check
find dist/fleetwise-ui/browser -type f -name '*.map' -print
rg -l 'sourceMappingURL\s*=' dist/fleetwise-ui -g '*.js' -g '*.css'
rg -l 'SENTRY_AUTH_TOKEN|CANARY_PASSWORD|CANARY_JWT|CANARY_COOKIE|CANARY_RESPONSE_BODY' dist/fleetwise-ui -g '*.js' -g '*.css'
find .vercel/output -type f -name '*.map' -print
rg -l 'sourceMappingURL\s*=|SENTRY_AUTH_TOKEN|CANARY_PASSWORD|CANARY_JWT|CANARY_COOKIE|CANARY_RESPONSE_BODY|sentry-preview-verification|synthetic-unexpected-error|synthetic-unhandled-rejection' .vercel/output
npm test -- --watch=false --include='src/app/core/observability/monitoring-gateway.spec.ts'
git log --all -G 'SENTRY_AUTH_TOKEN|TRACKORA_SENTRY_DSN' --format='%h %ad %s' --date=short
git log --all -S 'trackora-ui@' --format='%h %ad %s' --date=short
```

History scans use credential names and approved non-secret fingerprints only. Never put a real credential value on the command line or print matching file contents. Preserve repository history.

The SDK package contains inactive default-integration code, so raw bundle strings are not proof that an integration is installed. The exact-version gateway test invokes the 11.8.0 integration callback and asserts that only `EventFilters` and `Dedupe` remain.

## Evidence log

- Deterministic local validation (2026-10-17): `npm run typecheck` passed; the full Angular suite passed 97 tests in 32 files; 35 Node build-contract tests passed; `npm run build` completed in disabled/credential-free mode; and `git diff --check` passed. The optimized build remained below the existing 1 MB error budget at 869.59 kB, with the existing 500 kB warning threshold still reported. The restricted local sandbox aborted the first optimized-build subprocess; the identical build completed outside that sandbox without changing source or configuration.
- Local source-map transaction validation (2026-10-17): the guarded configuration generated 43 hidden maps and no public references; pinned CLI debug-ID injection modified all 43 JavaScript/map pairs. A subsequent ordinary build replaced that output. Final scans found zero maps, map references, upload-token names, fixture canaries, or preview-verification sentinels in generated artifacts.
- Read-only repository-history scan (2026-10-17): credential-name and approved non-secret fingerprint searches returned no commits. No credential values were supplied or printed, and history was not modified.
- Focused runtime/code review (2026-10-17): corrected additive SDK integration configuration that would have retained ambient defaults, removed the upload token from the Angular subprocess environment, extended validation/cleanup across Angular generated output, ensured final artifact assertions run after cleanup failure, rejected symbolic-link artifact roots, and contained classifier failures. The later trusted-prebuilt planning refinement reopened packaging, complete `.vercel/output`, identity, and Preview-command validation tasks; those checks are not yet implemented or reviewed.
- Stage A isolated preview (partial evidence, 2026-10-17): protected Preview deployment `dpl_DCGasDkHh9tqJwLtFKwv72F8zQpi` was manually exercised once at release `trackora-ui@edf0b61984e441b1b5ec020079e499f0c3ff85cb` and dist `trk-b5f8cc3cd61cb8ccf0997c51db67`. Read-only Sentry inspection found one accepted event, `203195794cde4e139670e94b7c5e8fd5`, in group `7797228564` (`TRACKORA-UI-1`), with environment `preview`, the approved release/dist, exception type `Error`, sanitized value `[redacted Error]`, and no processing errors. Two readable in-app original-source frames resolved to `src/main.stage-a.ts:17` and `src/app/core/observability/sentry-preview-verification.ts:23`; all six debug-ID frames matched uploaded source and map artifacts. The event contained only exception/debug-metadata entries, no request, breadcrumbs, extra data, attachments, JWT or bearer-token pattern, coordinate pair, unsafe frame URL, or populated email, username, or IP field. Privacy acceptance nevertheless failed because Sentry's normalized user geo contained populated country, city, and region fields (values intentionally not recorded). Sentry exposed no second accepted event for the unhandled-rejection case: the project event list, issue event list, and issue count each returned one event, whose line 23 frame identifies the unexpected-error case; line 24 would identify the rejection. Stage A remains incomplete until geo enrichment is prevented and a separately approved fresh isolated verification proves exactly one privacy-safe event for each case. Normal post-error Angular behavior also remains outside this read-only Sentry evidence and requires explicit browser evidence.
- Stage A remediation validation (2026-10-17): the focused observability suite passed 56 tests, the complete Angular suite passed 105 tests in 33 files, 38 build-contract tests passed, TypeScript checking passed, the isolated Chromium natural-rejection test observed exactly one native event, and the ordinary optimized monitoring-disabled build completed at 870.19 kB with the existing budget/CommonJS warnings. Ordinary build output and the preserved Stage-A `.vercel/output` passed source-map, source-reference, credential-name, fixture, symlink, path-containment, and privacy scans. The read-only hosted privacy preflight failed closed with only its fixed failure reason because the required combination of project IP scrubbing and explicit removal rules for every normalized `user.geo` field could not be verified. No Sentry setting was changed, no new event was generated, and no build was uploaded or deployed. A fresh Stage-A package remains blocked pending separately authorized provider-setting remediation.
- Corrected Stage A isolated preview (verified 2026-10-17): protected deployment `dpl_CSgBKnTAp5sBMjFvMVVxvnabapk2` was manually opened once, and read-only Sentry API inspection was restricted to release `trackora-ui@73773b44717e8940863bae3977f5906d0e6e5248` and dist `trk-9f3472ac764a7689320fe83cfef6`. Exactly two accepted events were present. Event `b8f6c1ae2fe84f8f82b034e14966aff4` resolved to the unhandled-rejection creation frame at `src/app/core/observability/sentry-preview-verification.ts:81`; event `d9536550060342279687be43a31e7e4d` resolved to the unexpected-error creation frame at line 80. Both used environment `preview`, the exact release/dist, exception type `Error`, and sanitized value `[redacted Error]`. They formed distinct groups `7797295864` (`TRACKORA-UI-3`) and `7797295845` (`TRACKORA-UI-2`), with distinct grouping fingerprints and exactly one occurrence in each group; no duplicate capture was observed. Each event had three readable in-app original TypeScript frames with source context, including `src/main.stage-a.ts`, the verification gate, and the applicable verification trigger line. Both final normalized events contained only exception/debug-metadata entries plus non-user trace context: no populated user or `user.geo`, IP address, identity, request, breadcrumbs, extra data, attachments, credential/JWT patterns, GPS/telemetry/vehicle/fleet/device fields, or other prohibited key paths were present. Each event reported zero processing errors. Acceptance of both sequenced cases and the one-occurrence group counts showed no evidence of unexpected filtering. Stage A hosted Sentry event, privacy, grouping, symbolication, and duplicate-prevention verification is complete; normal application behavior remains supported by the separately recorded browser/regression evidence.
- Stage B local candidate validation (2026-10-17): the trigger-free issue branch passed 12 focused Angular observability tests, the complete Angular suite with 99 tests in 32 files, 42 build-contract tests, the isolated Chromium natural-rejection test, TypeScript checking, Prettier, and the ordinary optimized monitoring-disabled build. The build completed at 869.59 kB with only the existing budget and CommonJS warnings. A recursive scan of all 49 generated browser files found zero source maps, source-map references, symlinks, path escapes, upload-credential names, sensitive fixture markers, or Stage-A verification files/symbols/sentinels. The application source tree and Angular configuration likewise contained no Stage-A file, import, build configuration, selector, trigger, or sentinel. The final code review found no blocking privacy, duplicate-capture, CI, Angular-boundary, Vercel, or unrelated-diff defect. No Sentry credential, provider call, source-map upload, prebuilt package, or deployment was used for this local preparation.
- Stage B trigger-free production-candidate preview: pending a distinct candidate build and separately authorized Preview deployment.
- Trusted prebuilt workflow: clean-HEAD/custom-ID generation, exact source-map manifesting, private upload gating, bounded cleanup, Build Output packaging, identity matching, recursive scan, and fixed Preview-only command construction have deterministic no-provider tests. No shared Preview upload token is authorized. A real enabled Stage B package remains pending this clean committed candidate and approved local secret injection.
- Performance comparison: pending five equivalent browser runs against baseline and candidate.
- Production public-artifact check: T051; intentionally pending a separately authorized Production deployment.
