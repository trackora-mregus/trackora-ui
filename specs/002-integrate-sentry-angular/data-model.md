# Phase 1 Data Model: Frontend Error Monitoring

These are typed configuration and operational models, not persisted domain entities. They must never acquire fleet, vehicle, user, GPS, or telemetry fields.

## MonitoringConfiguration

| Field         | Type                                          | Validation                                                      |
| ------------- | --------------------------------------------- | --------------------------------------------------------------- |
| `enabled`     | boolean                                       | Must be explicitly true; false/absent is Disabled.              |
| `dsn`         | string                                        | HTTPS Sentry ingestion DSN only; never a privileged token.      |
| `environment` | `production \| preview \| local-verification` | Explicit allowlist; normal local builds disabled.               |
| `release`     | string                                        | `trackora-ui@` plus full SHA derived from clean committed HEAD. |
| `dist`        | string                                        | Exact custom Build Output deployment ID; never internal `dpl_`. |
| `sampleRate`  | number                                        | Finite `[0,1]`; production 0.25, acceptance preview 1, local 0. |

```text
Raw values -> absent/disabled -> Disabled
           -> malformed       -> Disabled + safe diagnostic
           -> valid           -> EnabledConfiguration
```

Validation never throws into startup or logs configuration values.

## ErrorCandidate and CaptureDecision

An `ErrorCandidate` contains only source (`angular` or `bootstrap`), an ephemeral `unknown` error reference, and internal duplicate state. It is never attached as event context.

`CaptureDecision` is an exhaustive `capture` or `exclude` plus a safe fixed reason code. Expected exclusions are typed as `http-4xx`, `cancellation`, `authentication-expiry`, `authorization-denial`, `validation-failure`, `handled-outcome`, or `routine-reconnect`; internal decisions use `duplicate`, `monitoring-disabled`, `monitoring-failure`, or `eligible-unexpected`. Classifier uncertainty produces `exclude` without retaining the raw value.

```text
Candidate -> classify -> Excluded
                      -> Eligible -> SDK prepare -> Sanitized -> sampled/sent
                                             failure/residue -> Dropped
```

## SanitizedErrorEvent

Allowed fields only:

| Field                            | Rule                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `event_id`, `timestamp`          | SDK event identity and time.                                                     |
| `level`, `platform`              | Fixed `error` and browser JavaScript platform.                                   |
| `environment`, `release`, `dist` | Exact validated clean-HEAD/custom-Build-Output configuration.                    |
| `exception.values[].type`        | Bounded class/type string.                                                       |
| `exception.values[].value`       | Constant `[redacted]`.                                                           |
| stack frames                     | Sanitized app-relative filename, safe function, line, column, `in_app`.          |
| `debug_meta`                     | Validated debug IDs/code-file references needed for symbolication.               |
| `sdk`                            | Minimal name/version/integration metadata after unsafe integrations are removed. |

All other data is rejected, including user, request, breadcrumbs, contexts, extras, tags, fingerprint, modules, mechanisms with arbitrary data, spans/transactions/profiles/replay/logs, headers, bodies, cookies, query strings, source context, and frame variables.

## PrebuiltDeploymentIdentity

| Field                         | Rule                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `headSha`                     | Full lowercase hexadecimal SHA read from actual committed Git `HEAD`.                              |
| `worktreeClean`               | Required true before monitored build; staged, unstaged, or untracked content rejects it.           |
| `release`                     | Exactly `trackora-ui@<headSha>`; no independent SHA input.                                         |
| `customDeploymentId` / `dist` | Generated as `trk-` + 28 random lowercase hex; valid contract is 1–32 `[A-Za-z0-9_-]`, not `dpl_`. |
| `internalDeploymentRecordId`  | Server-generated Vercel `dpl_...` evidence recorded only after deployment; never `dist`.           |
| `target`                      | Exactly `preview` for verification; no production/promotion/alias state is representable.          |

The custom ID is generated from 14 cryptographically random bytes before compilation. Browser configuration, Sentry upload, and Build Output configuration reference the same immutable value. Deterministic tests stub entropy and reject known/reused Stage/evidence fixture IDs; Vercel's project-level uniqueness rejection remains the authoritative hosted guard and must fail the Preview deployment rather than trigger regeneration after build.

## SourceMapArtifactSet

| Field                 | Rule                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `release`             | Exactly equals browser `trackora-ui@<clean HEAD SHA>` and build evidence. |
| `dist`                | Exactly equals browser/upload custom Build Output deployment ID.          |
| `outputDirectory`     | Resolved descendant of the repository's Angular browser output.           |
| `javascriptFiles`     | Nonempty minified deployable application scripts.                         |
| `mapFiles`            | Nonempty before upload; zero after cleanup.                               |
| `debugIdsInjected`    | Required before upload.                                                   |
| `uploadValidated`     | True only after successful CLI completion for exact org/project/release.  |
| `publicMapsRemaining` | Must be zero before packaging and deploy.                                 |

## PrebuiltArtifactSet

| Field                      | Rule                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| `root`                     | Canonical `.vercel/output` beneath the isolated workspace; symlinks/path escape forbidden.     |
| `configDeploymentId`       | Exactly equals `PrebuiltDeploymentIdentity.customDeploymentId`.                                |
| `sourceMaps`               | Zero files and zero `sourceMappingURL` references.                                             |
| `credentialFindings`       | Zero token names/values or privileged-variable values.                                         |
| `sensitiveFixtureFindings` | Zero approved privacy-canary values.                                                           |
| `verificationCodeFindings` | Stage A: only reviewed named one-shot cases; Stage B: zero files, symbols, imports, sentinels. |
| `deploymentCommand`        | Prebuilt with explicit `preview`; production, promotion, and alias operations are invalid.     |

```text
CleanCommit -> MapsPresent -> IDsInjected -> UploadSucceeded -> MapsDeleted
                                      \-> UploadFailed ----------------> Blocked
MapsDeleted -> PrebuiltPackaged -> IdentityValidated -> FullOutputScanned -> PreviewReady
Any cleanup/package/mismatch/scan failure -----------------------------> Blocked
```

There are exactly two successful terminal states: `disabled` and `enabled-prebuilt-ready`. No approval or input model can transform `UploadFailed` or an unsafe package into a deployable state.

## Future Emergency Bypass

No bypass entity, credential, approval object, environment variable, or build state exists in this feature. Any future owner-controlled bypass requires a separately approved issue and design; it must not be inferred from this data model.

## SyntheticVerificationCase

Each of the two cases—`synthetic-unexpected-error` and `synthetic-unhandled-rejection`—has a fixed name, `preview` environment, sample rate 1, expected count 1, and a `mechanismPresent` lifecycle. Stage A and Stage B each have a distinct clean commit, custom deployment ID, internal deployment-record ID, Preview URL, and evidence record:

```text
Planned -> PreviewDeployed -> TriggeredOnce -> Verified -> Removed -> AbsenceVerified
```
