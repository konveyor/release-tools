package goals

import (
	"fmt"
	"sort"
	"time"

	"github.com/konveyor/release-tools/pkg/config"
)

// Calculator handles goal progress calculations
type Calculator struct {
	baseline     int
	baselineDate string
}

// NewCalculator creates a new calculator with the given configuration
func NewCalculator(goalsConfig *config.GoalsConfig) *Calculator {
	return &Calculator{
		baseline:     goalsConfig.BacklogBaseline,
		baselineDate: goalsConfig.BacklogBaselineDate,
	}
}

// CalculateGoalsProgress transforms raw data into goal metrics
func (c *Calculator) CalculateGoalsProgress(data *RawGoalsData, totalRepos int) *GoalsProgress {
	return &GoalsProgress{
		ThirtyDayActivity: c.calculateActivityGoal(data.ActivityItems, data),
		BacklogCleanup:    c.calculateBacklogGoal(data.BacklogCount),
		TriageSpeed:       c.calculateTriageGoal(data.NewIssues),
		OwnershipUpdates:  c.calculateOwnershipGoal(data.OwnershipStatus),
		PerRepoMetrics:    c.calculatePerRepoMetrics(data),
		FetchedAt:         time.Now(),
		TotalReposChecked: totalRepos,
	}
}

// calculateActivityGoal calculates Goal 1: 30-Day Activity Rule metrics
func (c *Calculator) calculateActivityGoal(items []ActivityItem, data *RawGoalsData) ActivityGoalMetrics {
	// Count total open items from activity items + new issues
	totalOpen := len(items)
	for _, newIssue := range data.NewIssues {
		// Add new issues to total if they're not already in activity items
		found := false
		for _, item := range items {
			if item.Org == newIssue.Org && item.Repo == newIssue.Repo && item.Number == newIssue.Number {
				found = true
				break
			}
		}
		if !found {
			totalOpen++
		}
	}

	itemsOver30 := len(items)
	var complianceRate float64
	if totalOpen > 0 {
		complianceRate = float64(totalOpen-itemsOver30) / float64(totalOpen) * 100
	} else {
		complianceRate = 100
	}

	// Create worst offenders list (top 10)
	worstOffenders := make([]StaleActivityItem, 0)
	sortedItems := make([]ActivityItem, len(items))
	copy(sortedItems, items)
	sort.Slice(sortedItems, func(i, j int) bool {
		return sortedItems[i].DaysSinceUpdate > sortedItems[j].DaysSinceUpdate
	})

	limit := 10
	if len(sortedItems) < limit {
		limit = len(sortedItems)
	}

	for i := 0; i < limit; i++ {
		item := sortedItems[i]
		worstOffenders = append(worstOffenders, StaleActivityItem{
			Org:             item.Org,
			Repo:            item.Repo,
			Number:          item.Number,
			Title:           item.Title,
			Type:            item.Type,
			DaysSinceUpdate: item.DaysSinceUpdate,
			URL:             fmt.Sprintf("https://github.com/%s/%s/%s/%d", item.Org, item.Repo, getIssueType(item.Type), item.Number),
		})
	}

	return ActivityGoalMetrics{
		TotalOpenItems:  totalOpen,
		ItemsOver30Days: itemsOver30,
		ComplianceRate:  complianceRate,
		Status:          determineStatus(complianceRate),
		WorstOffenders:  worstOffenders,
	}
}

// calculateBacklogGoal calculates Goal 2: Backlog Cleanup metrics
func (c *Calculator) calculateBacklogGoal(currentCount int) BacklogGoalMetrics {
	itemsReduced := c.baseline - currentCount
	var reductionPercent float64
	if c.baseline > 0 {
		reductionPercent = float64(itemsReduced) / float64(c.baseline) * 100
	}

	target := 20.0
	timeRemaining := calculateTimeRemaining(c.baselineDate)

	return BacklogGoalMetrics{
		CurrentBacklog:   currentCount,
		Baseline:         c.baseline,
		BaselineDate:     c.baselineDate,
		ItemsReduced:     itemsReduced,
		ReductionPercent: reductionPercent,
		Target:           target,
		Status:           determineBacklogStatus(reductionPercent, target),
		TimeRemaining:    timeRemaining,
	}
}

