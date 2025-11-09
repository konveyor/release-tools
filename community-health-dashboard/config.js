// Community Health Dashboard Configuration
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

    // List of repositories to monitor for community health metrics
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

    // Time periods for metrics calculation (in days)
    periods: {
        contributors: 90,      // Look back 90 days for total contributors
        newContributors: 30,   // New contributors in last 30 days
        responseTime: 30,      // Calculate response times over last 30 days
        prMergeRate: 30,       // PR merge rate over last 30 days
        recentActivity: 14,    // Show activity from last 14 days
    },

    // Mock data configuration
    // Auto-detects environment: uses mock data locally, live data on GitHub Pages
    // To override: set useMockData to true (always mock) or false (always live)
    useMockData: (() => {
        // Check if running on GitHub Pages (production)
        const isGitHubPages = window.location.hostname.includes('github.io');
        // Use live data on GitHub Pages, mock data locally
        return !isGitHubPages;
    })()
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
