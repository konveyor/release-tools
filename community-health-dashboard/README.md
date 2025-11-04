# Konveyor Community Health Dashboard

A comprehensive dashboard for monitoring community health metrics across Konveyor repositories with four specialized views.

## Features

The dashboard provides four tabbed views, each focusing on different aspects of community health:

### Overview Tab

The main dashboard view showing overall community health:

**Live Metrics Cards:**
- **Total Contributors (90d)** - Unique contributors in the last 90 days
- **New Contributors (30d)** - First-time contributors in the last 30 days
- **Avg Response Time** - Average time until first response on issues/PRs
- **PR Merge Rate (30d)** - Percentage of PRs merged in the last 30 days

**Activity Heatmap:**
- Visual representation of activity by day of week and hour (UTC)
- Color-coded cells showing activity intensity
- Helps identify peak contribution times

**Repository Breakdown Table:**
- Contributors per repository
- New contributors count
- Average issue response time
- Average PR response time
- PR merge rate with color coding (green ≥70%, orange <70%)
- Open issues and PRs counts
- Sortable columns for easy analysis

**Recent Activity Feed:**
- Last 50 issues and PRs across all repositories
- Filter by repository
- Shows type (issue/PR), title, author, created time, and status
- Links directly to GitHub

**Historical Trends** (when available):
- Contributor trends over time (total and new)
- Activity trends (open issues and PRs)
- Response time trends
- PR merge rate trends
- Customizable time periods (30/60/90/180/365 days or all time)

### PR Health Tab

Dedicated view for pull request metrics and trends:

**PR Health Metrics Cards:**
- **PR Merge Rate (30d)** - Percentage of PRs successfully merged
- **Avg Time to First Review** - How quickly PRs receive initial review
- **Avg Time to Merge** - Average time from PR creation to merge
- **Avg PR Revisions** - Average number of commits per PR

**PR Size Distribution Chart:**
- Doughnut chart showing distribution of PR sizes
- Categories: XS (<50 lines), S (50-200), M (200-500), L (500-1000), XL (>1000)
- Helps identify if PRs are appropriately sized

**Repository PR Metrics Table:**
- Per-repository PR statistics
- Merge rate, review time, merge time, revision count
- Total PRs (30d) and currently open PRs
- Sortable columns

**PR Health Trends** (when available):
- Review time trends over time
- Merge time trends over time
- Helps track process improvements

### Issue Health Tab

Focus on issue management and community engagement:

**Issue Health Metrics Cards:**
- **Issue Closure Rate** - Percentage of issues that get resolved
- **Avg Time to Close** - Average time from issue creation to closure
- **Response Coverage** - Percentage of issues that receive responses
- **Community Response Rate** - Percentage of first responses from community (vs maintainers)

**Issue Age Distribution Chart:**
- Bar chart showing how long open issues have been open
- Categories: 0-7 days, 7-30 days, 30-90 days, 90+ days
- Helps identify backlog buildup

**Response Distribution Chart:**
- Doughnut chart showing who provides first responses
- Community vs Maintainer response breakdown
- Indicates community self-sufficiency

**Repository Issue Metrics Table:**
- Closure rate per repository
- Average time to close
- Average time to first response
- Response coverage percentage
- Average comments per issue
- Open issues count
- Sortable columns

**Issue Health Trends** (when available):
- Issue closure rate over time
- Response time trends

### Maintainer Health Tab

Monitor maintainer workload and prevent burnout:

**Maintainer Health Metrics Cards:**
- **Active Maintainers (30d)** - Number of people providing responses
- **Avg Response Load** - Average responses per maintainer
- **Response Concentration** - Percentage of work done by top 20% (lower is better)
- **Burnout Risk** - Risk indicator (Low/Medium/High) based on concentration

**Response Concentration Chart:**
- Bar chart showing top 10 most active responders
- Visualizes workload distribution

**Contributor Distribution (Bus Factor) Chart:**
- Line chart showing cumulative response share
- Shows how many people are needed to account for X% of responses
- Higher "bus factor" indicates healthier distribution

**Top Maintainers Table:**
- Top 20 most active maintainers
- Total responses, issue responses, PR reviews
- Average response time
- Number of repositories they're active in
- Response share percentage
- Highlights potential burnout risks (high share %)

**Maintainer Health Trends** (when available):
- Active maintainer count over time
- Response concentration trends
- Helps track maintainer sustainability

## Implementation Status

**Current Status:**
- ✅ **Overview Tab**: Fully functional with live GitHub API data
- ⚠️ **PR Health Tab**: Currently using representative mock data for demonstration
- ⚠️ **Issue Health Tab**: Currently using representative mock data for demonstration
- ⚠️ **Maintainer Health Tab**: Currently using representative mock data for demonstration

