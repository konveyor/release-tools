package goals

import "time"

// GoalsProgress represents overall progress on all 4 goals
type GoalsProgress struct {
	// Team-wide metrics (aggregated across all repos)
	ThirtyDayActivity ActivityGoalMetrics
	BacklogCleanup    BacklogGoalMetrics
	TriageSpeed       TriageGoalMetrics
	OwnershipUpdates  OwnershipGoalMetrics

	// Per-repository breakdown
	PerRepoMetrics []RepoGoalMetrics

	FetchedAt         time.Time
	TotalReposChecked int
}

// RepoGoalMetrics represents goal metrics for a single repository
type RepoGoalMetrics struct {
	Org  string
	Repo string

	// Per-repo metrics for each goal
	ActivityCompliance float64 // % compliant with 30-day rule
	ItemsOver30Days    int
	TotalOpenItems     int

	BacklogCount int // Items 90+ days old

	TriageRate       float64 // % of new issues triaged
	NewIssuesLast72h int
	UntriagedCount   int

	HasOwners bool
	HasReadme bool

	// Overall repo status (worst of the 4 goals)
	OverallStatus string // "on-track", "needs-attention", "critical"
}

// ActivityGoalMetrics - Goal 1: 30-Day Activity Rule
type ActivityGoalMetrics struct {
	TotalOpenItems  int
	ItemsOver30Days int
	ComplianceRate  float64 // (Total - Over30) / Total * 100
	Status          string  // "on-track", "needs-attention", "critical"
	WorstOffenders  []StaleActivityItem
}

// StaleActivityItem represents an issue/PR that needs maintainer attention
type StaleActivityItem struct {
	Org             string
	Repo            string
	Number          int
	Title           string
	Type            string // "issue" or "pr"
	DaysSinceUpdate int
	URL             string
}

// BacklogGoalMetrics - Goal 2: Backlog Cleanup
type BacklogGoalMetrics struct {
	CurrentBacklog   int
	Baseline         int
	BaselineDate     string
	ItemsReduced     int
	ReductionPercent float64
	Target           float64 // 20%
	Status           string
	TimeRemaining    string
}

// TriageGoalMetrics - Goal 3: Triage Speed
type TriageGoalMetrics struct {
	NewIssuesLast72h int
	TriagedIssues    int
	UntriagedIssues  int
	TriageRate       float64
	Status           string
	UntriagedList    []UntriagedIssue
}

// UntriagedIssue represents an issue that hasn't been triaged
type UntriagedIssue struct {
	Org             string
	Repo            string
	Number          int
	Title           string
	CreatedAt       time.Time
	HoursOpen       int
	MissingLabel    bool
	MissingAssignee bool
	URL             string
}

// OwnershipGoalMetrics - Goal 4: Ownership Files
type OwnershipGoalMetrics struct {
	TotalRepos            int
	ReposWithFiles        int
	ReposMissingFiles     int
	ComplianceRate        float64
	Status                string
	ReposNeedingAttention []OwnershipRepoStatus
}

// OwnershipRepoStatus represents ownership file status for a repo
type OwnershipRepoStatus struct {
	Org       string
	Repo      string
	HasOwners bool
	HasReadme bool
	URL       string
}

// RawGoalsData contains raw data fetched from GitHub API
type RawGoalsData struct {
	ActivityItems   []ActivityItem
	BacklogCount    int
	NewIssues       []NewIssue
	OwnershipStatus []RepoOwnership
}

// ActivityItem represents an issue/PR that's been inactive
type ActivityItem struct {
	Org             string
	Repo            string
	Number          int
	Title           string
	Type            string // "issue" or "pr"
	UpdatedAt       time.Time
	DaysSinceUpdate int
}

// NewIssue represents a recently created issue
type NewIssue struct {
	Org       string
	Repo      string
	Number    int
	Title     string
	CreatedAt time.Time
	Labels    []string
	Assignees []string
}

// RepoOwnership represents ownership file status
type RepoOwnership struct {
	Org       string
	Repo      string
	HasOwners bool
	HasReadme bool
}

// ActionItems represents immediate action items for maintainers
type ActionItems struct {
	UnrespondedIssues        []UnrespondedIssue
	UnreviewedPRs            []UnreviewedPR
	FailingBranches          []FailingBranch
	ApprovedPRsReadyToMerge  []ApprovedPR
	ExternalContributorPRs   []ExternalContributorPR
	PRsAwaitingAuthorResponse []PRAwaitingAuthor

	TotalItems  int
	FetchedAt   time.Time
	TotalChecked int
}

// UnrespondedIssue represents an issue without maintainer response
type UnrespondedIssue struct {
	Org        string
	Repo       string
	Number     int
	Title      string
	Author     string
	CreatedAt  time.Time
	DaysSince  int
	URL        string
	Labels     []string
}

// UnreviewedPR represents a PR without reviews
type UnreviewedPR struct {
	Org        string
	Repo       string
	Number     int
	Title      string
	Author     string
	CreatedAt  time.Time
	DaysSince  int
	URL        string
	IsDraft    bool
}

// FailingBranch represents a branch with failing CI
type FailingBranch struct {
	Org        string
	Repo       string
	Branch     string
	Status     string // "failure", "error", "cancelled"
	URL        string
	ChecksURL  string
}

// ApprovedPR represents a PR with approving reviews and passing CI ready to merge
type ApprovedPR struct {
	Org           string
	Repo          string
	Number        int
	Title         string
	Author        string
	ApprovedAt    time.Time
	DaysSince     int
	ApprovalCount int
	URL           string
}

// ExternalContributorPR represents a PR from a non-collaborator
type ExternalContributorPR struct {
	Org             string
	Repo            string
	Number          int
	Title           string
	Author          string
	CreatedAt       time.Time
	DaysWaiting     int
	IsFirstTime     bool
	URL             string
}

// PRAwaitingAuthor represents a PR with requested changes but no author response
type PRAwaitingAuthor struct {
	Org              string
	Repo             string
	Number           int
	Title            string
	Author           string
	Reviewer         string
	RequestedAt      time.Time
	DaysSinceRequest int
	URL              string
}
