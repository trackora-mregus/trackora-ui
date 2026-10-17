# Contract: Deployment, Release, and Source Maps

## Guarded build transaction

The workflow has exactly two successful terminal states: `disabled` and `enabled-prebuilt-ready`. Every other combination fails. Normal local/CI builds and explicitly disabled builds take the existing ordinary Angular-build path: no credential requirement, no network call, current source-map behavior, and runtime monitoring disabled.

For an enabled trusted prebuilt Preview build:

1. Require a clean committed repository: no staged, unstaged, or untracked content. Read the full 40-character hexadecimal SHA directly from Git `HEAD`; do not trust a supplied SHA. Compute `release = trackora-ui@<full HEAD SHA>` once.
2. Generate or accept only a workflow-generated unique custom Build Output deployment ID: 1–32 ASCII letters/digits/hyphen/underscore, no `dpl_` prefix, and no known reuse within the project/evidence set. Set `dist` to that custom ID. Pass release/dist unchanged to browser configuration and Sentry CLI.
3. Validate explicit `preview`, public policy, fixed org/project, and a token obtained from an approved local secret provider without printing or persisting it. The token may reach only the upload subprocess; remove it from Angular, packaging, and deployment environments.
4. Canonicalize the configured Angular browser output before build, require it to be a descendant of the isolated workspace's dedicated build-output directory, and record its pre-build inventory. Run the existing optimized Angular build with hidden script maps and no public map references.
5. Manifest only new/replaced map/JS pairs from this invocation. Reject symlinks, path escape, an empty generated set, or maps without a corresponding JS file. If Angular exits nonzero after creating partial artifacts, enter the same bounded cleanup path and retain the original build failure.
6. Inject debug IDs into the exact manifested pairs and upload them to `trackora-o4/trackora-ui` under the exact release/dist.
7. Require `@sentry/cli@3.8.0` upload with `--validate` to exit zero. A friendly log line is not proof; upload/validation failure is fatal.
8. In a `finally`-equivalent path after artifact generation begins, delete only manifested `.map` files whose canonical paths remain beneath the validated output root. Cleanup runs after upload success or upload failure.
9. Package the sanitized application through Vercel's supported local Build Output workflow. Write and validate the same custom ID as `.vercel/output/config.json` `deploymentId`; reject a missing, overwritten, or mismatched value.
10. Recursively scan the complete canonical `.vercel/output`. Reject symlinks/path escape, `.map` files, `sourceMappingURL` references, upload-token names or values, other privileged-variable values, sensitive fixture values, and verification-only files/symbols/imports/sentinels forbidden for the current stage. Compare actual secret values only inside the trusted scanner's memory; never pass them as command arguments, echo them, or include them in finding text.
11. Construct only an explicit prebuilt Preview deployment invocation. Reject Production targeting, `--prod`, promote, production aliases, Production-variable changes, secret-bearing arguments, and secret-bearing metadata.
12. Return `enabled-prebuilt-ready`; the later authorized Preview step uploads exactly this `.vercel/output` without rebuilding it.

Git validation, identity generation, Angular build, injection, upload, cleanup, packaging, config matching, final-output scanning, and Preview-command validation failures exit nonzero. No failure can be converted to `enabled-prebuilt-ready` by any input. Logs emit only the non-secret terminal state, release, and custom dist so operators cannot mistake disabled output or a failed/unsafe package for a deployable monitored release.

## Emergency bypass

Emergency bypass is unimplemented and hard-disabled. The wrapper recognizes no bypass state, grant, approval URL, repository/PR input, Vercel variable, CLI flag, or other authorization input. Every enabled upload or validation failure blocks publication.

If an operational need for bypass is later established, it must be proposed in a separate approved GitHub issue and specification. That future work must define an owner-controlled deployment mechanism, threat model, approver identity, protected enforcement, audit evidence, expiry, cleanup, and tests before this contract may add another successful state.

## Responsibility split

GitHub Actions runs deterministic unit, build-contract, type, ordinary optimized-build, and fixture Build Output checks with no upload token or provider call. The trusted local executor performs private upload and exact packaging before an authorized operator invokes Vercel's prebuilt Preview upload. Vercel receives no upload token and performs no rebuild. A post-deploy source-map upload is not a substitute because it can race publication.

## Production boundary

This trusted prebuilt procedure authorizes Preview verification only and does not replace or invoke Trackora's automatic Production deployment. The shared identity and packaging helpers must nevertheless prove deterministically that an enabled Production build also generates a valid custom Build Output ID, uses it for browser/upload/config, and cannot report success before upload, cleanup, packaging, and final-output validation finish. If the Vercel Production builder cannot preserve that custom `deploymentId`, Production enablement and merge remain blocked; the workflow must not fall back to the internal `dpl_...` record ID, skip the gate, use the Preview procedure to deploy Production, or change Production configuration during verification.

## Acceptance evidence

Record two separate clean-commit prebuilt Preview stages. For Stage A, record its Preview URL, clean HEAD SHA, custom Build Output deployment ID/Sentry dist, separate internal Vercel deployment-record ID, matching browser/upload/config release/dist, `enabled-prebuilt-ready`, exactly one symbolicated event for each verification case, serialized privacy review, failed public-map requests, and clean `.vercel/output` inventory. For Stage B, record a different clean trigger-free commit, different custom ID, and different deployment plus searches proving both verification cases, their imports, sentinels, symbols, routes, and verification-only chunks are absent from the source tree and final Build Output; also record zero deployed maps, normal runtime behavior, and no synthetic event. Evidence contains no token or sensitive value. Inspect production configuration at 0.25 without generating a production error. After an authorized production deployment, record read-only public-artifact probes showing zero retrievable maps without triggering an error.
