package action

import (
	"os"
	"testing"
)

func TestVarsFromEnv(t *testing.T) {
	// Test case 1: GITHUB_ACTIONS environment variable is not set
	os.Unsetenv("GITHUB_ACTIONS")
	_, err := VarsFromEnv()
	if err == nil {
		t.Error("Expected error when GITHUB_ACTIONS environment variable is not set, got nil")
	}

	// Test case 2: GITHUB_ACTIONS environment variable is set to false
	os.Setenv("GITHUB_ACTIONS", "false")
	_, err = VarsFromEnv()
	if err == nil {
		t.Error("Expected error when GITHUB_ACTIONS environment variable is set to false, got nil")
	}

	// Test case 3: GITHUB_ACTIONS environment variable is set to true
	os.Setenv("GITHUB_ACTIONS", "true")
	os.Setenv("GITHUB_EVENT_NAME", "foo")
	os.Setenv("GITHUB_EVENT_PATH", "/foo/bar/baz.json")
	ghVars, err := VarsFromEnv()
	if err != nil {
		t.Errorf("Unexpected error when GITHUB_ACTIONS environment variable is set to true: %v", err)
	}
	if !ghVars.GithubActions {
		t.Error("Expected GithubActions field in GitHubVariables struct to be true, got false")
	}
	if ghVars.GithubEventName != "foo" {
		t.Error("Expected GithubEventName field in GitHubVariables struct to be \"foo\"")
	}
	if ghVars.GithubEventPath != "/foo/bar/baz.json" {
		t.Error("Expected GithubEventPath field in GitHubVariables struct to be \"/foo/bar/baz.json\"")
	}
}
