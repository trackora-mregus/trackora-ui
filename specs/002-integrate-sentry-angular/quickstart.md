# Quickstart: Validate the Sentry Integration

This guide applies during later implementation review. It does not authorize changing Vercel, Sentry, or production during planning.

## Prerequisites

- Node.js 22 and locked npm dependencies.
- Access to a Vercel-authenticated isolated Preview and private `trackora-ui` Sentry project.
- A trusted local executor, Vercel CLI pinned to `50.4.0` without adding an application dependency, and a least-privilege upload token supplied at execution time by an approved local secret provider.
- Reviewed inputs satisfying [environment-configuration.md](./contracts/environment-configuration.md).
- No upload token in Git, `.env` files, command arguments, deployment metadata, shared Preview variables, logs, browser output, or `.vercel/output`.
- No production merge until two distinct preview stages are complete and the synthetic mechanism's absence is verified in the final source tree and generated browser bundles.

## 1. Deterministic checks

Use the scripts established by implementation:

```bash
npm ci
npm test -- --watch=false
npm run test:build
npx tsc --noEmit
npm run build
git diff --check
```

Expected outcomes:

- Serialized mock-transport events contain none of the prohibited canaries in [runtime-monitoring.md](./contracts/runtime-monitoring.md).
- HTTP 4xx—including a response-body canary—cancellation, authentication expiry, authorization denial, validation failure, handled outcomes/notifications, reconnect, console, and routine activity emit zero events with their typed exclusion reasons; each isolated Angular/window-error/unhandled-rejection/bootstrap case emits exactly one.
- The installed integration list matches the approved 11.8.0 allowlist, with Sentry `GlobalHandlers` absent while Angular's browser-global provider remains active. Same-type/stack errors sanitize to the same grouping shape; different exception types or top in-app frames remain distinguishable.
- Across representative authentication, REST, Leaflet/map, live telemetry, historical replay, notification, and application-state workflows, absent, explicitly disabled, malformed/incomplete, valid-and-enabled, provider/transport-blocked, and internally failing monitoring leaves observable application behavior unchanged.
- Build tests prove ordinary local/CI builds need no Vercel/Sentry credential; monitored builds derive the release from a clean committed HEAD and reject dirty trees/arbitrary SHAs; unsupported, reserved-prefix, mismatched, or reused custom IDs fail; upload failure always blocks; cleanup runs safely after success/failure; exact browser/upload/Build Output identities match; and only a clean `enabled-prebuilt-ready` artifact can proceed.
- Normal local/CI build makes no upload attempt and remains within current budgets.
- A read-only Git-history scan checks credential names and approved non-secret fingerprints/patterns without receiving or printing real credential values; repository history remains unchanged.

## 2. Artifact and performance checks

Build baseline and implementation commits under identical conditions. Run the same startup and representative dashboard/map/live-update scenario at least five times per version and compare medians; attributable regression must be at most 5%.

Use deterministic temporary Build Output fixtures and mocked commands to validate packaging and the custom ID locally without deploying or contacting Production. Inspect both Angular output and the complete `.vercel/output` for no credential, privileged value, fixture secret, prohibited integration, `.map` file, source-map URL reference, symlink/path escape, or stage-forbidden verification code.

The trusted workflow must first prove that the repository is clean and committed, then derive the full SHA from Git `HEAD`. Generate a fresh custom deployment ID that is 1–32 ASCII letters/digits/hyphen/underscore, does not start `dpl_`, and has not been used in the project/evidence set. Use it unchanged for browser `dist`, Sentry upload `dist`, and `.vercel/output/config.json` `deploymentId`. Do not accept an independently supplied release SHA.

Supply `SENTRY_AUTH_TOKEN` to the local upload subprocess from the approved secret provider without echoing it or placing it in a command argument or file. Remove it from the Angular, Vercel packaging, and deployment subprocess environments. Abort if the chosen execution environment cannot enforce those boundaries.

## 3. Preview stage A: isolated synthetic-error verification

Before compilation, run the read-only project privacy preflight. It must verify project IP scrubbing and explicit pre-storage removal rules for `user.geo.city`, `user.geo.country_code`, `user.geo.region`, `user.geo.subdivision`, and `user.geo.subregion`; IP scrubbing alone is insufficient. The workflow must not change provider settings. Stop if the controls cannot be verified.

On a short-lived branch, temporarily add two clearly named, one-shot cases through the real initialization path: a deterministic `PromiseRejectionEvent` through Angular's existing listener followed, only after accepted transport completion, by the synthetic unexpected error. Emit only fixed trigger/handler/transport lifecycle markers—never payloads. Separately run `npm run test:browser-rejection` to prove a naturally unhandled Promise emits one native browser event; do not represent deterministic dispatch as that natural-rejection test. Commit that exact content as a clean Stage-A revision. Do not add a route, endpoint, UI control, query trigger, duplicate global handler, or production-capable remote switch. Configure the trusted local build with explicit `preview`, sample rate `1`, the public DSN, clean HEAD-derived release, and a fresh custom Build Output deployment ID. Keep the upload token local; do not configure it as a Vercel Preview variable.

