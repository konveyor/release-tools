package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"

	// "log"

	"github.com/google/go-github/v49/github"
	"github.com/konveyor/release-tools/action"
	"github.com/konveyor/release-tools/pr"
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
}
