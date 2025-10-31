Release Tools
=============

This project contains, or should contain, all of the configuration and
automation to maintain, build, and release Konveyor.

Check out the [config.yaml](./pkg/config/config.yaml) to see:

1. The repositories we are managing
1. The Labels we are configuring in repositories
1. The milestones we are configuring in repositories

This allows us to have a single source of truth to make sure that, as we create
enhancments, issues, and pull requests, they can be tracked properly.

You can find our reusable GitHub Workflows in [./.github/workflows](./.github/workflows).

## Available Workflows

### Prepare repository for release

See [workflow file here](./.github/workflows/prep-release.yaml)

This workflow should be called when a new release branch is created. When invoked, it does the following:

- update specified base images in the Dockerfile to use the right release tags
- update specified golang deps to track the right release branch
- commits the results back to the originating branch

Before doing the actual changes, it checks if the originating branch matches the pattern `release-X.Y` where X and Y are integers representing major and minor versions for the release.

It accepts following inputs:

* branch\_ref (Required): This is the ref of the branch. Only branches of format `refs/heads/release-X.Y` will enable the workflow to do the actual replacement of tags in Dockerfile. All other branches are ignored. `${{ github.ref }}` in the original repo should be used to get the value for this variable.

* images\_to\_update: This is a list of images in the Dockerfile for which you want to update the tags. It should be a JSON array string e.g. `'["quay.io/konveyor/operator"]'`. Defaults to `'[]'`.

* go_deps\_to\_update: This is a list of go deps in the go.mod file for which you want to update the branches. It should be a JSON array string e.g. `'["github.com/konveyor/analyzer-lsp"]'`. Defaults to `'[]'`.

* dockerfile: This is the relative path to the Dockerfile in the repo. Defaults to `./Dockerfile`.

## Available Tools

### Stale Issue Workflow Deployment

See [stale-workflow directory](./stale-workflow/)

This tool helps deploy a GitHub Actions workflow to automatically mark stale issues and pull requests across Konveyor repositories. The workflow:

- Marks issues and PRs as stale after 60 days of inactivity
- Does not auto-close items (only marks them for visibility)
- Exempts items with specific labels or assignees
- Automatically removes the stale label when items are updated

The deployment script can target specific repositories or all repositories in an organization at once.

For detailed usage instructions, see the [stale-workflow README](./stale-workflow/README.md).

# Contributing

We welcome contributions to this project! If you're interested in contributing,
please read the [konveyor/community CONTRIBUTING doc](https://github.com/konveyor/community/blob/main/CONTRIBUTING.md)
for more information on how to get started.

# Code of Conduct

Refer to Konveyor's Code of Conduct [here](https://github.com/konveyor/community/blob/main/CODE_OF_CONDUCT.md).

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkonveyor%2Frelease-tools.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkonveyor%2Frelease-tools?ref=badge_shield)
