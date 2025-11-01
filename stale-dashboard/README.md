# Konveyor Stale Issues Dashboard

A Grafana-inspired dashboard for monitoring stale issues and pull requests across Konveyor repositories.

## Features

- Real-time data fetched from GitHub API
- **Historical Trends**: Automated collection and visualization of stale items over time
- Filter by repository, type (issue/PR), and search by title
- Sortable columns
- Statistics overview with trend charts
- Dark theme inspired by Grafana
- No backend required - runs entirely in the browser
- Easy to host on GitHub Pages

## Quick Start

### Option 1: Local Development

1. Clone the repository and navigate to the dashboard directory:
   ```bash
   cd stale-dashboard
   ```

2. Serve the files using a local web server:
   ```bash
   # Using Python 3
   python3 -m http.server 8000

   # Using Node.js
   npx http-server -p 8000
   ```

3. Open your browser to `http://localhost:8000`

### Option 2: GitHub Pages Deployment

1. Enable GitHub Pages in the repository (typically upstream konveyor/release-tools):
   - Go to repository Settings
   - Navigate to "Pages" section
   - Set source to "Deploy from a branch"
   - Select the `main` branch
   - Set the folder to `/` (root)
   - Click "Save"

2. Access the dashboard at:
   ```
   https://konveyor.github.io/release-tools/stale-dashboard/
   ```

   Or if deploying from a fork:
   ```
   https://YOUR-USERNAME.github.io/release-tools/stale-dashboard/
   ```

## Configuration

### Adding Repositories

Edit `config.js` to add more repositories as you deploy the stale workflow to them:

```javascript
repositories: [
    { org: 'konveyor', repo: 'analyzer-lsp' },
    { org: 'konveyor', repo: 'tackle2-hub' },
    { org: 'konveyor', repo: 'tackle2-ui' },
    // Add more repositories here
]
```

### GitHub Token (Optional but Recommended)

GitHub's API has rate limits:
- **Unauthenticated**: 60 requests per hour
- **Authenticated**: 5,000 requests per hour

To avoid rate limiting, create a GitHub Personal Access Token:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Stale Dashboard")
4. Select scopes:
   - `public_repo` (for public repositories)
5. Click "Generate token"
6. Copy the token

#### Setting the Token

**Method 1: Browser Console (Recommended for GitHub Pages)**

Open the browser console and run:
```javascript
setGitHubToken('your_token_here')
```

The token will be stored in localStorage and persist across sessions.

**Method 2: Direct Configuration (Not recommended for public repos)**

Edit `config.js`:
```javascript
githubToken: 'your_token_here',
```

**Important**: Never commit your token to a public repository!

To clear the token:
```javascript
clearGitHubToken()
```

## Dashboard Features

### Statistics Cards
- **Total Stale Items**: Combined count of stale issues and PRs
- **Stale Issues**: Count of stale issues
- **Stale PRs**: Count of stale pull requests
- **Repositories**: Number of repositories with stale items

### Historical Trends (Optional)
If you enable historical data collection, the dashboard displays:
- **Stale Items Over Time**: Line chart showing trends in stale issues and PRs
- **Repository Breakdown**: Bar chart showing which repos have the most stale items
- **Time Period Selector**: View trends for last 30/60/90/180/365 days or all time

To enable historical trends, see [Enabling Historical Data Collection](#enabling-historical-data-collection) below.

### Filters
- **Repository**: Filter by specific repository
- **Type**: Show only issues or only PRs
- **Search**: Search by title text
- **Clear Filters**: Reset all filters

### Table View
- Sortable columns (click headers to sort)
- Color-coded badges for issues vs PRs
- Label display
- Direct links to GitHub

## Stale Workflow Integration

This dashboard is designed to work with the stale workflow deployed via the `stale-workflow` tool. The workflow:

- Marks issues and PRs as stale after 60 days of inactivity
- Adds the `stale` label
- Does not auto-close items
- Removes the stale label when items are updated

To deploy the stale workflow to a repository:
```bash
cd stale-workflow
./deploy-stale-workflow.sh konveyor/repository-name
```

See the [stale-workflow README](../stale-workflow/README.md) for more information.

## Enabling Historical Data Collection

To track trends over time, automated data collection can be enabled that runs daily and commits snapshots to the repository.

**Note**: This feature should be enabled in the **upstream konveyor/release-tools repository** by a maintainer. This ensures everyone views the same historical data on a centralized dashboard.

### Setup (for Maintainers)

1. Run the setup script from the `stale-workflow` directory:
   ```bash
   cd stale-workflow
   ./setup-history-collection.sh
   ```

   This will automatically create a pull request to add the history collection workflow.

2. Review and merge the PR.

3. **Important**: After merging, enable workflow write permissions:
   - Go to Settings > Actions > General
   - Under "Workflow permissions", select "Read and write permissions"
   - Click "Save"

4. The workflow will run automatically daily at 2:00 AM UTC, or can be triggered manually:
   ```bash
   gh workflow run collect-stale-history.yml
   ```

### For Non-Maintainers

If you're not a maintainer but want to see historical trends, wait for a maintainer to enable this feature in upstream. Once enabled, the dashboard will automatically display trend charts when you visit it.

### How It Works

- The workflow collects data from all repositories in `stale-dashboard/config.js`
- Creates a JSON file with the date (e.g., `2025-11-01.json`) in `stale-dashboard/data/history/`
- Commits the data automatically
- The dashboard detects these files and displays trend charts

### Data Format

Each historical data file contains:
```json
{
  "date": "2025-11-01",
  "totals": {
    "totalStale": 42,
    "staleIssues": 30,
    "stalePRs": 12,
    "repositories": 5
  },
  "repositories": [...]
}
```

## Browser Support

The dashboard works in all modern browsers:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### No data showing
1. Check browser console for errors
2. Verify repositories are configured correctly in `config.js`
3. Ensure the stale workflow is deployed and has run
4. Check GitHub API rate limits

### Rate limit errors
- Add a GitHub token (see Configuration above)
- Wait for rate limit to reset (check console for reset time)

### CORS errors
- The GitHub API supports CORS, so this shouldn't happen
- If using a local file:// URL, use a local web server instead

## Contributing

Contributions are welcome! Please follow the [Konveyor community guidelines](https://github.com/konveyor/community/blob/main/CONTRIBUTING.md).

## License

See the main repository [LICENSE](../../LICENSE) file.
