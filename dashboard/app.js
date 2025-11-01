// Stale Issues Dashboard App
class StaleDashboard {
    constructor() {
        this.staleItems = [];
        this.filteredItems = [];
        this.currentSort = { field: 'updated', ascending: false };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadData();
        });

        // Filters
        document.getElementById('repo-filter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('type-filter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('search-filter').addEventListener('input', () => {
            this.applyFilters();
        });

        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                this.sortBy(field);
            });
        });
    }

    async loadData() {
        const loadingIndicator = document.getElementById('loading-indicator');
        loadingIndicator.style.display = 'flex';

        try {
            this.staleItems = [];

            // Fetch stale items from all configured repositories
            for (const repo of DASHBOARD_CONFIG.repositories) {
                await this.fetchStaleItems(repo.org, repo.repo);
            }

            this.updateStats();
            this.populateRepoFilter();
            this.applyFilters();
            this.updateLastUpdated();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please check your GitHub token and try again.');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    async fetchStaleItems(org, repo) {
        const baseUrl = 'https://api.github.com';
        const headers = {};

        // Add token if configured
        if (DASHBOARD_CONFIG.githubToken) {
            headers['Authorization'] = `token ${DASHBOARD_CONFIG.githubToken}`;
        }

        try {
            // Fetch issues with 'stale' label
            const issuesResponse = await fetch(
                `${baseUrl}/repos/${org}/${repo}/issues?labels=stale&state=open&per_page=100`,
                { headers }
            );

            if (!issuesResponse.ok) {
                console.error(`Failed to fetch issues for ${org}/${repo}:`, issuesResponse.status);
                return;
            }

            const issues = await issuesResponse.json();

            // Process issues (GitHub API returns both issues and PRs in /issues endpoint)
            issues.forEach(item => {
                this.staleItems.push({
                    type: item.pull_request ? 'pr' : 'issue',
                    repo: `${org}/${repo}`,
                    org: org,
                    repoName: repo,
                    title: item.title,
                    number: item.number,
                    author: item.user.login,
                    updated: new Date(item.updated_at),
                    labels: item.labels.map(l => l.name),
                    url: item.html_url,
                    state: item.state
                });
            });
        } catch (error) {
            console.error(`Error fetching data for ${org}/${repo}:`, error);
        }
    }

    updateStats() {
        const totalStale = this.staleItems.length;
        const totalIssues = this.staleItems.filter(item => item.type === 'issue').length;
        const totalPRs = this.staleItems.filter(item => item.type === 'pr').length;
        const totalRepos = new Set(this.staleItems.map(item => item.repo)).size;

        document.getElementById('total-stale').textContent = totalStale;
        document.getElementById('total-issues').textContent = totalIssues;
        document.getElementById('total-prs').textContent = totalPRs;
        document.getElementById('total-repos').textContent = totalRepos;
    }

    populateRepoFilter() {
        const repoFilter = document.getElementById('repo-filter');
        const repos = [...new Set(this.staleItems.map(item => item.repo))].sort();

        // Keep "All Repositories" option
        repoFilter.innerHTML = '<option value="">All Repositories</option>';

        repos.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo;
            option.textContent = repo;
            repoFilter.appendChild(option);
        });
    }

    applyFilters() {
        const repoFilter = document.getElementById('repo-filter').value;
        const typeFilter = document.getElementById('type-filter').value;
        const searchFilter = document.getElementById('search-filter').value.toLowerCase();

        this.filteredItems = this.staleItems.filter(item => {
            if (repoFilter && item.repo !== repoFilter) return false;
            if (typeFilter && item.type !== typeFilter) return false;
            if (searchFilter && !item.title.toLowerCase().includes(searchFilter)) return false;
            return true;
        });

        this.renderTable();
    }

    clearFilters() {
        document.getElementById('repo-filter').value = '';
        document.getElementById('type-filter').value = '';
        document.getElementById('search-filter').value = '';
        this.applyFilters();
    }

    sortBy(field) {
        if (this.currentSort.field === field) {
            this.currentSort.ascending = !this.currentSort.ascending;
        } else {
            this.currentSort.field = field;
            this.currentSort.ascending = false;
        }

        this.filteredItems.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            // Handle different data types
            if (field === 'updated') {
                aVal = aVal.getTime();
                bVal = bVal.getTime();
            } else if (field === 'number') {
                aVal = parseInt(aVal);
                bVal = parseInt(bVal);
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.currentSort.ascending ? -1 : 1;
            if (aVal > bVal) return this.currentSort.ascending ? 1 : -1;
            return 0;
        });

        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('table-body');

        if (this.filteredItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No stale items found</td></tr>';
            return;
        }

        tbody.innerHTML = this.filteredItems.map(item => `
            <tr>
                <td>
                    <span class="badge ${item.type === 'issue' ? 'badge-issue' : 'badge-pr'}">
                        ${item.type === 'issue' ? 'Issue' : 'PR'}
                    </span>
                </td>
                <td>${item.repo}</td>
                <td>
                    <a href="${item.url}" target="_blank" title="${item.title}">
                        ${this.truncate(item.title, 60)}
                    </a>
                </td>
                <td>#${item.number}</td>
                <td>${item.author}</td>
                <td>${this.formatDate(item.updated)}</td>
                <td>
                    ${item.labels.map(label =>
                        `<span class="label-badge ${label === 'stale' ? 'stale' : ''}">${label}</span>`
                    ).join(' ')}
                </td>
                <td>
                    <a href="${item.url}" target="_blank" class="view-link">View</a>
                </td>
            </tr>
        `).join('');
    }

    formatDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    }

    truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '...';
    }

    updateLastUpdated() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('last-updated').textContent = `Last updated: ${timeStr}`;
    }

    showError(message) {
        const tbody = document.getElementById('table-body');
        tbody.innerHTML = `<tr><td colspan="8" class="no-data" style="color: var(--accent-red);">${message}</td></tr>`;
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new StaleDashboard();
});
