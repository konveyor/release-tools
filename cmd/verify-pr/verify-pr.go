package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/google/go-github/v55/github"
	"github.com/konveyor/release-tools/pkg/action"
	"github.com/konveyor/release-tools/pkg/pr"
)

func main() {

	ghContext, err := action.VarsFromEnv()
	if err != nil {
		log.Fatal(err)
	}

	// Parse the event
	eventFile, err := os.Open(ghContext.GithubEventPath)
	if err != nil {
		log.Fatal(fmt.Errorf("unable to load event file: %w", err))
	}
	defer eventFile.Close()

	var event github.PullRequestEvent
	if err := json.NewDecoder(eventFile).Decode(&event); err != nil {
		log.Fatal(fmt.Errorf("unable to unmarshal PullRequest event: %w", err))
	}

	// Check the title of the PR
	prType, prTitle, err := pr.TypeFromTitle(*event.PullRequest.Title)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println()
	fmt.Printf("PR type: %#q\n", prType)
	fmt.Printf("PR title: %#q\n", prTitle)
	fmt.Println()

	if err := action.SetOutput("pr_type", string(prType)); err != nil {
		log.Printf("warning: unable to set pr_type output: %v", err)
	}
}
