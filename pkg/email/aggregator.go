package email

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/konveyor/release-tools/pkg/action"
	"github.com/konveyor/release-tools/pkg/config"
	"github.com/konveyor/release-tools/pkg/goals"
	"github.com/sirupsen/logrus"
)

// LoadHistoricalData loads the last N days of data from both dashboards
func LoadHistoricalData(days int) (*HistoricalData, error) {
	data := &HistoricalData{
		CommunityHealth: make(map[string]*CommunityHealthSnapshot),
		Stale:           make(map[string]*StaleSnapshot),
		AvailableDates:  []string{},
	}

	// Determine the paths to the data directories
	communityHealthDir := "community-health-dashboard/data/history"
	staleDir := "stale-dashboard/data/history"

	// Load community health data
	communityDates, err := loadAvailableDates(communityHealthDir)
	if err != nil {
		logrus.WithError(err).Warn("Failed to load community health dates")
	} else {
		for i := 0; i < days && i < len(communityDates); i++ {
			date := communityDates[i]
			snapshot, err := loadCommunityHealthSnapshot(communityHealthDir, date)
			if err != nil {
				logrus.WithError(err).WithField("date", date).Warn("Failed to load community health snapshot")
				continue
			}
			data.CommunityHealth[date] = snapshot
			data.AvailableDates = append(data.AvailableDates, date)
		}
	}

	// Load stale data
	staleDates, err := loadAvailableDates(staleDir)
	if err != nil {
		logrus.WithError(err).Warn("Failed to load stale dates")
	} else {
		for i := 0; i < days && i < len(staleDates); i++ {
			date := staleDates[i]
			snapshot, err := loadStaleSnapshot(staleDir, date)
			if err != nil {
				logrus.WithError(err).WithField("date", date).Warn("Failed to load stale snapshot")
				continue
			}
			data.Stale[date] = snapshot
		}
	}

	// Deduplicate and sort dates (newest first)
	dateMap := make(map[string]bool)
	for _, date := range data.AvailableDates {
		dateMap[date] = true
	}
	data.AvailableDates = []string{}
	for date := range dateMap {
		data.AvailableDates = append(data.AvailableDates, date)
	}
	sort.Slice(data.AvailableDates, func(i, j int) bool {
		return data.AvailableDates[i] > data.AvailableDates[j] // newest first
	})

	if len(data.AvailableDates) == 0 {
		return nil, fmt.Errorf("no historical data available")
	}

	logrus.WithFields(logrus.Fields{
		"dates_loaded":      len(data.AvailableDates),
		"community_health":  len(data.CommunityHealth),
		"stale":             len(data.Stale),
		"newest_date":       data.AvailableDates[0],
	}).Info("Historical data loaded")

	return data, nil
}

// loadAvailableDates reads the index.json file to get available dates
func loadAvailableDates(dir string) ([]string, error) {
	indexPath := filepath.Join(dir, "index.json")
	data, err := os.ReadFile(indexPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read index.json: %w", err)
	}

	// Try to unmarshal as object with available_dates field
	var indexObj struct {
		AvailableDates []string `json:"available_dates"`
	}
	if err := json.Unmarshal(data, &indexObj); err == nil && len(indexObj.AvailableDates) > 0 {
		dates := indexObj.AvailableDates
		// Sort dates newest first
		sort.Slice(dates, func(i, j int) bool {
			return dates[i] > dates[j]
		})
		return dates, nil
	}

	// Fallback: try to unmarshal as array of strings
	var dates []string
	if err := json.Unmarshal(data, &dates); err != nil {
		return nil, fmt.Errorf("failed to unmarshal index.json: %w", err)
	}

	// Sort dates newest first
	sort.Slice(dates, func(i, j int) bool {
		return dates[i] > dates[j]
	})

	return dates, nil
}

