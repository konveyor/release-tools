// Dashboard Configuration
const DASHBOARD_CONFIG = {
    // GitHub Personal Access Token (optional but recommended)
    // To avoid rate limiting, create a token at: https://github.com/settings/tokens
    // Required scopes: public_repo (for public repositories)
    //
    // IMPORTANT: For security, you can also use environment-specific configs:
    // 1. Store token in localStorage (set via browser console)
    // 2. Use GitHub Pages environment secrets
    // 3. Leave empty for unauthenticated requests (60 requests/hour limit)
    githubToken: localStorage.getItem('github_token') || '',

    // List of repositories to monitor for stale issues/PRs
    // Add repositories as you deploy the stale workflow to them
    repositories: [
        { org: 'konveyor', repo: 'analyzer-lsp' },
        // Add more repositories here as the stale workflow is deployed
        // { org: 'konveyor', repo: 'tackle2-hub' },
        // { org: 'konveyor', repo: 'tackle2-ui' },
        // { org: 'konveyor', repo: 'kai' },
    ]
};

// Helper: Set GitHub token via browser console
// Usage: setGitHubToken('your_token_here')
function setGitHubToken(token) {
    localStorage.setItem('github_token', token);
    console.log('GitHub token saved to localStorage');
    console.log('Refresh the page to use the new token');
}

// Helper: Clear GitHub token
// Usage: clearGitHubToken()
function clearGitHubToken() {
    localStorage.removeItem('github_token');
    console.log('GitHub token cleared from localStorage');
}
