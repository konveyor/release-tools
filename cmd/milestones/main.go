package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/google/go-github/v55/github"
	"github.com/konveyor/release-tools/pkg/action"
)

func main() {
	org := os.Getenv("ORGANIZATION")
	repo := os.Getenv("REPOSITORY")
	title := os.Getenv("TITLE")
	state := os.Getenv("STATE")
	desc := os.Getenv("DESCRIPTION")
	due := os.Getenv("DUE")

	if org == "" {
		action.ErrorCommand("input 'organization' not defined")
		os.Exit(1)
	}
	if repo == "" {
		action.ErrorCommand("input 'repository' not defined")
		os.Exit(1)
	}
	if title == "" {
		action.ErrorCommand("input 'title' not defined")
		os.Exit(1)
	}
	if state != "open" && state != "closed" {
		action.ErrorCommand("input 'state' must be 'open' or 'closed'")
		os.Exit(1)
	}

	var dueTime *github.Timestamp
	if due != "" {
		parsedTime, err := time.Parse(time.DateOnly, due)
		if err != nil {
			fmt.Println("Error: " + err.Error())
			action.ErrorCommand("input 'due' not parseable as DateOnly time")
			os.Exit(1)
		}
		dueOn := github.Timestamp{Time: parsedTime}
		dueTime = &dueOn
	}

	desiredMilestone := github.Milestone{
		Title:       &title,
		State:       &state,
		Description: &desc,
		DueOn:       dueTime,
	}

	// Instantiate the client and get milestones
	client := action.GetClient()
	opt := &github.MilestoneListOptions{
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	// Make sure we get all the milestones
	var currentMilestones []*github.Milestone
	for {
		labels, resp, err := client.Issues.ListMilestones(context.Background(), org, repo, opt)
		if err != nil {
			action.ErrorCommand("Failed to get repo labels")
			log.Fatal(err)
		}
		currentMilestones = append(currentMilestones, labels...)
		if resp.NextPage == 0 {
			break
		}
		opt.Page = resp.NextPage
	}

	// Grab the milestone number if it already exists
	for _, milestone := range currentMilestones {
		if *milestone.Title == *desiredMilestone.Title {
			desiredMilestone.Number = milestone.Number
		}
	}

	if desiredMilestone.Number == nil {
		_, _, err := client.Issues.CreateMilestone(context.Background(), org, repo, &desiredMilestone)
		if err != nil {
			action.ErrorCommand("Error creating milestone")
			log.Fatal(err)
		}
		return
	}
	_, _, err := client.Issues.EditMilestone(context.Background(), org, repo, *desiredMilestone.Number, &desiredMilestone)
	if err != nil {
		action.ErrorCommand("Error editingmilestone")
		log.Fatal(err)
	}

	action.NoticeCommand("Yay")
}
