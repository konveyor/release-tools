package email

import "time"

// HistoricalData contains aggregated data from community health and stale dashboards
type HistoricalData struct {
	CommunityHealth map[string]*CommunityHealthSnapshot // date -> data
	Stale           map[string]*StaleSnapshot           // date -> data
	AvailableDates  []string                            // sorted dates (newest first)
}

// CommunityHealthSnapshot represents a daily snapshot from community-health-dashboard
type CommunityHealthSnapshot struct {
	Timestamp   string                        `json:"timestamp"`
	Date        string                        `json:"date"`
	Metrics     CommunityMetrics              `json:"metrics"`
	Repos       []CommunityRepoData           `json:"repositories"`
	PRMetrics   PRMetrics                     `json:"prMetrics"`
	IssueMetrics IssueMetrics                 `json:"issueMetrics"`
}

// CommunityMetrics represents aggregate metrics across all repositories
type CommunityMetrics struct {
	TotalContributors  int     `json:"totalContributors"`
	NewContributors    int     `json:"newContributors"`
	AvgResponseTime    float64 `json:"avgResponseTime"` // milliseconds
	AvgIssueResponse   float64 `json:"avgIssueResponse"`
	AvgPRResponse      float64 `json:"avgPRResponse"`
	PRMergeRate        float64 `json:"prMergeRate"`
	OpenIssues         int     `json:"openIssues"`
	OpenPRs            int     `json:"openPRs"`
	Repositories       int     `json:"repositories"`
}

// CommunityRepoData represents community health data for a single repository
type CommunityRepoData struct {
	Org                 string             `json:"org"`
	Repo                string             `json:"repo"`
	Contributors        int                `json:"contributors"`
	ContributorsList    []string           `json:"contributorsList"`
	NewContributors     int                `json:"newContributors"`
	NewContributorsList []string           `json:"newContributorsList"`
	AvgIssueResponseMs  float64            `json:"avgIssueResponseMs"`
	AvgPRResponseMs     float64            `json:"avgPRResponseMs"`
	PRMergeRate         float64            `json:"prMergeRate"`
	OpenIssues          int                `json:"openIssues"`
	OpenPRs             int                `json:"openPRs"`
	Coverage            *float64           `json:"coverage"` // nullable
	SnykVulnerabilities *SnykVulnerabilities `json:"snykVulnerabilities"` // nullable
}

// SnykVulnerabilities represents security vulnerability counts by severity
type SnykVulnerabilities struct {
	Critical int `json:"critical"`
	High     int `json:"high"`
	Medium   int `json:"medium"`
	Low      int `json:"low"`
	Total    int `json:"total"`
}

// PRMetrics represents PR-specific metrics
type PRMetrics struct {
	AvgReviewTime float64 `json:"avgReviewTime"` // hours
	AvgMergeTime  float64 `json:"avgMergeTime"`  // hours
	AvgRevisions  float64 `json:"avgRevisions"`  // commits per PR
}

// IssueMetrics represents issue-specific metrics
type IssueMetrics struct {
	ClosureRate           float64 `json:"closureRate"` // percentage
	AvgTimeToClose        float64 `json:"avgTimeToClose"` // hours
	AvgTimeToFirstResponse float64 `json:"avgTimeToFirstResponse"` // hours
	ResponseCoverage      float64 `json:"responseCoverage"` // percentage
	CommunityResponseRate float64 `json:"communityResponseRate"` // percentage
}

// StaleSnapshot represents a daily snapshot from stale-dashboard
type StaleSnapshot struct {
	Timestamp   string          `json:"timestamp"`
	Date        string          `json:"date"`
	TotalStale  int             `json:"totalStale"`
	StaleIssues int             `json:"staleIssues"`
	StalePRs    int             `json:"stalePRs"`
	Repos       []StaleRepoData `json:"repositories"`
}

// StaleRepoData represents stale data for a single repository
type StaleRepoData struct {
	Org         string      `json:"org"`
	Repo        string      `json:"repo"`
	TotalStale  int         `json:"totalStale"`
	StaleIssues int         `json:"staleIssues"`
	StalePRs    int         `json:"stalePRs"`
	Items       []StaleItem `json:"items"`
}

// StaleItem represents a single stale issue or PR
type StaleItem struct {
	Number    int      `json:"number"`
	Title     string   `json:"title"`
	Type      string   `json:"type"` // "issue" or "pr"
	UpdatedAt string   `json:"updatedAt"`
	Author    string   `json:"author"`
	Labels    []string `json:"labels"`
}

// EmailReport represents the complete data for a weekly email to a maintainer
type EmailReport struct {
	MaintainerName string       // Name of the maintainer
	Repos          []RepoReport // All repos this maintainer owns
	WeekEnding     string       // Date string for the week ending (e.g., "2024-01-15")
	GeneratedAt    time.Time    // When the report was generated

	// Summary across all repos (for multi-repo emails)
	TotalStale         int
	TotalRepos         int
	TotalNewContributors int
}

// RepoReport represents weekly data for a single repository
type RepoReport struct {
	Org  string
	Repo string

	// Stale data
	CurrentStale  StaleMetrics
	PreviousStale StaleMetrics
	StaleTrend    TrendMetrics
	StaleItems    []StaleItem // Actual stale items (limited to top N)

	// Community health
	CurrentHealth  HealthMetrics
	PreviousHealth HealthMetrics
	HealthTrend    TrendMetrics

	// New contributors this week
	NewContributors []Contributor

	// Links
	DashboardURL       string
	StaleURL           string
	CommunityHealthURL string
}

// StaleMetrics represents stale item counts
type StaleMetrics struct {
	TotalStale  int
	StaleIssues int
	StalePRs    int
}

// HealthMetrics represents community health metrics
type HealthMetrics struct {
	Contributors       int
	NewContributors    int
	AvgIssueResponseMs float64
	AvgPRResponseMs    float64
	PRMergeRate        float64
	OpenIssues         int
	OpenPRs            int
	Coverage           *float64             // nullable
	Vulnerabilities    *SnykVulnerabilities // nullable
}

// Contributor represents a new contributor
type Contributor struct {
	Username string
	Commits  int // if available
}

// TrendMetrics represents week-over-week change
type TrendMetrics struct {
	Absolute  int     // Raw change (+3, -1, etc)
	Percent   float64 // Percentage change
	Direction string  // "up", "down", "same"
}