// calculateTriageGoal calculates Goal 3: Triage Speed metrics
func (c *Calculator) calculateTriageGoal(issues []NewIssue) TriageGoalMetrics {
	triagedCount := 0
	untriagedList := make([]UntriagedIssue, 0)

	for _, issue := range issues {
		hasLabel := len(issue.Labels) > 0
		hasAssignee := len(issue.Assignees) > 0
		isTriaged := hasLabel && hasAssignee

		if isTriaged {
			triagedCount++
		} else {
			hoursOpen := int(time.Since(issue.CreatedAt).Hours())
			untriagedList = append(untriagedList, UntriagedIssue{
				Org:             issue.Org,
				Repo:            issue.Repo,
				Number:          issue.Number,
				Title:           issue.Title,
				CreatedAt:       issue.CreatedAt,
				HoursOpen:       hoursOpen,
				MissingLabel:    !hasLabel,
				MissingAssignee: !hasAssignee,
				URL:             fmt.Sprintf("https://github.com/%s/%s/issues/%d", issue.Org, issue.Repo, issue.Number),
			})
		}
	}

	totalIssues := len(issues)
	var triageRate float64
	if totalIssues > 0 {
		triageRate = float64(triagedCount) / float64(totalIssues) * 100
	} else {
		triageRate = 100
	}

	return TriageGoalMetrics{
		NewIssuesLast72h: totalIssues,
		TriagedIssues:    triagedCount,
		UntriagedIssues:  len(untriagedList),
		TriageRate:       triageRate,
		Status:           determineStatus(triageRate),
		UntriagedList:    untriagedList,
	}
}

// calculateOwnershipGoal calculates Goal 4: Ownership Files metrics
func (c *Calculator) calculateOwnershipGoal(statuses []RepoOwnership) OwnershipGoalMetrics {
	reposWithFiles := 0
	reposNeedingAttention := make([]OwnershipRepoStatus, 0)

	for _, status := range statuses {
		hasFiles := status.HasOwners && status.HasReadme
		if hasFiles {
			reposWithFiles++
		} else {
			reposNeedingAttention = append(reposNeedingAttention, OwnershipRepoStatus{
				Org:       status.Org,
				Repo:      status.Repo,
				HasOwners: status.HasOwners,
				HasReadme: status.HasReadme,
				URL:       fmt.Sprintf("https://github.com/%s/%s", status.Org, status.Repo),
			})
		}
	}

	totalRepos := len(statuses)
	var complianceRate float64
	if totalRepos > 0 {
		complianceRate = float64(reposWithFiles) / float64(totalRepos) * 100
	} else {
		complianceRate = 100
	}

	return OwnershipGoalMetrics{
		TotalRepos:            totalRepos,
		ReposWithFiles:        reposWithFiles,
		ReposMissingFiles:     len(reposNeedingAttention),
		ComplianceRate:        complianceRate,
		Status:                determineStatus(complianceRate),
		ReposNeedingAttention: reposNeedingAttention,
	}
}

