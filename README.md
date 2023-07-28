Release Tools
=============

This project contains tooling for creating and managing releases for the Konveyor organization.

## Available Workflows
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkonveyor%2Frelease-tools.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkonveyor%2Frelease-tools?ref=badge_shield)


### Prepare repository for release

See [workflow file here](./github/workflows/prep-release.yaml)

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

# Contributing

We welcome contributions to this project! If you're interested in contributing,
please read the [konveyor/community CONTRIBUTING doc](https://github.com/konveyor/community/blob/main/CONTRIBUTING.md)
for more information on how to get started.

# Code of Conduct

Refer to Konveyor's Code of Conduct [here](https://github.com/konveyor/community/blob/main/CODE_OF_CONDUCT.md).


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkonveyor%2Frelease-tools.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkonveyor%2Frelease-tools?ref=badge_large)