// loadCommunityHealthSnapshot loads a single community health snapshot
func loadCommunityHealthSnapshot(dir, date string) (*CommunityHealthSnapshot, error) {
	filePath := filepath.Join(dir, fmt.Sprintf("%s.json", date))
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read community health file: %w", err)
	}

	var snapshot CommunityHealthSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to unmarshal community health snapshot: %w", err)
	}

	return &snapshot, nil
}

// loadStaleSnapshot loads a single stale snapshot
func loadStaleSnapshot(dir, date string) (*StaleSnapshot, error) {
	filePath := filepath.Join(dir, fmt.Sprintf("%s.json", date))
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read stale file: %w", err)
	}

	var snapshot StaleSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		return nil, fmt.Errorf("failed to unmarshal stale snapshot: %w", err)
	}

	return &snapshot, nil
}

// AggregateRepoData aggregates data for a specific repository
func AggregateRepoData(org, repo string, data *HistoricalData) (*RepoReport, error) {
	if len(data.AvailableDates) == 0 {
		return nil, fmt.Errorf("no data available for %s/%s", org, repo)
	}

	report := &RepoReport{
		Org:  org,
		Repo: repo,
		DashboardURL:       fmt.Sprintf("https://github.com/%s/%s", org, repo),
		StaleURL:           fmt.Sprintf("https://konveyor.github.io/release-tools/stale-dashboard/#repo=%s/%s", org, repo),
		CommunityHealthURL: fmt.Sprintf("https://konveyor.github.io/release-tools/community-health-dashboard/#repo=%s/%s", org, repo),
	}

	// Get current (most recent) and previous (7 days ago) data
	currentDate := data.AvailableDates[0]
	var previousDate string
	if len(data.AvailableDates) >= 8 {
		previousDate = data.AvailableDates[7]
	}

	// Aggregate community health data
	if chSnapshot, ok := data.CommunityHealth[currentDate]; ok {
		for _, repoData := range chSnapshot.Repos {
			if repoData.Org == org && repoData.Repo == repo {
				report.CurrentHealth = HealthMetrics{
					Contributors:       repoData.Contributors,
					NewContributors:    repoData.NewContributors,
					AvgIssueResponseMs: repoData.AvgIssueResponseMs,
					AvgPRResponseMs:    repoData.AvgPRResponseMs,
					PRMergeRate:        repoData.PRMergeRate,
					OpenIssues:         repoData.OpenIssues,
					OpenPRs:            repoData.OpenPRs,
					Coverage:           repoData.Coverage,
				}

				// Extract new contributors (excluding bots)
				for _, username := range repoData.NewContributorsList {
					// Skip bot accounts
					if strings.Contains(strings.ToLower(username), "[bot]") {
						continue
					}
					report.NewContributors = append(report.NewContributors, Contributor{
						Username: username,
						Commits:  0, // Not tracking individual commit counts
					})
				}
				break
			}
		}
	}

	// Get previous community health data for trend calculation
	if previousDate != "" {
		if chSnapshot, ok := data.CommunityHealth[previousDate]; ok {
			for _, repoData := range chSnapshot.Repos {
				if repoData.Org == org && repoData.Repo == repo {
					report.PreviousHealth = HealthMetrics{
						Contributors:       repoData.Contributors,
						NewContributors:    repoData.NewContributors,
						AvgIssueResponseMs: repoData.AvgIssueResponseMs,
						AvgPRResponseMs:    repoData.AvgPRResponseMs,
						PRMergeRate:        repoData.PRMergeRate,
						OpenIssues:         repoData.OpenIssues,
						OpenPRs:            repoData.OpenPRs,
						Coverage:           repoData.Coverage,
					}
					break
				}
			}
		}
	}

	// Calculate health trends
	report.HealthTrend = CalculateHealthTrend(&report.CurrentHealth, &report.PreviousHealth)

	// Aggregate stale data
	if staleSnapshot, ok := data.Stale[currentDate]; ok {
		for _, repoData := range staleSnapshot.Repos {
			if repoData.Org == org && repoData.Repo == repo {
				report.CurrentStale = StaleMetrics{
					TotalStale:  repoData.TotalStale,
					StaleIssues: repoData.StaleIssues,
					StalePRs:    repoData.StalePRs,
				}
				// Limit to top 10 stale items
				maxItems := 10
				if len(repoData.Items) < maxItems {
					maxItems = len(repoData.Items)
				}
				report.StaleItems = repoData.Items[:maxItems]
				break
			}
		}
	}

	// Get previous stale data for trend calculation
	if previousDate != "" {
		if staleSnapshot, ok := data.Stale[previousDate]; ok {
			for _, repoData := range staleSnapshot.Repos {
				if repoData.Org == org && repoData.Repo == repo {
					report.PreviousStale = StaleMetrics{
						TotalStale:  repoData.TotalStale,
						StaleIssues: repoData.StaleIssues,
						StalePRs:    repoData.StalePRs,
					}
					break
				}
			}
		}
	}

	// Calculate stale trends
	report.StaleTrend = CalculateStaleTrend(&report.CurrentStale, &report.PreviousStale)

	return report, nil
}

