package action

import (
	"fmt"

	env "github.com/Netflix/go-env"
)

// Found in https://github.com/sethvargo/go-githubactions/blob/48e464e56805d546f9b24b8d260758c9b62e47c0/actions.go#L461
// but noticed that https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
// has a lot more that we may want to leverage in the future, so here we have
// another custom type.
type GitHubVariables struct {
	// These may be useful for us when testing/debugging actions
	CI            bool `env:"CI"`
	GithubActions bool `env:"GITHUB_ACTIONS"`

	GithubEventName string `env:"GITHUB_EVENT_NAME"`
	GithubEventPath string `env:"GITHUB_EVENT_PATH"`
}

// VarsFromEnv retrieves GitHubVariables struct from the environment
// and returns it along with an error. It returns an error if GITHUB_ACTIONS
// environment is not set to "true", which is guaranteed when run on a GitHub
// runner.
func VarsFromEnv() (GitHubVariables, error) {
	var ghContext GitHubVariables
	_, err := env.UnmarshalFromEnviron(&ghContext)
	if err != nil {
		return GitHubVariables{}, err
	}

	// If this isn't a GitHub Action environment, we should say something
	if !ghContext.GithubActions {
		return GitHubVariables{}, fmt.Errorf("GITHUB_ACTIONS false.")
	}
	return ghContext, nil
}