The mock data provides realistic patterns to demonstrate the dashboard's capabilities. Future updates will connect all tabs to live GitHub API data.

## Setup

### 1. Configure Repositories
Edit `config.js` to specify which repositories to track:

```javascript
repositories: [
    { org: 'konveyor', repo: 'analyzer-lsp' },
    { org: 'konveyor', repo: 'kai' },
    // Add more repositories...
]
```

### 2. GitHub Token (Optional but Recommended)
To avoid GitHub API rate limiting:

1. Create a personal access token at https://github.com/settings/tokens
2. Required scope: `public_repo` (for public repositories)
3. Set the token in your browser console:
   ```javascript
   setGitHubToken('your_token_here')
   ```

The token is stored in localStorage and only used for client-side API requests.

### 3. Enable Automated Data Collection

The GitHub Actions workflow is **already configured** and will automatically collect community health metrics daily at 3:00 AM UTC. Historical data is stored in `data/history/` for trend visualization.

**⚠️ One-Time Configuration Required (Maintainers Only):**

After merging to the upstream repository, a repository maintainer must enable workflow write permissions:

1. Go to **Settings → Actions → General** in the repository
2. Under "**Workflow permissions**", select "**Read and write permissions**"
3. Click "**Save**"

**Why**: The workflow needs write permission to commit daily metric files. Without this, the workflow will run but fail to save data.

**Verifying the Workflow:**

To manually trigger data collection and verify it works:
1. Go to **Actions** tab in GitHub
2. Select "**Collect Community Health Metrics**" workflow
3. Click "**Run workflow**"
4. Wait for completion (~2-5 minutes)
5. Check that a new file appears in `community-health-dashboard/data/history/YYYY-MM-DD.json`

**What Gets Collected:**
- Overview metrics (contributors, response times, PR merge rates)
- Per-repository statistics
- Aggregate metrics across all configured repositories
- Updates `index.json` with available dates

Once configured, the workflow runs automatically every day and the dashboard will display historical trends.

## Usage

### Viewing the Dashboard
Open `index.html` in a web browser. For GitHub Pages deployment, the dashboard is automatically available at:
```
https://[your-org].github.io/release-tools/community-health-dashboard/
```

### Understanding the Metrics

#### Overview Metrics
- **Contributors (90d)**: Number of unique people who have made commits in the last 90 days. Indicates breadth of community involvement.
- **New Contributors (30d)**: Contributors who made their first contribution in the last 30 days. Shows community growth.
- **Avg Response Time**: Average time until an issue or PR receives its first comment. Lower is better - shows community responsiveness.
- **PR Merge Rate**: Percentage of PRs that eventually get merged. High rates (>70%) indicate healthy collaboration and effective contribution processes.

#### PR Health Metrics
- **Avg Time to First Review**: How quickly PRs receive their first review comment. Shorter times encourage contributors.
- **Avg Time to Merge**: Duration from PR creation to merge. Indicates review process efficiency.
- **Avg PR Revisions**: Number of commits per PR. Too many might indicate unclear requirements; too few might indicate insufficient review.
- **PR Size Distribution**: Smaller PRs (XS/S) are generally easier to review and merge. Large PRs may need to be broken down.

#### Issue Health Metrics
- **Issue Closure Rate**: Percentage of issues that get resolved. Rates >70% are generally healthy.
- **Avg Time to Close**: How long issues stay open. Shorter is better, but varies by project complexity.
- **Response Coverage**: Percentage of issues that receive at least one response. High coverage (>80%) shows active engagement.
- **Community Response Rate**: Percentage of first responses from non-maintainers. Higher rates indicate self-sustaining community.

#### Maintainer Health Metrics
- **Active Maintainers**: Number of people providing responses. More maintainers distributes workload better.
- **Avg Response Load**: Responses per maintainer. Very high loads may indicate burnout risk.
- **Response Concentration**: Percentage of work done by top 20%. Values >80% indicate risk - too much work on too few people.
- **Burnout Risk**: Calculated indicator based on concentration. High concentration = High burnout risk.
- **Bus Factor**: The minimum number of maintainers who do the majority of work. Higher is better for project sustainability.

## File Structure

```
community-health-dashboard/
├── index.html           # Main dashboard page
├── app.js               # Dashboard logic and API calls
├── config.js            # Repository configuration
├── styles.css           # Grafana-inspired dark theme
├── konveyor-logo.svg    # Konveyor logo
├── data/
│   └── history/         # Historical metrics data (JSON files)
│       ├── index.json   # Index of available dates
│       ├── 2025-01-15.json
│       └── 2025-01-16.json
└── README.md            # This file
```