// CalculateHealthTrend calculates trends for health metrics
func CalculateHealthTrend(current, previous *HealthMetrics) TrendMetrics {
	// Use open issues as the primary trend indicator
	return CalculateTrend(current.OpenIssues, previous.OpenIssues)
}

// CalculateStaleTrend calculates trends for stale metrics
func CalculateStaleTrend(current, previous *StaleMetrics) TrendMetrics {
	return CalculateTrend(current.TotalStale, previous.TotalStale)
}

// CalculateTrend calculates trend metrics from current and previous values
func CalculateTrend(current, previous int) TrendMetrics {
	absolute := current - previous
	var percent float64
	var direction string

	if previous == 0 {
		if current > 0 {
			percent = 100.0
			direction = "up"
		} else {
			percent = 0
			direction = "same"
		}
	} else {
		percent = (float64(absolute) / float64(previous)) * 100
		if absolute > 0 {
			direction = "up"
		} else if absolute < 0 {
			direction = "down"
		} else {
			direction = "same"
		}
	}

	return TrendMetrics{
		Absolute:  absolute,
		Percent:   percent,
		Direction: direction,
	}
}

// GroupMaintainersByEmail groups maintainers by email address for consolidated emails
func GroupMaintainersByEmail(maintainers []config.Maintainer) map[string][]config.Maintainer {
	grouped := make(map[string][]config.Maintainer)
	for _, m := range maintainers {
		grouped[m.Email] = append(grouped[m.Email], m)
	}
	return grouped
}

// GenerateEmailReports generates email reports for all maintainers
func GenerateEmailReports(maintainerConfig *config.MaintainerConfig, data *HistoricalData) (map[string]*EmailReport, error) {
	reports := make(map[string]*EmailReport)

	grouped := GroupMaintainersByEmail(maintainerConfig.Maintainers)

	// Fetch goals data once for all maintainers
	allRepos := extractAllRepos(maintainerConfig.Maintainers)
	goalsProgress, err := FetchGoalsProgress(maintainerConfig, allRepos)
	if err != nil {
		logrus.WithError(err).Warn("Failed to fetch goals progress, continuing without it")
		goalsProgress = nil
	}

	for email, maintainers := range grouped {
		report := &EmailReport{
			MaintainerName: maintainers[0].Name, // Use the first maintainer's name
			Repos:          []RepoReport{},
			WeekEnding:     data.AvailableDates[0],
			GeneratedAt:    time.Now(),
			TotalRepos:     len(maintainers),
			GoalsProgress:  goalsProgress,
		}

		for _, m := range maintainers {
			repoReport, err := AggregateRepoData(m.Org, m.Repo, data)
			if err != nil {
				logrus.WithError(err).WithFields(logrus.Fields{
					"org":  m.Org,
					"repo": m.Repo,
				}).Warn("Failed to aggregate repo data")
				continue
			}

			// Fetch action items for this repo
			actionItems, err := FetchRepoActionItems(maintainerConfig, m.Org, m.Repo)
			if err != nil {
				logrus.WithError(err).WithFields(logrus.Fields{
					"org":  m.Org,
					"repo": m.Repo,
				}).Warn("Failed to fetch action items for repo, continuing without them")
			}
			repoReport.ActionItems = actionItems

			report.Repos = append(report.Repos, *repoReport)
			report.TotalStale += repoReport.CurrentStale.TotalStale
			report.TotalNewContributors += len(repoReport.NewContributors)
		}

		reports[email] = report
	}

	logrus.WithField("reports_generated", len(reports)).Info("Email reports generated")

	return reports, nil
}

