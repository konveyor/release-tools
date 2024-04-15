package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/bombsimon/logrusr/v3"
	"github.com/google/go-github/v55/github"
	"github.com/konveyor/release-tools/pkg/action"
	"github.com/konveyor/release-tools/pkg/config"
	"github.com/sirupsen/logrus"
	"gopkg.in/yaml.v2"
)

// Update a milestone in a repo
type Update struct {
	Org     string
	Repo    string
	Why     string
	Wanted  *config.Milestone `json:"wanted,omitempty"`
	Current *config.Milestone `json:"current,omitempty"`
	Issues  []int
}

var (
	configPath = flag.String("config", "", "Path to config.yaml")
	confirm    = flag.Bool("confirm", false, "Make mutating changes to labels via GitHub API")
	logLevel   = flag.Int("log-level", 5, "Level to log")
)

func main() {
	flag.Parse()

	logrusLog := logrus.New()
	logrusLog.SetOutput(os.Stdout)
	logrusLog.SetFormatter(&logrus.TextFormatter{})
	logrusLog.SetLevel(logrus.Level(5))
	log := logrusr.New(logrusLog)

	if logLevel != nil && *logLevel != 5 {
		logrusLog.SetLevel(logrus.Level(*logLevel))
	}

	configPath := *configPath
	confirm := *confirm

	c, err := config.LoadConfig(configPath)
	if err != nil {
		log.Error(err, "failed to load config")
		os.Exit(1)
	}
	wantedMilestones := c.Milestones

	// Instantiate the client and get the current labels on the repo
	client := action.GetClient()
	listOptions := github.ListOptions{
		PerPage: 100,
	}
	milestoneListOptions := &github.MilestoneListOptions{
		State:       "all",
		ListOptions: listOptions,
	}

	updates := []Update{}
	for _, r := range c.Repos {
		log.V(2).Info("Getting milestone for repository", "org", r.Org, "repo", r.Repo)
		var currentMilestones []*github.Milestone
		for {
			milestones, resp, err := client.Issues.ListMilestones(context.Background(), r.Org, r.Repo, milestoneListOptions)
			if err != nil {
				action.ErrorCommand("Failed to get repo milestones")
				log.Error(err, "failed to get repo milestones")
				os.Exit(1)
			}
			currentMilestones = append(currentMilestones, milestones...)
			if resp.NextPage == 0 {
				break
			}
			milestoneListOptions.Page = resp.NextPage
		}

		currentMilestonesMap := make(map[string]*github.Milestone)
		for _, m := range currentMilestones {
			log.V(2).Info("adding milestone to map", "milestone", struct {
				Title        string           `json:"title"`
				Description  string           `json:"description"`
				Number       int              `json:"number"`
				State        string           `json:"state"`
				Due          github.Timestamp `json:"due"`
				OpenIssues   int              `json:"openIssues"`
				ClosedIssues int              `json:"closedIssues"`
			}{
				Title:        m.GetTitle(),
				Description:  m.GetDescription(),
				Number:       m.GetNumber(),
				State:        m.GetState(),
				Due:          m.GetDueOn(),
				OpenIssues:   m.GetOpenIssues(),
				ClosedIssues: m.GetClosedIssues(),
			})
			currentMilestonesMap[m.GetTitle()] = m
		}

		for _, m := range wantedMilestones {
			wantMilestone := m
			log.V(2).Info("wanted milestone", "milestone", wantMilestone)

			repoIssues := []int{}
			if wantMilestone.Replaces != "" {
				oldMilestone, oldMilestoneExists := currentMilestonesMap[wantMilestone.Replaces]
				if oldMilestoneExists && oldMilestone.GetOpenIssues() > 0 {
					log.V(2).Info("old milestone exists", "want milestone title", wantMilestone.Title, "replaces", wantMilestone.Replaces, "open issues", oldMilestone.GetOpenIssues())
					issueListByRepoOpts := &github.IssueListByRepoOptions{
						Milestone:   strconv.Itoa(oldMilestone.GetNumber()),
						State:       "open",
						ListOptions: listOptions,
					}

					// just need their number
					for {
						issues, resp, err := client.Issues.ListByRepo(context.Background(), r.Org, r.Repo, issueListByRepoOpts)
						if err != nil {
							action.ErrorCommand("Failed to get repo issues")
							log.Error(err, "failed to get repo issues")
							os.Exit(1)
						}

						for _, i := range issues {
							repoIssues = append(repoIssues, i.GetNumber())
						}
						if resp.NextPage == 0 {
							break
						}
						issueListByRepoOpts.Page = resp.NextPage
					}
				}
			}

			existingMilestone, exists := currentMilestonesMap[wantMilestone.Title]
			if !exists {
				updates = append(updates, Update{
					Org:     r.Org,
					Repo:    r.Repo,
					Why:     "missing",
					Wanted:  &wantMilestone,
					Current: nil,
					Issues:  repoIssues,
				})
				continue
			}

			// Counting on this to return empty string if unset
			existingMilestoneDue := existingMilestone.GetDueOn().Time.Format(time.DateOnly)
			if existingMilestoneDue == "0001-01-01" {
				existingMilestoneDue = ""
			}
			if existingMilestone.GetDescription() != wantMilestone.Description ||
				existingMilestoneDue != wantMilestone.Due ||
				existingMilestone.GetState() != wantMilestone.State ||
				len(repoIssues) > 0 {
				updates = append(updates, Update{
					Org:    r.Org,
					Repo:   r.Repo,
					Why:    "changed",
					Wanted: &wantMilestone,
					Current: &config.Milestone{
						Title:       existingMilestone.GetTitle(),
						Description: existingMilestone.GetDescription(),
						State:       existingMilestone.GetState(),
						Due:         existingMilestoneDue,
						Number:      existingMilestone.GetNumber(),
					},
					Issues: repoIssues,
				})
			}
		}
	}

	if len(updates) == 0 {
		action.NoticeCommand("Yay, there are no changes to be made")
		os.Exit(0)
	}
	y, _ := yaml.Marshal(updates)

	action.WarningCommand("Changes will be made!")
	fmt.Println(string(y))

	if !confirm {
		action.NoticeCommand("Running without confirm, no mutations will be made")
		os.Exit(0)
	}

	for _, update := range updates {
		var dueOn *github.Timestamp
		if update.Wanted.Due != "" {
			parsedTime, err := time.Parse(time.DateOnly, update.Wanted.Due)
			if err != nil {
				log.Error(err, "failed to parse time")
				os.Exit(1)
			}
			// add some time to make sure it registers as correct day
			dueOn = &github.Timestamp{Time: parsedTime.Add(12 * time.Hour)}
		}

		milestone := &github.Milestone{}
		switch update.Why {
		case "missing":
			milestone, _, err = client.Issues.CreateMilestone(context.Background(), update.Org, update.Repo, &github.Milestone{
				Title:       github.String(update.Wanted.Title),
				Description: github.String(update.Wanted.Description),
				State:       github.String(update.Wanted.State),
				DueOn:       dueOn,
			})
			if err != nil {
				action.ErrorCommand("Error creating milestone")
				log.Error(err, "error creating milestone")
				os.Exit(1)
			}
			log.Info("[%v/%v] Milestone %v created", update.Org, update.Repo, update.Wanted)
		case "changed":
			milestone, _, err = client.Issues.EditMilestone(context.Background(), update.Org, update.Repo, update.Current.Number, &github.Milestone{
				Title:       github.String(update.Wanted.Title),
				Description: github.String(update.Wanted.Description),
				State:       github.String(update.Wanted.State),
				DueOn:       dueOn,
			})
			if err != nil {
				action.ErrorCommand("Error modifying milestone")
				log.Error(err, "error modifying milestone")
				os.Exit(1)
			}
			log.Info("Milestone updated", "org", update.Org, "repo", update.Repo, "milestone", update.Wanted)
		default:
			panic("Should not happen")
		}

		for _, i := range update.Issues {
			milestoneNumber := milestone.GetNumber()
			_, _, err := client.Issues.Edit(context.Background(), update.Org, update.Repo, i, &github.IssueRequest{
				Milestone: &milestoneNumber,
			})
			if err != nil {
				action.ErrorCommand("Failed to move issue to milestone")
				log.Error(err, "error moving issue to milestone")
				os.Exit(1)
			}
			log.Info("Issue added to milestone", "org", update.Org, "repo", update.Repo, "issue", i, "milestone", update.Wanted.Title)
		}
	}

	action.NoticeCommand("Yay")
}
