# Konveyor Community Health Dashboard

A real-time dashboard for monitoring community health metrics across Konveyor repositories.

## Features

### Live Metrics
- **Total Contributors** - Unique contributors in the last 90 days
- **New Contributors** - First-time contributors in the last 30 days
- **Average Response Time** - How quickly issues and PRs receive first responses
- **PR Merge Rate** - Percentage of PRs that get merged (last 30 days)

### Repository Breakdown
View detailed metrics for each repository:
- Contributor counts (total and new)
- Average issue response time
- Average PR response time
- PR merge rate
- Open issues and PRs

### Recent Activity
Track recent issues and pull requests across all repositories with filtering by repository.

### Historical Trends
View historical data over time with customizable time periods:
- Contributor trends (total and new)
- Activity trends (open issues and PRs)
- Response time trends
- PR merge rate trends

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
The GitHub Actions workflow automatically collects community health metrics daily at 3:00 AM UTC. It stores historical data in `data/history/` for trend visualization.

To manually trigger data collection:
1. Go to Actions tab in GitHub
2. Select "Collect Community Health Metrics" workflow
3. Click "Run workflow"

## Usage

### Viewing the Dashboard
Open `index.html` in a web browser. For GitHub Pages deployment, the dashboard is automatically available at:
```
https://[your-org].github.io/release-tools/community-health-dashboard/
```

### Understanding the Metrics

**Contributors (90d)**: Number of unique people who have made commits in the last 90 days. Indicates breadth of community involvement.

**New Contributors (30d)**: Contributors who made their first contribution in the last 30 days. Shows community growth.

**Avg Response Time**: Average time until an issue or PR receives its first comment. Lower is better - shows community responsiveness.

**PR Merge Rate**: Percentage of PRs that eventually get merged. High rates (>70%) indicate healthy collaboration and effective contribution processes.

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

### Contributors
- Determined by analyzing commits in the specified time period
- New contributors are those whose first commit appears in the new contributor period

### Response Time
- Calculated as time from issue/PR creation to first comment
- Averaged across all repositories
- Excludes items with no responses

### PR Merge Rate
- Percentage of PRs created in the period that were merged
- Calculated per repository, then averaged

### Open Issues/PRs
- Current count of open items
- For issues, excludes PRs (GitHub API returns PRs as issues)

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
