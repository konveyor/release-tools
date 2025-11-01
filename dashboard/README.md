# Konveyor Stale Issues Dashboard

A Grafana-inspired dashboard for monitoring stale issues and pull requests across Konveyor repositories.

## Features

- Real-time data fetched from GitHub API
- Filter by repository, type (issue/PR), and search by title
- Sortable columns
- Statistics overview
- Dark theme inspired by Grafana
- No backend required - runs entirely in the browser
- Easy to host on GitHub Pages

## Quick Start

### Option 1: Local Development

1. Clone the repository and navigate to the dashboard directory:
   ```bash
   cd dashboard
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

1. Enable GitHub Pages for your fork:
   - Go to your repository settings
   - Navigate to "Pages" section
   - Set source to "Deploy from a branch"
   - Select the branch containing the dashboard
   - Set the folder to `/dashboard` (or root if you move the files)
   - Click "Save"

2. Access your dashboard at:
   ```
   https://YOUR-USERNAME.github.io/release-tools/
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

See the main repository [LICENSE](../LICENSE) file.
