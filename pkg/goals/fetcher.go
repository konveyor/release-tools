package goals

import (
	"context"
	"fmt"
	"time"

	"github.com/google/go-github/v55/github"
	"github.com/konveyor/release-tools/pkg/config"
	"github.com/sirupsen/logrus"
)

// Fetcher fetches goal-related data from GitHub API
type Fetcher struct {
	client         *github.Client
	ownershipFiles []string
}

// NewFetcher creates a new fetcher with the given GitHub client
func NewFetcher(client *github.Client, ownershipFiles []string) *Fetcher {
	if len(ownershipFiles) == 0 {
		ownershipFiles = []string{"OWNERS", "OWNERS.md", "CODEOWNERS", "README.md"}
	}
	return &Fetcher{
		client:         client,
		ownershipFiles: ownershipFiles,
	}
}

// FetchGoalsData fetches all data needed for goals calculation
func (f *Fetcher) FetchGoalsData(ctx context.Context, repos []config.Repo) (*RawGoalsData, error) {
	data := &RawGoalsData{
		ActivityItems:   make([]ActivityItem, 0),
		NewIssues:       make([]NewIssue, 0),
		OwnershipStatus: make([]RepoOwnership, 0),
	}

	for _, repo := range repos {
		// Check rate limits before processing each repo
		if err := f.checkRateLimit(ctx); err != nil {
			logrus.WithError(err).Warn("Rate limit check failed, continuing anyway")
		}

		// Goal 1: Fetch items over 30 days old without maintainer activity
		items, err := f.fetchOldItems(ctx, repo.Org, repo.Repo)
		if err != nil {
			logrus.WithError(err).Warnf("Failed to fetch old items for %s/%s", repo.Org, repo.Repo)
		} else {
			data.ActivityItems = append(data.ActivityItems, items...)
		}

		// Goal 2: Count backlog (90+ days)
		count, err := f.fetchBacklogCount(ctx, repo.Org, repo.Repo)
		if err != nil {
			logrus.WithError(err).Warnf("Failed to fetch backlog for %s/%s", repo.Org, repo.Repo)
		} else {
			data.BacklogCount += count
		}

		// Goal 3: Fetch new issues (72 hours)
		issues, err := f.fetchNewIssues(ctx, repo.Org, repo.Repo)
		if err != nil {
			logrus.WithError(err).Warnf("Failed to fetch new issues for %s/%s", repo.Org, repo.Repo)
		} else {
			data.NewIssues = append(data.NewIssues, issues...)
		}

		// Goal 4: Check ownership files
		ownership, err := f.fetchOwnershipStatus(ctx, repo.Org, repo.Repo)
		if err != nil {
			logrus.WithError(err).Warnf("Failed to fetch ownership status for %s/%s", repo.Org, repo.Repo)
		} else {
			data.OwnershipStatus = append(data.OwnershipStatus, ownership)
		}
	}

	logrus.WithFields(logrus.Fields{
		"activity_items":   len(data.ActivityItems),
		"backlog_count":    data.BacklogCount,
		"new_issues":       len(data.NewIssues),
		"ownership_status": len(data.OwnershipStatus),
	}).Info("Goals data fetched successfully")

	return data, nil
}

