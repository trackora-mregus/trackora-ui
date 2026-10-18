# GitHub Development Workflow

Trackora uses GitHub issues, issue-numbered branches, pull requests, review, and CI as one traceable frontend workflow. Spec Kit is included for work that needs formal design artifacts.

```text
Issue -> Spec Kit when required -> Branch -> Implementation -> Tests -> Pull Request -> Review -> CI -> Approved merge -> Vercel production deployment
```

## 1. Create or select a GitHub issue

Every change begins with one issue in `mregus/trackora-ui`, using the appropriate bug, feature, security-remediation, or technical-debt form. The issue defines the problem, scope, acceptance criteria, risk, and verification expectations.

Never put credentials, tokens, tenant data, sensitive documents, precise GPS, raw telemetry, personal data, or unpatched exploit details in an issue. Use GitHub private vulnerability reporting for sensitive security reports.

Add the issue to the private **Trackora Engineering** project when possible and set its existing Status, Priority, Story Type, and Area fields. Project metadata supplements the issue; it does not replace acceptance criteria.

## 2. Use Spec Kit when required

Spec Kit 1.0.8 is already installed for Codex under `.specify/` and `.agents/skills/speckit-*`. Do not reinitialize it for ordinary work.

The recommended manual skill sequence is:

```text
speckit-specify -> speckit-clarify -> speckit-plan -> speckit-tasks -> speckit-analyze -> speckit-implement
```

A specification is expected when work materially affects architecture, infrastructure, data ownership, security boundaries, telemetry semantics, or public REST/WebSocket contracts. Review specifications and plans before implementation. Small, well-understood maintenance changes may explain in the pull request why full artifacts are unnecessary.

## 3. Create an issue-numbered branch

Use `$branching-strategy`. Branch names must match:

```text
<type>/<issue-number>-<lowercase-kebab-case-slug>
```

Allowed types are `feature`, `fix`, `security`, and `chore`. For example:

```text
feature/1-codex-development-workflow
fix/42-preserve-partial-telemetry
security/43-protect-fleet-routes
chore/44-update-ci-toolchain
```

Never implement directly on `main` or push directly to it. Preserve unrelated local changes and obtain explicit authorization before commit, push, rebase, force-push, branch deletion, pull-request creation, or merge when operating through Codex.

When Spec Kit branch automation is used, pass the approved branch explicitly:

```bash
GIT_BRANCH_NAME=feature/1-codex-development-workflow
```

Spec Kit feature-directory numbering remains independent from the GitHub issue and Git branch.

## 4. Work with Codex in WebStorm

1. Give Codex the issue number and intended outcome.
2. Ask it to inspect `AGENTS.md`, the constitution, repository status, relevant code/tests, and the GitHub issue before editing.
3. Authorize only the Git and GitHub mutations required for the current task. Branch creation does not implicitly authorize commit, push, PR creation, merge, or deployment.
4. Keep WebStorm's change list visible and review the diff throughout the task. Do not mix personal or unrelated working-tree changes into Codex's commit.
5. Require exact validation results and a `$code-review` pass before opening a pull request.

### Recover when Codex stops mid-task

Codex work is ordinary repository state; it does not require a special recovery mechanism.

1. Inspect `git status --short --branch`, `git diff`, and `git diff --staged`.
2. Confirm the current branch and governing issue before continuing.
3. Read any applicable `specs/<feature>/` artifacts and task checkboxes to re-establish intent.
4. Run the narrowest relevant test before resuming edits.
5. Continue on the existing compliant branch when its changes belong to the issue. Do not reset, clean, stash, or discard unknown work.
6. If ownership or intent is unclear, stop and ask rather than guessing.

## 5. Implement and verify

Follow `AGENTS.md` and `.specify/memory/constitution.md`. Keep components focused on presentation and services focused on HTTP/WebSocket integration. Treat backend contracts and tenant boundaries as security-sensitive.

Use locked dependencies and run applicable checks:

```bash
npm ci
npx tsc -p tsconfig.app.json --noEmit
npm test -- --watch=false
npm run test:build
npm run build
```

Sentry operations and private source-map release checks are documented in [../operations/sentry.md](../operations/sentry.md). `npm run build` remains credential-free when monitoring is absent or disabled; an enabled Vercel build is fail-closed. Synthetic monitoring errors are allowed only in an isolated protected preview and must never remain in a production candidate or be triggered in Production.

For trusted Preview verification, start from a clean committed revision and inject the upload token from an approved local secret provider without putting it in a command, file, shared Preview variable, or generated artifact. Run `npm run build:prebuilt-preview` to prepare and scan the trigger-free `.vercel/output` without deploying. Only a separately authorized operator may run `npm run deploy:prebuilt-preview`; it validates the repository link, rescans the prepared artifact, and invokes pinned Vercel CLI `64.5.0` with the fixed `deploy --prebuilt --target=preview` argument list. It cannot rebuild, regenerate identifiers, upload source maps, accept passthrough flags, target Production, promote, or create an alias.

The monitored build derives `trackora-ui@<full HEAD SHA>` from Git and generates one custom Build Output deployment ID used by the browser, Sentry upload, and `.vercel/output/config.json`. Source-map upload, cleanup, packaging, identity, or final-scan failure blocks readiness unconditionally. Stage A and trigger-free Stage B require distinct clean commits and distinct IDs. Never run a synthetic error in Production.

There is currently no lint script or ESLint configuration. Prettier can be checked on applicable changed files with `npx prettier --check <files>`. Record exact commands and results in the pull request, including unavailable checks and manual browser validation.

## 6. Open a pull request

Open the pull request against `main`, link the issue with `Closes #<number>`, and complete every applicable section of the template:

- Spec Kit artifacts or an exemption rationale
- exact test, TypeScript, build, formatting, and manual-check evidence
- tenant isolation, authentication, privacy, and backend compatibility
- risk assessment
- rollout and rollback

Keep one pull request focused on one issue. Do not include generated build output, local IDE state, secrets, or unrelated refactors.

## 7. Review and CI

Use `$code-review` against the complete diff, issue, constitution, and applicable Spec Kit artifacts. Resolve blocking findings before approval.

The pull request must pass:

- `Validate PR branch / Enforce issue branch name`
- `Frontend CI / build`
- any additional required checks configured in GitHub

Do not weaken or bypass checks to obtain a green result. A repository administrator must configure required checks and reviews through GitHub rulesets.

## 8. Merge and production safety

`main` is connected to Vercel production. Merging or pushing to `main` can deploy immediately. A preview deployment may also be created for the pull request; treat preview configuration and shared backend access as sensitive.

Before merging:

- review the final diff and commit list;
- confirm required approvals and checks;
- verify production environment-variable requirements without copying secrets into the PR;
- confirm backend/frontend deployment order and compatibility;
- define post-deployment checks and rollback;
- obtain explicit merge approval.

Codex must not merge or manually deploy merely because review is complete. If rollback is required after merge, prefer a reviewed revert or corrective pull request; do not force-push `main`. Remember that the rollback merge is itself a production deployment.

## Repository administrator configuration

Configure a `main` ruleset to:

- require pull requests and at least one approving review;
- dismiss stale approvals and require conversation resolution;
- require `Enforce issue branch name` and the frontend build check;
- restrict direct pushes, force pushes, and branch deletion;
- prevent bypass except for documented emergency administrators.

Enable private vulnerability reporting before relying on the security form's private-report link. Repository settings are administrative controls and are not created merely by committing these workflow files.