Build locally through the guarded workflow, upload/validate maps, clean them, package `.vercel/output`, validate `config.json`, and scan the complete output. Missing token/map, dirty tree, identity mismatch, injection/upload failure, unsafe cleanup, or any final-output finding must fail. Then invoke only the reviewed equivalent of `vercel deploy --prebuilt --target=preview`; the deployed artifact must not be rebuilt. The command builder must reject `--prod`, production targets, promotion, production aliases, Production-variable changes, and secret-bearing arguments or metadata.

Open the preview once and verify:

1. Exactly one event appears for the synthetic unexpected error and exactly one appears for the unhandled promise rejection, with no duplicate issue/event from overlapping handlers.
2. Environment is `preview`; release is `trackora-ui@<clean-HEAD-full-sha>` and distribution equals the custom Build Output deployment ID in browser configuration, the uploaded artifact set, and `.vercel/output/config.json`. Record the internal Vercel `dpl_...` deployment-record ID separately.
3. The application frame resolves to original file, function, and line.
4. Only allowlisted fields remain; no credential, identity, fleet, vehicle, GPS, telemetry, body, header, cookie, query, or sensitive URL is present.
5. Likely map URLs and both local/deployed artifact inventories expose zero maps, map references, credentials, or sensitive fixture values.
6. Login, REST, map, live telemetry, reconnect, and notifications behave normally.

Automated tests separately prove unhandled-rejection and duplicate paths. Never deliberately trigger production.

Record the Stage-A Preview URL, clean commit SHA, custom deployment ID/dist, separate internal deployment-record ID, both event links/counts, and artifact checks. Do not record the token or sensitive values. Stage A is verification-only and its commit is never a production candidate.

## 4. Preview stage B: trigger-free production candidate

Remove `src/app/core/observability/sentry-preview-verification.ts`, both case names/sentinels, its import, and every other reference. Commit a new clean Stage-B revision, generate a different unused custom deployment ID, and use a separate isolated prebuilt Preview deployment; do not reuse the Stage-A artifact, custom ID, or deployment.

Before deploying, run all deterministic checks and retain command output proving:

1. A repository search finds neither verification case, filename, import, sentinel, trigger, route, UI control, nor remote switch in the final source tree.
2. A fresh optimized browser build and final `.vercel/output` contain neither case name, verification filename, sentinel, trigger symbol, import, route, nor verification-only chunk.
3. The complete `.vercel/output` inventory contains no maps, source-map references, credentials/privileged values, sensitive fixtures, symlinks, or path escapes, and its `deploymentId` equals browser/upload `dist`.

Deploy the exact trigger-free prebuilt output explicitly to Preview with the intended production monitoring policy except for Preview identity. Verify normal login, REST, map, telemetry, reconnect, and notification behavior; verify no synthetic event occurs; and retain the Stage-B Preview URL, clean commit SHA, custom deployment ID/dist, separate internal deployment-record ID, source-search output, final-output search, and artifact inventory. Only this distinct Stage-B commit is eligible to merge.

## 5. Production readiness and recovery

Inspect production scope before approval: enabled explicitly, rate `0.25`, single-source release/dist derivation, protected token, and no bypass input. Confirm the dated free-tier quota in the runbook, with normal use at no more than 20% and action at 50%.

Before production approval, perform a safe isolated-preview or tabletop exercise without modifying Production configuration. Time the normal Vercel enabled-value change plus redeployment procedure and demonstrate completion in under 10 minutes. Separately time identification of the authorized provider project/key shutdown action and prior immutable deployment for rollback in under 5 minutes. Record participants, assumptions, start/end timestamps, elapsed times, and gaps in the runbook; do not execute provider shutdown during a tabletop.

Normal production disablement changes the Vercel enabled value and redeploys the intended commit, targeting under 10 minutes. If that cannot stop events, an authorized owner disables the provider project/key, records the incident, and reconciles deployment configuration. Rollback redeploys the last known-good immutable Vercel deployment.

Source-map upload failure has no emergency path in this feature and always blocks publication. Record the failure and retry only after the upload service or configuration is healthy. If Trackora later needs an owner-controlled bypass, create and approve a separate GitHub issue and specification before introducing any bypass input or successful state.

## 6. Post-production read-only artifact verification

After an authorized merge has deployed production, a release owner performs read-only requests against the production asset inventory and likely/derived source-map URLs. Confirm zero `.map` files or source-map references are publicly retrievable, record the production deployment ID and immutable release, and compare them with the privately uploaded artifact set. Do not trigger a production error, change Production configuration, expose credentials, or treat this observation as permission to deploy.
