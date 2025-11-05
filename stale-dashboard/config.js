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
        { org: 'konveyor', repo: 'enhancements' },
        { org: 'konveyor', repo: 'java-analyzer-bundle' },
        { org: 'konveyor', repo: 'kai' },
        { org: 'konveyor', repo: 'kantra' },
        { org: 'konveyor', repo: 'operator' },
        { org: 'konveyor', repo: 'rulesets' },
        { org: 'konveyor', repo: 'tackle2-hub' },
        { org: 'konveyor', repo: 'tackle2-ui' },
    ],

    // Message to post when closing stale items
    staleCloseMessage: `This issue/PR has been marked as stale and is being closed due to inactivity. If you believe this is still relevant, please feel free to reopen it with updated information or context.

Thank you for your contributions to the Konveyor project!`
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