## Metrics Calculation

### Overview Tab Metrics

**Contributors**:
- Determined by analyzing commits in the specified time period (default 90 days)
- New contributors are those whose first commit appears in the new contributor period (default 30 days)
- Uses Git commit author information from GitHub API

**Response Time**:
- Calculated as time from issue/PR creation to first comment
- Averaged across all repositories
- Excludes items with no responses
- Separate calculations for issues and PRs, then combined

**PR Merge Rate**:
- Percentage of PRs created in the period that were merged
- Calculated per repository, then averaged
- Based on last 30 days of PR activity

**Activity Heatmap**:
- Currently uses representative activity patterns
- Shows typical activity distribution by day and hour (UTC)

### PR Health Tab Metrics

**Time to First Review**:
- Time from PR creation to first review comment
- Averaged across all PRs that received reviews
- Based on last 30 days of PR activity

**Time to Merge**:
- Time from PR creation to merge completion
- Only includes successfully merged PRs
- Based on last 30 days of PR activity

**PR Revisions**:
- Number of commits in each PR
- Averaged across all PRs in the time period

**PR Size Distribution**:
- Calculated from total lines changed (additions + deletions)
- XS: <50, S: 50-200, M: 200-500, L: 500-1000, XL: >1000 lines

### Issue Health Tab Metrics

**Issue Closure Rate**:
- Percentage of issues that are in closed state
- Calculated across all tracked issues

**Time to Close**:
- Duration from issue creation to closure
- Only includes closed issues
- Averaged across all repositories

**Response Coverage**:
- Percentage of issues that received at least one comment
- Indicates community engagement level

**Community Response Rate**:
- Percentage of first responses made by non-maintainer users
- Higher rates indicate community self-sufficiency

**Issue Age Distribution**:
- Categories based on time since creation
- Only counts currently open issues

### Maintainer Health Tab Metrics

**Active Maintainers**:
- Count of unique users who provided responses (comments/reviews) in last 30 days
- Includes both issue comments and PR reviews

**Response Load**:
- Total responses divided by number of active maintainers
- Indicates average workload per person

**Response Concentration**:
- Percentage of total responses made by top 20% of maintainers
- Uses Gini coefficient approximation
- Higher values indicate uneven workload distribution

**Burnout Risk**:
- Qualitative indicator based on response concentration
- Low: <60%, Medium: 60-80%, High: >80%

**Bus Factor**:
- Cumulative distribution showing minimum maintainers needed for X% of work
- Lower bus factor (fewer people doing most work) indicates higher project risk

## API Rate Limits

**Without token**: 60 requests/hour per IP
**With token**: 5,000 requests/hour

The dashboard makes approximately 3-5 requests per repository on load. For tracking many repositories, a token is recommended.

## Customization

### Time Periods
Edit `config.js` to adjust metric calculation periods:

```javascript
periods: {
    contributors: 90,      // Look back 90 days
    newContributors: 30,   // New contributors in last 30 days
    responseTime: 30,      // Calculate response times over last 30 days
    prMergeRate: 30,       // PR merge rate over last 30 days
    recentActivity: 14,    // Show activity from last 14 days
}
```

### Styling
The dashboard uses CSS variables in `styles.css` for easy theme customization:

```css
:root {
    --bg-primary: #0b0c0e;
    --accent-blue: #33b5e5;
    --accent-green: #73bf69;
    /* ... more variables */
}
```

## Troubleshooting

### "Failed to load data"
- Check that repositories are publicly accessible
- Verify GitHub token if using one
- Check browser console for specific error messages

### Missing historical data
- Workflow must run at least once to generate data
- Check that workflow has necessary permissions (`contents: write`)
- Verify workflow ran successfully in Actions tab

### Workflow fails to commit data
- **Error**: "Permission denied" or "refusing to allow a GitHub App to create or update workflow"
- **Solution**: Enable workflow write permissions in Settings → Actions → General → "Read and write permissions"

### Workflow runs but no new data appears
- Check the workflow logs in Actions tab for errors
- Verify `GITHUB_TOKEN` has access to all configured repositories
- Ensure repositories in `config.js` are public or accessible
- Check for API rate limiting errors in logs

### Rate limit errors
- Add a GitHub token as described in Setup
- Reduce number of repositories being tracked
- Wait for rate limit to reset (shown in error message)

## Contributing

To add new metrics or improve the dashboard:
1. Modify `app.js` to fetch and calculate new metrics
2. Update `index.html` to display the metrics
3. Adjust the GitHub Actions workflow if historical data collection is needed
4. Update this README with the new metrics documentation
