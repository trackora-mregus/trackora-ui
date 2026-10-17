---
name: 'branching-strategy'
description: 'Plan, validate, or create Trackora frontend branches tied to GitHub issues while protecting the Vercel production branch.'
metadata:
  author: 'trackora'
  source: 'repository-workflow'
---

# Branching Strategy

Use this skill when choosing, validating, or creating a branch for frontend work.

## Required inputs

- A real GitHub issue number in `mregus/trackora-ui`.
- One change type: `feature`, `fix`, `security`, or `chore`.
- A short lowercase kebab-case slug describing the issue.

The branch name MUST match:

```text
<type>/<issue-number>-<slug>
```

Examples:

```text
feature/1-codex-development-workflow
fix/42-preserve-partial-telemetry
security/43-protect-fleet-routes
chore/44-update-ci-toolchain
```

The validation pattern is:

```regex
^(feature|fix|security|chore)/([1-9][0-9]*)-[a-z0-9]+(-[a-z0-9]+)*$
```

## Workflow

1. Read `AGENTS.md`, `.specify/memory/constitution.md`, and the governing GitHub issue.
2. Inspect `git status --short --branch`, the current branch, and the intended base.
3. Confirm the issue exists in `mregus/trackora-ui` and is an issue rather than a pull request. Do not invent a number or use a placeholder.
4. Preserve all existing working-tree changes. Do not stash, reset, clean, or discard them without explicit approval.
5. Create or switch to the issue branch only when branch creation is authorized.
6. Verify the resulting name and report any pre-existing changes that followed onto it.
7. Keep the branch and pull request focused on one issue, and link the issue with `Closes #<number>` in the pull request.

## Spec Kit compatibility

When Spec Kit branch automation is used, pass the complete approved branch name through `GIT_BRANCH_NAME`, for example:

```bash
GIT_BRANCH_NAME=feature/1-codex-development-workflow
```

Do not allow Spec Kit's default numeric branch generator to replace the issue-numbered name. The Spec Kit feature directory number is independent of the GitHub issue number and Git branch.

## Automation and production safety

- Automated dependency and release work still requires an issue and a compliant `chore/<issue-number>-<slug>` branch. Do not add broad bot, release, actor, or prefix bypasses.
- `main` is the production branch. A merge or direct push to `main` triggers a Vercel production deployment.
- Never implement or commit directly on `main`, and never push directly to it.
- Never merge, force-push, rewrite shared history, delete a branch, or change Git configuration without explicit authorization.
- Creating a branch does not authorize commit, push, pull-request creation, merge, or deployment; remain within the user's requested scope.
- If the issue, type, base, existing-change ownership, or authorization is unclear, stop before mutating Git state and ask.