// fetchOldItems finds issues/PRs updated >30 days ago without maintainer activity
func (f *Fetcher) fetchOldItems(ctx context.Context, org, repo string) ([]ActivityItem, error) {
	items := make([]ActivityItem, 0)

	// Calculate 30 days ago
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	// Fetch open issues and PRs
	opts := &github.IssueListByRepoOptions{
		State:     "open",
		Sort:      "updated",
		Direction: "asc",
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	for {
		issues, resp, err := f.client.Issues.ListByRepo(ctx, org, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list issues: %w", err)
		}

		for _, issue := range issues {
			if issue.UpdatedAt == nil {
				continue
			}

			// If updated more than 30 days ago, check for maintainer activity
			if issue.UpdatedAt.Before(thirtyDaysAgo) {
				daysSinceUpdate := int(time.Since(issue.UpdatedAt.Time).Hours() / 24)

				// Check if last activity was from a maintainer
				hasRecentMaintainerActivity, err := f.hasRecentMaintainerActivity(ctx, org, repo, issue.GetNumber(), thirtyDaysAgo)
				if err != nil {
					logrus.WithError(err).Debugf("Failed to check maintainer activity for %s/%s#%d", org, repo, issue.GetNumber())
					// Continue anyway, assume no recent activity
					hasRecentMaintainerActivity = false
				}

				if !hasRecentMaintainerActivity {
					itemType := "issue"
					if issue.IsPullRequest() {
						itemType = "pr"
					}

					items = append(items, ActivityItem{
						Org:             org,
						Repo:            repo,
						Number:          issue.GetNumber(),
						Title:           issue.GetTitle(),
						Type:            itemType,
						UpdatedAt:       issue.UpdatedAt.Time,
						DaysSinceUpdate: daysSinceUpdate,
					})
				}
			}
			// Continue processing all pages to avoid missing stale items
			// that may shift positions between paginated API calls
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return items, nil
}

// hasRecentMaintainerActivity checks if there's been maintainer activity since the cutoff date
func (f *Fetcher) hasRecentMaintainerActivity(ctx context.Context, org, repo string, issueNumber int, since time.Time) (bool, error) {
	// Fetch comments
	opts := &github.IssueListCommentsOptions{
		Since: &since,
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	for {
		comments, resp, err := f.client.Issues.ListComments(ctx, org, repo, issueNumber, opts)
		if err != nil {
			return false, fmt.Errorf("failed to list comments: %w", err)
		}

		for _, comment := range comments {
			if comment.User == nil {
				continue
			}

			// Check if commenter is a maintainer (admin or maintain role)
			isCollaborator, err := f.isCollaborator(ctx, org, repo, comment.User.GetLogin())
			if err != nil {
				logrus.WithError(err).Debugf("Failed to check collaborator status for %s", comment.User.GetLogin())
				continue
			}

			if isCollaborator {
				return true, nil
			}
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return false, nil
}

// fetchBacklogCount counts issues/PRs with no activity for 90+ days
func (f *Fetcher) fetchBacklogCount(ctx context.Context, org, repo string) (int, error) {
	ninetyDaysAgo := time.Now().AddDate(0, 0, -90)

	opts := &github.IssueListByRepoOptions{
		State:     "open",
		Sort:      "updated",
		Direction: "asc",
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	count := 0
	for {
		issues, resp, err := f.client.Issues.ListByRepo(ctx, org, repo, opts)
		if err != nil {
			return 0, fmt.Errorf("failed to list issues: %w", err)
		}

		for _, issue := range issues {
			if issue.UpdatedAt == nil {
				continue
			}

			if issue.UpdatedAt.Before(ninetyDaysAgo) {
				count++
			} else {
				// Items are sorted, so we can stop once we hit a recent one
				return count, nil
			}
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return count, nil
}

// fetchNewIssues gets issues created in last 72 hours
func (f *Fetcher) fetchNewIssues(ctx context.Context, org, repo string) ([]NewIssue, error) {
	seventyTwoHoursAgo := time.Now().Add(-72 * time.Hour)

	opts := &github.IssueListByRepoOptions{
		State:     "open",
		Sort:      "created",
		Direction: "desc",
		Since:     seventyTwoHoursAgo,
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	newIssues := make([]NewIssue, 0)

	for {
		issues, resp, err := f.client.Issues.ListByRepo(ctx, org, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list issues: %w", err)
		}

		for _, issue := range issues {
			// Skip pull requests for triage metrics
			if issue.IsPullRequest() {
				continue
			}

			if issue.CreatedAt == nil {
				continue
			}

			// Only include issues created in the last 72 hours
			if issue.CreatedAt.After(seventyTwoHoursAgo) {
				labels := make([]string, 0)
				for _, label := range issue.Labels {
					labels = append(labels, label.GetName())
				}

				assignees := make([]string, 0)
				for _, assignee := range issue.Assignees {
					assignees = append(assignees, assignee.GetLogin())
				}

				newIssues = append(newIssues, NewIssue{
					Org:       org,
					Repo:      repo,
					Number:    issue.GetNumber(),
					Title:     issue.GetTitle(),
					CreatedAt: issue.CreatedAt.Time,
					Labels:    labels,
					Assignees: assignees,
				})
			}
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return newIssues, nil
}

// fetchOwnershipStatus checks if OWNERS/README files exist
func (f *Fetcher) fetchOwnershipStatus(ctx context.Context, org, repo string) (RepoOwnership, error) {
	status := RepoOwnership{
		Org:  org,
		Repo: repo,
	}

	// Check for OWNERS files
	for _, filename := range f.ownershipFiles {
		if filename == "README.md" {
			continue // Check README separately
		}

		_, _, resp, err := f.client.Repositories.GetContents(ctx, org, repo, filename, &github.RepositoryContentGetOptions{})
		if err == nil {
			status.HasOwners = true
			break
		}

		// If it's not a 404, something else went wrong
		if resp != nil && resp.StatusCode != 404 {
			logrus.WithError(err).Debugf("Error checking for %s in %s/%s", filename, org, repo)
		}
	}

	// Check for README
	_, _, resp, err := f.client.Repositories.GetContents(ctx, org, repo, "README.md", &github.RepositoryContentGetOptions{})
	if err == nil {
		status.HasReadme = true
	} else if resp != nil && resp.StatusCode != 404 {
		logrus.WithError(err).Debugf("Error checking for README.md in %s/%s", org, repo)
	}

	return status, nil
}

// isCollaborator checks if user has admin or maintain access
func (f *Fetcher) isCollaborator(ctx context.Context, org, repo, username string) (bool, error) {
	permLevel, _, err := f.client.Repositories.GetPermissionLevel(ctx, org, repo, username)
	if err != nil {
		return false, err
	}

	if permLevel == nil || permLevel.Permission == nil {
		return false, nil
	}

	// Consider admin or maintain as maintainer (not write)
	perm := permLevel.GetPermission()
	return perm == "admin" || perm == "maintain", nil
}

// checkRateLimit monitors GitHub API rate limits
func (f *Fetcher) checkRateLimit(ctx context.Context) error {
	limits, _, err := f.client.RateLimits(ctx)
	if err != nil {
		return err
	}

	core := limits.GetCore()
	if core.Remaining < 100 {
		logrus.WithFields(logrus.Fields{
			"remaining": core.Remaining,
			"reset":     core.Reset.Time,
		}).Warn("GitHub API rate limit running low")

		if core.Remaining < 10 {
			waitTime := time.Until(core.Reset.Time)
			logrus.WithField("wait_time", waitTime).Info("Waiting for rate limit reset")
			select {
			case <-time.After(waitTime + time.Second):
				// Rate limit reset
			case <-ctx.Done():
				return ctx.Err()
			}
		}
	}

	return nil
}

// FetchActionItems fetches immediate action items for maintainers
func (f *Fetcher) FetchActionItems(ctx context.Context, repos []config.Repo, cfg *config.ActionItemsConfig) (*ActionItems, error) {
	if cfg == nil {
		return nil, fmt.Errorf("action items config is nil")
	}

	// Validate threshold values to prevent zero-value cutoffs that would flag all items
	if cfg.IssueResponseTimeHours <= 0 {
		return nil, fmt.Errorf("issue_response_time_hours must be >= 1 (got %d)", cfg.IssueResponseTimeHours)
	}
	if cfg.PRReviewWaitHours <= 0 {
		return nil, fmt.Errorf("pr_review_wait_hours must be >= 1 (got %d)", cfg.PRReviewWaitHours)
	}
	if cfg.CheckPRsAwaitingAuthor && cfg.PRAwaitingAuthorResponseDays <= 0 {
		return nil, fmt.Errorf("pr_awaiting_author_response_days must be >= 1 (got %d)", cfg.PRAwaitingAuthorResponseDays)
	}

	items := &ActionItems{
		UnrespondedIssues:        make([]UnrespondedIssue, 0),
		UnreviewedPRs:            make([]UnreviewedPR, 0),
		FailingBranches:          make([]FailingBranch, 0),
		ApprovedPRsReadyToMerge:  make([]ApprovedPR, 0),
		ExternalContributorPRs:   make([]ExternalContributorPR, 0),
		PRsAwaitingAuthorResponse: make([]PRAwaitingAuthor, 0),
		FetchedAt:                time.Now(),
	}

	for _, repo := range repos {
		// Check rate limits
		if err := f.checkRateLimit(ctx); err != nil {
			logrus.WithError(err).Warn("Rate limit check failed")
		}

		// Fetch unresponded issues
		unresponded, err := f.fetchUnrespondedIssues(ctx, repo.Org, repo.Repo, cfg.IssueResponseTimeHours)
		if err != nil {
			logrus.WithError(err).Warnf("Failed to fetch unresponded issues for %s/%s", repo.Org, repo.Repo)
		} else {
			items.UnrespondedIssues = append(items.UnrespondedIssues, unresponded...)
		}

		// Fetch unreviewed PRs
		unreviewed, err := f.fetchUnreviewedPRs(ctx, repo.Org, repo.Repo, cfg.PRReviewWaitHours)
		if err != nil {
			logrus.WithError(err).Warnf("Failed to fetch unreviewed PRs for %s/%s", repo.Org, repo.Repo)
		} else {
			items.UnreviewedPRs = append(items.UnreviewedPRs, unreviewed...)
		}

		// Check default branch CI status
		if cfg.CheckDefaultBranchCI {
			failing, err := f.fetchFailingBranches(ctx, repo.Org, repo.Repo)
			if err != nil {
				logrus.WithError(err).Warnf("Failed to check CI status for %s/%s", repo.Org, repo.Repo)
			} else {
				items.FailingBranches = append(items.FailingBranches, failing...)
			}
		}

		// Fetch approved PRs ready to merge
		if cfg.CheckApprovedPRs {
			approved, err := f.fetchApprovedPRsReadyToMerge(ctx, repo.Org, repo.Repo)
			if err != nil {
				logrus.WithError(err).Warnf("Failed to fetch approved PRs for %s/%s", repo.Org, repo.Repo)
			} else {
				items.ApprovedPRsReadyToMerge = append(items.ApprovedPRsReadyToMerge, approved...)
			}
		}

		// Fetch external contributor PRs
		if cfg.CheckExternalContributors {
			external, err := f.fetchExternalContributorPRs(ctx, repo.Org, repo.Repo)
			if err != nil {
				logrus.WithError(err).Warnf("Failed to fetch external contributor PRs for %s/%s", repo.Org, repo.Repo)
			} else {
				items.ExternalContributorPRs = append(items.ExternalContributorPRs, external...)
			}
		}

		// Fetch PRs awaiting author response
		if cfg.CheckPRsAwaitingAuthor {
			awaiting, err := f.fetchPRsAwaitingAuthorResponse(ctx, repo.Org, repo.Repo, cfg.PRAwaitingAuthorResponseDays)
			if err != nil {
				logrus.WithError(err).Warnf("Failed to fetch PRs awaiting author for %s/%s", repo.Org, repo.Repo)
			} else {
				items.PRsAwaitingAuthorResponse = append(items.PRsAwaitingAuthorResponse, awaiting...)
			}
		}

		items.TotalChecked++
	}

	items.TotalItems = len(items.UnrespondedIssues) + len(items.UnreviewedPRs) + len(items.FailingBranches) +
		len(items.ApprovedPRsReadyToMerge) + len(items.ExternalContributorPRs) + len(items.PRsAwaitingAuthorResponse)

	logrus.WithFields(logrus.Fields{
		"unresponded_issues":         len(items.UnrespondedIssues),
		"unreviewed_prs":             len(items.UnreviewedPRs),
		"failing_branches":           len(items.FailingBranches),
		"approved_prs_ready":         len(items.ApprovedPRsReadyToMerge),
		"external_contributor_prs":   len(items.ExternalContributorPRs),
		"prs_awaiting_author":        len(items.PRsAwaitingAuthorResponse),
		"total_items":                items.TotalItems,
	}).Info("Action items fetched successfully")

	return items, nil
}

// fetchUnrespondedIssues finds issues without maintainer response
func (f *Fetcher) fetchUnrespondedIssues(ctx context.Context, org, repo string, responseHours int) ([]UnrespondedIssue, error) {
	cutoffTime := time.Now().Add(-time.Duration(responseHours) * time.Hour)

	opts := &github.IssueListByRepoOptions{
		State:     "open",
		Sort:      "created",
		Direction: "asc",
		// Don't use Since filter - we want ALL open issues, then we'll filter by created time
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	unresponded := make([]UnrespondedIssue, 0)
	totalIssues := 0
	skippedRecent := 0
	skippedPRs := 0

	for {
		issues, resp, err := f.client.Issues.ListByRepo(ctx, org, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list issues: %w", err)
		}

		totalIssues += len(issues)

		for _, issue := range issues {
			// Skip PRs
			if issue.IsPullRequest() {
				skippedPRs++
				continue
			}

			if issue.CreatedAt == nil {
				continue
			}

			// Only check issues created before the cutoff
			if issue.CreatedAt.After(cutoffTime) {
				skippedRecent++
				continue
			}

			// Check if there are any maintainer comments
			hasResponse, err := f.hasRecentMaintainerActivity(ctx, org, repo, issue.GetNumber(), issue.CreatedAt.Time)
			if err != nil {
				logrus.WithError(err).Debugf("Failed to check comments for issue %s/%s#%d", org, repo, issue.GetNumber())
				continue
			}

			if !hasResponse {
				labels := make([]string, 0)
				for _, label := range issue.Labels {
					labels = append(labels, label.GetName())
				}

				daysSince := int(time.Since(issue.CreatedAt.Time).Hours() / 24)
				unresponded = append(unresponded, UnrespondedIssue{
					Org:       org,
					Repo:      repo,
					Number:    issue.GetNumber(),
					Title:     issue.GetTitle(),
					Author:    issue.GetUser().GetLogin(),
					CreatedAt: issue.CreatedAt.Time,
					DaysSince: daysSince,
					URL:       fmt.Sprintf("https://github.com/%s/%s/issues/%d", org, repo, issue.GetNumber()),
					Labels:    labels,
				})
			}
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	logrus.WithFields(logrus.Fields{
		"org":            org,
		"repo":           repo,
		"total_fetched":  totalIssues,
		"skipped_prs":    skippedPRs,
		"skipped_recent": skippedRecent,
		"unresponded":    len(unresponded),
	}).Debug("Checked issues for unresponded items")

	return unresponded, nil
}

// fetchUnreviewedPRs finds non-draft PRs without reviews
func (f *Fetcher) fetchUnreviewedPRs(ctx context.Context, org, repo string, reviewHours int) ([]UnreviewedPR, error) {
	cutoffTime := time.Now().Add(-time.Duration(reviewHours) * time.Hour)

	opts := &github.PullRequestListOptions{
		State:     "open",
		Sort:      "created",
		Direction: "asc",
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	unreviewed := make([]UnreviewedPR, 0)
	totalPRs := 0
	skippedRecent := 0
	skippedDraft := 0
	skippedHasReviews := 0

	for {
		prs, resp, err := f.client.PullRequests.List(ctx, org, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list pull requests: %w", err)
		}

		totalPRs += len(prs)

		for _, pr := range prs {
			if pr.CreatedAt == nil {
				continue
			}

			// Skip if too recent
			if pr.CreatedAt.After(cutoffTime) {
				skippedRecent++
				continue
			}

			// Skip draft PRs
			if pr.GetDraft() {
				skippedDraft++
				continue
			}

			// Check for reviews
			reviews, _, err := f.client.PullRequests.ListReviews(ctx, org, repo, pr.GetNumber(), &github.ListOptions{PerPage: 1})
			if err != nil {
				logrus.WithError(err).Debugf("Failed to check reviews for PR %s/%s#%d", org, repo, pr.GetNumber())
				continue
			}

			// If no reviews, add to list
			if len(reviews) == 0 {
				daysSince := int(time.Since(pr.CreatedAt.Time).Hours() / 24)
				unreviewed = append(unreviewed, UnreviewedPR{
					Org:       org,
					Repo:      repo,
					Number:    pr.GetNumber(),
					Title:     pr.GetTitle(),
					Author:    pr.GetUser().GetLogin(),
					CreatedAt: pr.CreatedAt.Time,
					DaysSince: daysSince,
					URL:       fmt.Sprintf("https://github.com/%s/%s/pull/%d", org, repo, pr.GetNumber()),
					IsDraft:   pr.GetDraft(),
				})
			} else {
				skippedHasReviews++
			}
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	logrus.WithFields(logrus.Fields{
		"org":                org,
		"repo":               repo,
		"total_fetched":      totalPRs,
		"skipped_recent":     skippedRecent,
		"skipped_draft":      skippedDraft,
		"skipped_has_reviews": skippedHasReviews,
		"unreviewed":         len(unreviewed),
	}).Debug("Checked PRs for unreviewed items")

	return unreviewed, nil
}

// fetchFailingBranches checks if the default branch has failing CI
func (f *Fetcher) fetchFailingBranches(ctx context.Context, org, repo string) ([]FailingBranch, error) {
	// Get repository to find default branch
	repository, _, err := f.client.Repositories.Get(ctx, org, repo)
	if err != nil {
		return nil, fmt.Errorf("failed to get repository: %w", err)
	}

	defaultBranch := repository.GetDefaultBranch()
	if defaultBranch == "" {
		defaultBranch = "main"
	}

	// Get combined status for default branch
	status, _, err := f.client.Repositories.GetCombinedStatus(ctx, org, repo, defaultBranch, &github.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get branch status: %w", err)
	}

	failing := make([]FailingBranch, 0)

	// Check if status is failing
	state := status.GetState()
	if state == "failure" || state == "error" {
		failing = append(failing, FailingBranch{
			Org:       org,
			Repo:      repo,
			Branch:    defaultBranch,
			Status:    state,
			URL:       fmt.Sprintf("https://github.com/%s/%s/tree/%s", org, repo, defaultBranch),
			ChecksURL: fmt.Sprintf("https://github.com/%s/%s/commits/%s", org, repo, defaultBranch),
		})
	}

	return failing, nil
}

// fetchApprovedPRsReadyToMerge finds PRs with approving reviews and passing CI
func (f *Fetcher) fetchApprovedPRsReadyToMerge(ctx context.Context, org, repo string) ([]ApprovedPR, error) {
	opts := &github.PullRequestListOptions{
		State:     "open",
		Sort:      "created",
		Direction: "asc",
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	approvedPRs := make([]ApprovedPR, 0)

	for {
		prs, resp, err := f.client.PullRequests.List(ctx, org, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list pull requests: %w", err)
		}

		for _, pr := range prs {
			if pr.CreatedAt == nil {
				continue
			}

			// Skip draft PRs
			if pr.GetDraft() {
				continue
			}

			// Get reviews
			reviews, _, err := f.client.PullRequests.ListReviews(ctx, org, repo, pr.GetNumber(), &github.ListOptions{PerPage: 100})
			if err != nil {
				logrus.WithError(err).Debugf("Failed to check reviews for PR %s/%s#%d", org, repo, pr.GetNumber())
				continue
			}

			// Count approvals and check for requested changes
			approvalCount := 0
			hasRequestedChanges := false
			var lastApprovalTime time.Time

			for _, review := range reviews {
				if review.GetState() == "APPROVED" {
					approvalCount++
					if review.SubmittedAt != nil && (lastApprovalTime.IsZero() || review.SubmittedAt.After(lastApprovalTime)) {
						lastApprovalTime = review.SubmittedAt.Time
					}
				} else if review.GetState() == "CHANGES_REQUESTED" {
					hasRequestedChanges = true
				}
			}

			// Must have at least one approval and no requested changes
			if approvalCount == 0 || hasRequestedChanges {
				continue
			}

			// Check CI status
			if pr.Head == nil || pr.Head.SHA == nil {
				continue
			}

			status, _, err := f.client.Repositories.GetCombinedStatus(ctx, org, repo, pr.Head.GetSHA(), &github.ListOptions{})
			if err != nil {
				logrus.WithError(err).Debugf("Failed to check CI status for PR %s/%s#%d", org, repo, pr.GetNumber())
				// Include PRs even if we can't check CI - maintainer can verify manually
			} else {
				// Only include PRs with passing CI
				state := status.GetState()
				if state != "success" && state != "" {
					continue
				}
			}

			// Check if mergeable (no conflicts)
			if pr.GetMergeable() == false {
				continue
			}

			daysSince := 0
			if !lastApprovalTime.IsZero() {
				daysSince = int(time.Since(lastApprovalTime).Hours() / 24)
			}

			approvedPRs = append(approvedPRs, ApprovedPR{
				Org:           org,
				Repo:          repo,
				Number:        pr.GetNumber(),
				Title:         pr.GetTitle(),
				Author:        pr.GetUser().GetLogin(),
				ApprovedAt:    lastApprovalTime,
				DaysSince:     daysSince,
				ApprovalCount: approvalCount,
				URL:           fmt.Sprintf("https://github.com/%s/%s/pull/%d", org, repo, pr.GetNumber()),
			})
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return approvedPRs, nil
}

// fetchExternalContributorPRs finds PRs from non-collaborators
func (f *Fetcher) fetchExternalContributorPRs(ctx context.Context, org, repo string) ([]ExternalContributorPR, error) {
	opts := &github.PullRequestListOptions{
		State:     "open",
		Sort:      "created",
		Direction: "asc",
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	externalPRs := make([]ExternalContributorPR, 0)

	for {
		prs, resp, err := f.client.PullRequests.List(ctx, org, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list pull requests: %w", err)
		}

		for _, pr := range prs {
			if pr.CreatedAt == nil || pr.User == nil {
				continue
			}

			// Skip draft PRs
			if pr.GetDraft() {
				continue
			}

			author := pr.GetUser().GetLogin()
			if author == "" {
				continue
			}

			// Check if author is a maintainer (admin or maintain role)
			isCollab, err := f.isCollaborator(ctx, org, repo, author)
			if err != nil {
				logrus.WithError(err).Debugf("Failed to check maintainer status for %s on %s/%s", author, org, repo)
				continue
			}

			// Only include external contributors (non-maintainers)
			if isCollab {
				continue
			}

			// Check if this is their first PR to this repo
			isFirstTime := false
			authorQuery := fmt.Sprintf("type:pr repo:%s/%s author:%s is:merged", org, repo, author)
			searchResult, _, err := f.client.Search.Issues(ctx, authorQuery, &github.SearchOptions{
				ListOptions: github.ListOptions{PerPage: 1},
			})
			if err == nil && searchResult.GetTotal() == 0 {
				isFirstTime = true
			}

			daysWaiting := int(time.Since(pr.CreatedAt.Time).Hours() / 24)

			externalPRs = append(externalPRs, ExternalContributorPR{
				Org:         org,
				Repo:        repo,
				Number:      pr.GetNumber(),
				Title:       pr.GetTitle(),
				Author:      author,
				CreatedAt:   pr.CreatedAt.Time,
				DaysWaiting: daysWaiting,
				IsFirstTime: isFirstTime,
				URL:         fmt.Sprintf("https://github.com/%s/%s/pull/%d", org, repo, pr.GetNumber()),
			})
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return externalPRs, nil
}

// fetchPRsAwaitingAuthorResponse finds PRs with requested changes but no author response
func (f *Fetcher) fetchPRsAwaitingAuthorResponse(ctx context.Context, org, repo string, daysThreshold int) ([]PRAwaitingAuthor, error) {
	cutoffTime := time.Now().Add(-time.Duration(daysThreshold) * 24 * time.Hour)

	opts := &github.PullRequestListOptions{
		State:     "open",
		Sort:      "created",
		Direction: "asc",
		ListOptions: github.ListOptions{
			PerPage: 100,
		},
	}

	awaitingPRs := make([]PRAwaitingAuthor, 0)

	for {
		prs, resp, err := f.client.PullRequests.List(ctx, org, repo, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to list pull requests: %w", err)
		}

		for _, pr := range prs {
			if pr.CreatedAt == nil || pr.User == nil {
				continue
			}

			// Skip draft PRs
			if pr.GetDraft() {
				continue
			}

			// Get reviews
			reviews, _, err := f.client.PullRequests.ListReviews(ctx, org, repo, pr.GetNumber(), &github.ListOptions{PerPage: 100})
			if err != nil {
				logrus.WithError(err).Debugf("Failed to check reviews for PR %s/%s#%d", org, repo, pr.GetNumber())
				continue
			}

			// Find the most recent "CHANGES_REQUESTED" review
			var latestChangeRequest *github.PullRequestReview
			for _, review := range reviews {
				if review.GetState() == "CHANGES_REQUESTED" {
					if latestChangeRequest == nil || (review.SubmittedAt != nil && latestChangeRequest.SubmittedAt != nil && review.SubmittedAt.After(latestChangeRequest.SubmittedAt.Time)) {
						latestChangeRequest = review
					}
				}
			}

			// Skip if no changes requested
			if latestChangeRequest == nil || latestChangeRequest.SubmittedAt == nil {
				continue
			}

			requestTime := latestChangeRequest.SubmittedAt.Time

			// Skip if changes requested recently
			if requestTime.After(cutoffTime) {
				continue
			}

			// Check if author has responded after the change request
			// by checking commits or comments after the request time
			hasResponded := false

			// Check for commits after the review
			commits, _, err := f.client.PullRequests.ListCommits(ctx, org, repo, pr.GetNumber(), &github.ListOptions{PerPage: 100})
			if err == nil {
				for _, commit := range commits {
					if commit.Commit != nil && commit.Commit.Author != nil && commit.Commit.Author.Date != nil {
						if commit.Commit.Author.Date.After(requestTime) {
							hasResponded = true
							break
						}
					}
				}
			}

			// Check for author comments after the review
			if !hasResponded {
				comments, _, err := f.client.Issues.ListComments(ctx, org, repo, pr.GetNumber(), &github.IssueListCommentsOptions{
					Since:       &requestTime,
					ListOptions: github.ListOptions{PerPage: 100},
				})
				if err == nil {
					author := pr.GetUser().GetLogin()
					for _, comment := range comments {
						if comment.User != nil && comment.GetUser().GetLogin() == author {
							hasResponded = true
							break
						}
					}
				}
			}

			// Only include PRs where author hasn't responded
			if hasResponded {
				continue
			}

			daysSince := int(time.Since(requestTime).Hours() / 24)
			reviewer := latestChangeRequest.GetUser().GetLogin()

			awaitingPRs = append(awaitingPRs, PRAwaitingAuthor{
				Org:              org,
				Repo:             repo,
				Number:           pr.GetNumber(),
				Title:            pr.GetTitle(),
				Author:           pr.GetUser().GetLogin(),
				Reviewer:         reviewer,
				RequestedAt:      requestTime,
				DaysSinceRequest: daysSince,
				URL:              fmt.Sprintf("https://github.com/%s/%s/pull/%d", org, repo, pr.GetNumber()),
			})
		}

		if resp.NextPage == 0 {
			break
		}
		opts.Page = resp.NextPage
	}

	return awaitingPRs, nil
}
