# GitHub Actions pinning

Enable verification and automated update PRs with a caller workflow. The
workflow inputs own the repository's policy; no pinact configuration file or
local Make targets are required.

~~~yaml
name: Action pins
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '23 6 * * 1'
  workflow_dispatch:
    inputs:
      dry-run:
        description: Preview updates without opening a PR
        type: boolean
        default: false

permissions:
  contents: read

jobs:
  pins:
    uses: konveyor/release-tools/.github/workflows/action-pins.yml@<commit-sha>
    with:
      mode: ${{ github.event_name == 'pull_request' && 'verify' || 'update' }}
      dry-run: ${{ github.event_name == 'workflow_dispatch' && inputs.dry-run || false }}
      ignore-actions: |
        konveyor/release-tools/*
        konveyor/ci/*
    secrets:
      app-private-key: ${{ secrets.KONVEYOR_BOT_KEY }}
~~~

Use the repository's actual default branch in the push trigger. Pin the
reusable workflow to a reviewed commit. It also pins its action implementation
and third-party dependencies, so subsequent changes to release-tools do not
change an existing caller's behavior.

## Behavior

PR events verify pins without editing files or using bot credentials. Verification
checks full commit SHA syntax and version annotations offline; it does not
prove that a SHA exists or agrees with its annotation.

Default-branch pushes, schedules, and manual runs update to the latest eligible
versions, including major upgrades, then maintain one PR on the reserved
automation/update-action-pins branch. Commits carry a DCO sign-off and the PR
uses the :seedling: infrastructure title prefix. Normal CI and review apply;
the workflow does not merge PRs. A no-change run creates no PR, and an obsolete
bot PR is closed when its changes are already present on the default branch.
Keep this reserved branch dedicated to the updater.

A dry-run performs the same pinact update but only prints the diff. It uses the
runner's read token for public action lookups and does not mint a write token,
push a branch, or submit a PR.

All tracked .github/workflows/*.yml/yaml files and tracked action.yml/action.yaml
files at any depth are inspected. Untracked files and non-action YAML are not
selected. A checkout with no action/workflow files fails rather than passing
without checking anything. Symlinked action definitions are rejected.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| mode | verify | verify or update |
| ignore-actions | empty | Newline-separated action/workflow name globs, optionally followed by @ref |
| dry-run | false | Preview an update without publishing it |
| app-id | caller's KONVEYOR_BOT_ID variable | App identity for update runs |

Ignore patterns support * and ?. For example, owner/repo/* matches subpaths in
that repository, while owner/repo/path@main only exempts that reference. Names
and refs are matched in full. Empty lines and lines beginning with # are ignored.
There are no implicit Konveyor exceptions. Version annotations on SHA pins do
not change how their actual ref is matched.

An existing .pinact.yaml and machine-global pinact configuration are not policy
sources for this workflow. The action generates temporary configuration from
inputs and supplies the tracked file list explicitly to avoid silently scanning
the shared action's directory or omitting composite actions.

## Authentication

Update runs use a GitHub App installed on the calling repository, with Contents,
Pull requests, and Workflows write permissions. Set KONVEYOR_BOT_ID as an
accessible repository/organization variable (or supply app-id), and pass its
private key as the app-private-key secret. Tokens are restricted to the calling
repository and revoked after the job. PR verification and dry-runs do not require
the App key.

An App token also lets CI run normally on generated PRs. Repository GITHUB_TOKEN
behavior is different: automated PR checks may require manual workflow approval.
See [GitHub App permissions](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app)
and [GITHUB_TOKEN behavior](https://docs.github.com/en/actions/concepts/security/github_token).

The installed konveyor-ci-bot did not have Workflows write permission when this
integration was prepared. Its owner must grant that permission and approve the
installation change before a live update run can edit workflow files.

## Validation

The action uses checksum-pinned pinact v4.1.1 binaries on Linux amd64/arm64.
Tests exercise the real offline verifier against temporary git repositories:
deep composite discovery, read-only verification, explicit and precisely scoped
ignores, and missing policies. A mocked updater checks wrapper flags and change
reporting; further tests cover configuration isolation and rejecting a tampered
binary archive. These tests do not substitute for the live PR trial below.

For an adoption trial, first run a preview on the consuming repository. Inspect
the diff and ignored references, then run an update with the App token. Confirm
the generated PR's checks run, its sign-off/title are accepted, and rerunning
updates reuses the same PR rather than opening another.