// calculatePerRepoMetrics computes per-repository goal metrics
func (c *Calculator) calculatePerRepoMetrics(data *RawGoalsData) []RepoGoalMetrics {
	repoMap := make(map[string]*RepoGoalMetrics)

	// Initialize repos from ownership status
	for _, status := range data.OwnershipStatus {
		key := fmt.Sprintf("%s/%s", status.Org, status.Repo)
		repoMap[key] = &RepoGoalMetrics{
			Org:       status.Org,
			Repo:      status.Repo,
			HasOwners: status.HasOwners,
			HasReadme: status.HasReadme,
		}
	}

	// Add activity metrics
	for _, item := range data.ActivityItems {
		key := fmt.Sprintf("%s/%s", item.Org, item.Repo)
		if _, ok := repoMap[key]; !ok {
			repoMap[key] = &RepoGoalMetrics{Org: item.Org, Repo: item.Repo}
		}
		repoMap[key].ItemsOver30Days++
		repoMap[key].TotalOpenItems++
	}

	// Add new issues to total open items
	for _, issue := range data.NewIssues {
		key := fmt.Sprintf("%s/%s", issue.Org, issue.Repo)
		if _, ok := repoMap[key]; !ok {
			repoMap[key] = &RepoGoalMetrics{Org: issue.Org, Repo: issue.Repo}
		}

		// Only increment if not already counted in activity items
		alreadyCounted := false
		for _, item := range data.ActivityItems {
			if item.Org == issue.Org && item.Repo == issue.Repo && item.Number == issue.Number {
				alreadyCounted = true
				break
			}
		}
		if !alreadyCounted {
			repoMap[key].TotalOpenItems++
		}

		// Count triage metrics
		repoMap[key].NewIssuesLast72h++
		hasLabel := len(issue.Labels) > 0
		hasAssignee := len(issue.Assignees) > 0
		if !hasLabel || !hasAssignee {
			repoMap[key].UntriagedCount++
		}
	}

	// Calculate activity compliance and triage rates
	for _, metrics := range repoMap {
		if metrics.TotalOpenItems > 0 {
			metrics.ActivityCompliance = float64(metrics.TotalOpenItems-metrics.ItemsOver30Days) / float64(metrics.TotalOpenItems) * 100
		} else {
			metrics.ActivityCompliance = 100
		}

		if metrics.NewIssuesLast72h > 0 {
			triaged := metrics.NewIssuesLast72h - metrics.UntriagedCount
			metrics.TriageRate = float64(triaged) / float64(metrics.NewIssuesLast72h) * 100
		} else {
			metrics.TriageRate = 100
		}

		// Determine overall status (worst of all goals)
		statuses := []float64{
			metrics.ActivityCompliance,
			metrics.TriageRate,
		}
		if metrics.HasOwners && metrics.HasReadme {
			statuses = append(statuses, 100.0)
		} else {
			statuses = append(statuses, 0.0)
		}

		worstStatus := 100.0
		for _, s := range statuses {
			if s < worstStatus {
				worstStatus = s
			}
		}
		metrics.OverallStatus = determineStatus(worstStatus)
	}

	// Convert map to sorted slice
	result := make([]RepoGoalMetrics, 0, len(repoMap))
	for _, metrics := range repoMap {
		result = append(result, *metrics)
	}

	// Sort by overall status (critical first) then by org/repo name
	sort.Slice(result, func(i, j int) bool {
		if result[i].OverallStatus != result[j].OverallStatus {
			// critical < needs-attention < on-track
			statusOrder := map[string]int{"critical": 0, "needs-attention": 1, "on-track": 2}
			return statusOrder[result[i].OverallStatus] < statusOrder[result[j].OverallStatus]
		}
		return fmt.Sprintf("%s/%s", result[i].Org, result[i].Repo) < fmt.Sprintf("%s/%s", result[j].Org, result[j].Repo)
	})

	return result
}

// determineStatus returns status based on compliance rate
// 90%+ = "on-track", 70-89% = "needs-attention", <70% = "critical"
func determineStatus(rate float64) string {
	if rate >= 90 {
		return "on-track"
	} else if rate >= 70 {
		return "needs-attention"
	}
	return "critical"
}

// determineBacklogStatus determines status based on reduction progress
func determineBacklogStatus(reduction, target float64) string {
	if reduction >= target {
		return "on-track"
	} else if reduction >= target*0.75 {
		return "needs-attention"
	}
	return "critical"
}

// calculateTimeRemaining calculates time remaining until target date
func calculateTimeRemaining(baselineDateStr string) string {
	// Parse baseline date
	baselineDate, err := time.Parse("2006-01-02", baselineDateStr)
	if err != nil {
		return "unknown"
	}

	// Calculate 4 weeks from baseline
	targetDate := baselineDate.AddDate(0, 0, 28)
	remaining := time.Until(targetDate)

	if remaining < 0 {
		return "deadline passed"
	}

	days := int(remaining.Hours() / 24)
	weeks := days / 7

	if weeks > 0 {
		if weeks == 1 {
			return "1 week remaining"
		}
		return fmt.Sprintf("%d weeks remaining", weeks)
	}
	if days == 1 {
		return "1 day remaining"
	}
	return fmt.Sprintf("%d days remaining", days)
}

// getIssueType returns "issues" or "pull" for URL construction
func getIssueType(itemType string) string {
	if itemType == "pr" {
		return "pull"
	}
	return "issues"
}
