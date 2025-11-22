package main

// This modifies https://github.com/kubernetes/test-infra/blob/master/label_sync/main.go
// for our purposes.

import (
	"context"
	"flag"
	"log"
	"os"
	"strings"

	"github.com/google/go-github/v55/github"
	"github.com/konveyor/release-tools/pkg/action"
	"github.com/konveyor/release-tools/pkg/config"
	"sigs.k8s.io/yaml"
)

// Update a label in a repo
type Update struct {
	Org     string
	Repo    string
	Why     string
	Wanted  *config.Label `json:"wanted,omitempty"`
	Current *config.Label `json:"current,omitempty"`
}

func main() {
	configPtr := flag.String("config", "", "Path to config.yaml")
	confirmPtr := flag.Bool("confirm", false, "Make mutating changes to labels via GitHub API")
	flag.Parse()
	configPath := *configPtr
	confirm := *confirmPtr

	c, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatal(err)
	}

	defaultLabels := c.Labels

	// Instantiate the client and get the current labels on the repo
	client := action.GetClient()

	updates := []Update{}
	for _, r := range c.Repos {
		// TODO(djzager): maybe have repo specific labels in the future
		// repoLabels := append(defaultLabels, r.AddLabels...)
		opt := &github.ListOptions{
			PerPage: 100,
		}
		repoLabels := defaultLabels

		var currentLabels []*github.Label
		for {
			labels, resp, err := client.Issues.ListLabels(context.Background(), r.Org, r.Repo, opt)
			if err != nil {
				action.ErrorCommand("Failed to get repo labels")
				log.Fatal(err)
			}
			currentLabels = append(currentLabels, labels...)
			if resp.NextPage == 0 {
				break
			}
			opt.Page = resp.NextPage
		}

		currentLabelsMap := make(map[string]*github.Label)
		for _, label := range currentLabels {
			currentLabelsMap[label.GetName()] = label
		}

		// Compare labels
		for _, l := range repoLabels {
			label := l
			existingLabel, exists := currentLabelsMap[l.Name]
			if !exists {
				updates = append(updates, Update{
					Org:     r.Org,
					Repo:    r.Repo,
					Why:     "missing",
					Wanted:  &label,
					Current: nil,
				})
				continue
			}

			if strings.ToLower(existingLabel.GetColor()) != strings.ToLower(l.Color) ||
				existingLabel.GetDescription() != l.Description {

				updates = append(updates, Update{
					Org:    r.Org,
					Repo:   r.Repo,
					Why:    "changed",
					Wanted: &label,
					Current: &config.Label{
						Name:        existingLabel.GetName(),
						Color:       existingLabel.GetColor(),
						Description: existingLabel.GetDescription(),
					},
				})
			}
		}
	}

	if len(updates) == 0 {
		action.NoticeCommand("Yay, there are no changes to be made")
		os.Exit(0)
	}
	y, _ := yaml.Marshal(updates)

	log.Print(string(y))

	if !confirm {
		action.NoticeCommand("Running without confirm, no mutations will be made")
		os.Exit(0)
	}

	for _, update := range updates {
		switch update.Why {
		case "missing":
			_, _, err := client.Issues.CreateLabel(context.Background(), update.Org, update.Repo, &github.Label{
				Name:        github.String(update.Wanted.Name),
				Color:       github.String(update.Wanted.Color),
				Description: github.String(update.Wanted.Description),
			})
			if err != nil {
				action.ErrorCommand("Error creating label")
				log.Fatal(err)
			}
		case "changed":
			_, _, err := client.Issues.EditLabel(context.Background(), update.Org, update.Repo, update.Wanted.Name, &github.Label{
				Name:        github.String(update.Wanted.Name),
				Color:       github.String(update.Wanted.Color),
				Description: github.String(update.Wanted.Description),
			})
			if err != nil {
				action.ErrorCommand("Error modifying label")
				log.Fatal(err)
			}
		default:
			panic("Should not happen")
		}
	}

	action.NoticeCommand("Yay")
}