// FetchGoalsProgress fetches and calculates goals progress across all repos
func FetchGoalsProgress(
	maintainerConfig *config.MaintainerConfig,
	repos []config.Repo,
) (*goals.GoalsProgress, error) {
	// Return nil if goals not enabled
	if maintainerConfig.Goals == nil || !maintainerConfig.Goals.Enabled {
		logrus.Debug("Goals tracking is disabled")
		return nil, nil
	}

	logrus.Info("Fetching goals progress data from GitHub API")

	// Create GitHub client
	client := action.GetClient()

	// Create fetcher and calculator
	fetcher := goals.NewFetcher(client, maintainerConfig.Goals.OwnershipFiles)
	calculator := goals.NewCalculator(maintainerConfig.Goals)

	// Fetch raw data with context and timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	rawData, err := fetcher.FetchGoalsData(ctx, repos)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch goals data: %w", err)
	}

	// Calculate progress
	progress := calculator.CalculateGoalsProgress(rawData, len(repos))

	logrus.WithFields(logrus.Fields{
		"total_repos": progress.TotalReposChecked,
		"activity_compliance": progress.ThirtyDayActivity.ComplianceRate,
		"triage_rate": progress.TriageSpeed.TriageRate,
	}).Info("Goals progress calculated successfully")

	return progress, nil
}

// FetchActionItems fetches and identifies action items across all repos
func FetchActionItems(
	maintainerConfig *config.MaintainerConfig,
	repos []config.Repo,
) (*goals.ActionItems, error) {
	// Return nil if action items not enabled
	if maintainerConfig.ActionItems == nil || !maintainerConfig.ActionItems.Enabled {
		logrus.Debug("Action items tracking is disabled")
		return nil, nil
	}

	logrus.Info("Fetching action items from GitHub API")

	// Create GitHub client
	client := action.GetClient()

	// Create fetcher
	fetcher := goals.NewFetcher(client, nil) // nil for ownership files (not needed for action items)

	// Fetch action items with context and timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	items, err := fetcher.FetchActionItems(ctx, repos, maintainerConfig.ActionItems)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch action items: %w", err)
	}

	return items, nil
}

// FetchRepoActionItems fetches action items for a single repository
func FetchRepoActionItems(
	maintainerConfig *config.MaintainerConfig,
	org, repo string,
) (*goals.ActionItems, error) {
	// Return nil if action items not enabled
	if maintainerConfig.ActionItems == nil || !maintainerConfig.ActionItems.Enabled {
		return nil, nil
	}

	// Create a single-repo list and call FetchActionItems
	repos := []config.Repo{{Org: org, Repo: repo}}
	return FetchActionItems(maintainerConfig, repos)
}

// extractAllRepos deduplicates repos across all maintainers
func extractAllRepos(maintainers []config.Maintainer) []config.Repo {
	seen := make(map[string]bool)
	var repos []config.Repo

	for _, m := range maintainers {
		key := m.Org + "/" + m.Repo
		if !seen[key] {
			repos = append(repos, config.Repo{Org: m.Org, Repo: m.Repo})
			seen[key] = true
		}
	}

	return repos
}
