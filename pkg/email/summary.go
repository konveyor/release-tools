package email

import (
	"fmt"
	"sort"
	"time"

	"github.com/konveyor/release-tools/pkg/goals"
)

// GenerateSummaryReport creates a summary email report from all individual maintainer reports
func GenerateSummaryReport(reports map[string]*EmailReport, goalsProgress *goals.GoalsProgress) *SummaryEmailReport {
	summary := &SummaryEmailReport{
		WeekEnding:   "",
		GeneratedAt:  time.Now(),
		Maintainers:  make([]MaintainerSummary, 0),
		GoalsProgress: goalsProgress,
	}

	// Collect maintainer summaries and aggregate metrics
	for email, report := range reports {
		// Set week ending from first report
		if summary.WeekEnding == "" {
			summary.WeekEnding = report.WeekEnding
		}

		// Create maintainer summary
		repoList := make([]string, len(report.Repos))
		for i, repo := range report.Repos {
			repoList[i] = fmt.Sprintf("%s/%s", repo.Org, repo.Repo)
		}

		summary.Maintainers = append(summary.Maintainers, MaintainerSummary{
			Name:         report.MaintainerName,
			Email:        email,
			RepoCount:    len(report.Repos),
			Repositories: repoList,
			StaleItems:   report.TotalStale,
		})

		// Aggregate metrics
		summary.TotalRepos += report.TotalRepos
		summary.TotalStaleItems += report.TotalStale
		summary.TotalNewContributors += report.TotalNewContributors

		// Aggregate open issues and PRs from each repo
		for _, repo := range report.Repos {
			summary.TotalOpenIssues += repo.CurrentHealth.OpenIssues
			summary.TotalOpenPRs += repo.CurrentHealth.OpenPRs
		}
	}

	summary.TotalMaintainers = len(reports)

	// Sort maintainers by stale items (highest first)
	sort.Slice(summary.Maintainers, func(i, j int) bool {
		return summary.Maintainers[i].StaleItems > summary.Maintainers[j].StaleItems
	})

	// Collect top action items across all repos if goals are enabled
	if goalsProgress != nil {
		summary.TopUnrespondedIssues = collectTopUnrespondedIssues(reports, 10)
		summary.TopUnreviewedPRs = collectTopUnreviewedPRs(reports, 10)
	}

	return summary
}

// collectTopUnrespondedIssues collects the top N unresponded issues across all repos
func collectTopUnrespondedIssues(reports map[string]*EmailReport, limit int) []goals.UnrespondedIssue {
	var allIssues []goals.UnrespondedIssue

	for _, report := range reports {
		for _, repo := range report.Repos {
			if repo.ActionItems != nil {
				allIssues = append(allIssues, repo.ActionItems.UnrespondedIssues...)
			}
		}
	}

	// Sort by days since (oldest first)
	sort.Slice(allIssues, func(i, j int) bool {
		return allIssues[i].DaysSince > allIssues[j].DaysSince
	})

	// Return top N
	if len(allIssues) > limit {
		return allIssues[:limit]
	}
	return allIssues
}

// collectTopUnreviewedPRs collects the top N unreviewed PRs across all repos
func collectTopUnreviewedPRs(reports map[string]*EmailReport, limit int) []goals.UnreviewedPR {
	var allPRs []goals.UnreviewedPR

	for _, report := range reports {
		for _, repo := range report.Repos {
			if repo.ActionItems != nil {
				allPRs = append(allPRs, repo.ActionItems.UnreviewedPRs...)
			}
		}
	}

	// Sort by days since (oldest first)
	sort.Slice(allPRs, func(i, j int) bool {
		return allPRs[i].DaysSince > allPRs[j].DaysSince
	})

	// Return top N
	if len(allPRs) > limit {
		return allPRs[:limit]
	}
	return allPRs
}
