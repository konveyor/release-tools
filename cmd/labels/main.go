package main

// This modifies https://github.com/kubernetes/test-infra/blob/master/label_sync/main.go
// for our purposes.

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/google/go-github/v55/github"
	"github.com/konveyor/release-tools/pkg/action"
	"sigs.k8s.io/yaml"
)

const (
	CONFIG = "labels.yaml"
)

// LabelTarget specifies the intent of the label (PR or issue)
// type LabelTarget string
//
// const (
// 	prTarget    LabelTarget = "prs"
// 	issueTarget LabelTarget = "issues"
// 	bothTarget  LabelTarget = "both"
// )

// Label holds declarative data about the label.
type Label struct {
	// Name is the current name of the label
	Name string `json:"name"`
	// Color is rrggbb or color
	Color string `json:"color"`
	// Description is brief text explaining its meaning, who can apply it
	Description string `json:"description"`
	// TODO(djzager): Consider using these if/when we need it
	// // Target specifies whether it targets PRs, issues or both
	// Target LabelTarget `json:"target"`
	// // ProwPlugin specifies which prow plugin add/removes this label
	// ProwPlugin string `json:"prowPlugin"`
	// // IsExternalPlugin specifies if the prow plugin is external or not
	// IsExternalPlugin bool `json:"isExternalPlugin"`
	// // AddedBy specifies whether human/munger/bot adds the label
	// AddedBy string `json:"addedBy"`
	// // Previously lists deprecated names for this label
	// Previously []Label `json:"previously,omitempty"`
	// // DeleteAfter specifies the label is retired and a safe date for deletion
	// DeleteAfter *time.Time `json:"deleteAfter,omitempty"`
	// parent      *Label     // Current name for previous labels (used internally)
}

// Configuratio ... for now ... there is only the default list of labels
// to be applied to all repositories
type Configuration struct {
	Default RepoConfig `json:"default"`
}

// RepoConfig contains only labels for the moment
type RepoConfig struct {
	Labels []Label `json:"labels"`
}

func (label *Label) Print() {
	fmt.Printf("Name: %s\n", label.Name)
	fmt.Printf("Color: %s\n", label.Color)
	fmt.Printf("Description: %s\n", label.Description)
	// fmt.Printf("Target: %s\n", label.Target)
	// fmt.Printf("ProwPlugin: %s\n", label.ProwPlugin)
	// fmt.Printf("IsExternalPlugin: %v\n", label.IsExternalPlugin)
	// fmt.Printf("AddedBy: %s\n", label.AddedBy)
	// if len(label.Previously) > 0 {
	// 	fmt.Println("Previously:")
	// 	for _, prevLabel := range label.Previously {
	// 		fmt.Printf("  Name: %s\n", prevLabel.Name)
	// 		// Add other fields as needed
	// 	}
	// }
	// if label.DeleteAfter != nil {
	// 	fmt.Printf("DeleteAfter: %s\n", label.DeleteAfter.Format(time.RFC3339))
	// }
	fmt.Println("------------------------")
}

func main() {
	orgPtr := flag.String("org", "", "The organization for the repo")
	repoPtr := flag.String("repo", "", "The repository")

	flag.Parse()
	org := *orgPtr
	if org == "" {
		action.ErrorCommand("input 'organization' not defined")
		os.Exit(1)
	}
	repo := *repoPtr
	if repo == "" {
		action.ErrorCommand("input 'repository' not defined")
		os.Exit(1)
	}

	data, err := os.ReadFile(CONFIG)
	if err != nil {
		action.ErrorCommand("Failed reading config")
		log.Fatal(err)
	}

	// TODO(djzager): Should we validate this config?
	var c Configuration
	if err = yaml.Unmarshal(data, &c); err != nil {
		action.ErrorCommand("Failed to unmarshal config")
		log.Fatal(err)
	}
	action.NoticeCommand("Labels in Configuration:")
	for _, label := range c.Default.Labels {
		label.Print()
	}
	fmt.Println("#######################################")
	fmt.Println()

	// Instantiate the client and get the current labels on the repo
	client := action.GetClient()
	opt := &github.ListOptions{
		PerPage: 100,
	}
	var currentLabels []*github.Label
	for {
		labels, resp, err := client.Issues.ListLabels(context.Background(), org, repo, opt)
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
	action.NoticeCommand("Labels in the repository:")
	for _, label := range currentLabels {
		fmt.Printf("Name: %40s\tColor: %10s\tDescription: %30s\n", label.GetName(), label.GetColor(), label.GetDescription())
		currentLabelsMap[label.GetName()] = label
	}
	fmt.Println("#######################################")
	fmt.Println()

	// Compare labels and:
	// 1 - create ones that do not exist
	// 2 - modify ones that do but have the wrong color || description
	action.NoticeCommand("Synchronizing labels")
	for _, label := range c.Default.Labels {
		existingLabel, exists := currentLabelsMap[label.Name]
		if !exists {
			action.NoticeCommand("Creating missing label")
			label.Print()
			_, _, err := client.Issues.CreateLabel(context.Background(), org, repo, &github.Label{
				Name:        github.String(label.Name),
				Color:       github.String(label.Color),
				Description: github.String(label.Description),
			})
			if err != nil {
				action.ErrorCommand("Error creating label")
				log.Fatal(err)
			}
			action.NoticeCommand("Label " + label.Name + " created")
			os.Exit(0)
		}

		if strings.ToLower(existingLabel.GetColor()) != strings.ToLower(label.Color) ||
			existingLabel.GetDescription() != label.Description {
			action.NoticeCommand("Modifying label")
			_, _, err := client.Issues.EditLabel(context.Background(), org, repo, label.Name, &github.Label{
				Name:        github.String(label.Name),
				Color:       github.String(label.Color),
				Description: github.String(label.Description),
			})
			if err != nil {
				action.ErrorCommand("Error modifying label")
				log.Fatal(err)
			}
		}
	}

	action.NoticeCommand("Yay")
}
