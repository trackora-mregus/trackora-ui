# Contract: Environment Configuration

## Public browser inputs

| Value             | Source and validation                                                 | Default                                                              |
| ----------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Enabled           | Explicit deployment-scoped boolean                                    | false                                                                |
| DSN               | HTTPS Sentry ingestion DSN; no management authority                   | absent/disabled                                                      |
| Environment       | Explicit allowlist; trusted verification is exactly `preview`         | local disabled                                                       |
| Release           | `trackora-ui@` plus full SHA derived from actual clean committed HEAD | invalid outside controlled build                                     |
| Distribution      | Exact custom Build Output deployment ID from trusted build identity   | invalid outside controlled build                                     |
| Error sample rate | Finite number `[0,1]`                                                 | production 0.25 when enabled; acceptance preview explicit 1; local 0 |

Implementation must document distinct `TRACKORA_SENTRY_*` names for public policy inputs. Missing/malformed browser inputs disable initialization without affecting application startup.

## Protected build inputs

| Value                                    | Scope                                                                             | Browser exposure |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ---------------- |
| `SENTRY_AUTH_TOKEN`                      | Trusted local Preview upload process; separately protected Production build scope | Forbidden        |
| Org `trackora-o4`, project `trackora-ui` | Trusted build configuration                                                       | Not injected     |

The token is never stored in Git, a frontend environment file, `.vercel/output`, a shared Preview variable, a command argument, deployment metadata, test fixture, or log. For prebuilt Preview verification, the trusted local process passes it only to the Sentry upload subprocess and removes it from Angular, Vercel packaging, and deployment subprocess environments. Production retains its separately protected build-secret handling. Tests scan final Build Output for privileged names/values and sensitive fixture values.

No emergency-bypass variable or credential is defined or recognized. Repository files, pull-request values, Vercel variables, URLs, CLI arguments, and approval references cannot convert an upload failure into success. A future bypass mechanism requires a separately approved issue and contract revision.

## Policy matrix

| Environment                         |            Runtime |                      Sampling | Release                       | Upload                         |
| ----------------------------------- | -----------------: | ----------------------------: | ----------------------------- | ------------------------------ |
| Normal local/CI                     |                Off |                             0 | None                          | Never                          |
| Trusted prebuilt acceptance Preview |        Explicit on |                             1 | Full clean committed HEAD SHA | Local; required/blocking       |
| Other preview                       | Explicit per scope | Conservative configured value | Full clean committed HEAD SHA | Required/blocking when enabled |
| Production                          |        Explicit on |                0.25 initially | Full clean committed HEAD SHA | Required; failure blocks       |

An explicitly monitored build with a dirty tree, uncommitted content, invalid derived HEAD SHA, invalid/reused custom deployment ID, missing upload token, or identity mismatch fails rather than producing a deployable monitored release. Release and distribution are derived once by the trusted build and cannot be configured independently for browser, upload, or Build Output paths. The custom ID must be 1–32 ASCII letters/digits/hyphen/underscore, must not begin `dpl_`, and must differ between Stage A and Stage B. The server-generated internal Vercel deployment-record ID is evidence only.

Upload or validation failure blocks both Preview and Production publication. No environment scope accepts bypass values.

Trusted verification constructs only an explicit prebuilt `preview` deployment. Production targeting, `--prod`, promotion, production aliases, and Production-variable changes are invalid operations and must be rejected before invoking Vercel.

Normal disablement changes the production-scoped enabled value and redeploys the intended commit. No remote runtime switch is introduced. Provider project/key shutdown is reserved for an emergency and must be reconciled afterward.
