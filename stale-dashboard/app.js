// Stale Issues Dashboard App
class StaleDashboard {
    constructor() {
        this.staleItems = [];
        this.filteredItems = [];
        this.historicalData = [];
        this.currentSort = { field: 'updated', ascending: false };
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.hasWriteAccess = false; // Track if user has repo scope
        this.charts = {
            trends: null,
            breakdown: null
        };
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.checkTokenPermissions();
        this.loadData();
        this.loadHistoricalData();
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

        // Trend period selector
        document.getElementById('trend-period').addEventListener('change', () => {
            this.updateCharts();
        });
    }

    async checkTokenPermissions() {
        const token = DASHBOARD_CONFIG.githubToken;

        if (!token) {
            this.hasWriteAccess = false;
            return;
        }

        try {
            // Check token scopes by making a test request to the user endpoint
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) {
                console.warn('Failed to check token permissions:', response.status);
                this.hasWriteAccess = false;
                return;
            }

            // Check the OAuth scopes header
            const scopesHeader = response.headers.get('X-OAuth-Scopes');
            if (scopesHeader) {
                const scopeList = scopesHeader.split(',').map(s => s.trim());
                this.hasWriteAccess = scopeList.some(scope =>
                    scope === 'repo' ||
                    scope === 'public_repo' ||
                    scope === 'write:issues' ||
                    scope === 'issues:write'
                );

                if (this.hasWriteAccess) {
                    console.log('✓ GitHub token appears to have write access for issues/PRs.');
                } else {
                    console.log('✗ GitHub token does not have write access. Close buttons will be disabled.');
                    console.log('  Current scopes:', scopesHeader);
                    console.log('  Ensure your token includes repository write permissions (e.g., repo/public_repo or issues:write).');
                }
            } else {
                // Fine-grained tokens don't expose scopes; let the close call surface a 403 if the token is read-only.
                this.hasWriteAccess = true;
                console.log('⚠️ Unable to read token scopes; assuming write access. Closing requests will fail with 403 if the token is read-only.');
            }
        } catch (error) {
            console.error('Error checking token permissions:', error);
            this.hasWriteAccess = false;
        }
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
            headers['Authorization'] = `Bearer ${DASHBOARD_CONFIG.githubToken}`;
        }

        let page = 1;
        let hasMore = true;

        try {
            // Fetch issues with 'stale' label using pagination
            while (hasMore) {
                const issuesResponse = await fetch(
                    `${baseUrl}/repos/${org}/${repo}/issues?labels=stale&state=open&per_page=100&page=${page}`,
                    { headers }
                );

                if (!issuesResponse.ok) {
                    console.error(`Failed to fetch issues for ${org}/${repo}:`, issuesResponse.status);
                    break;
                }

                const issues = await issuesResponse.json();

                if (issues.length === 0) {
                    hasMore = false;
                } else {
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
                    page++;
                }
            }
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
            // Display just the repo name without org prefix
            option.textContent = repo.split('/')[1] || repo;
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

        this.currentPage = 1; // Reset to first page when filters change
        this.renderTable();
        this.renderPagination();
    }

    clearFilters() {
        document.getElementById('repo-filter').value = '';
        document.getElementById('type-filter').value = '';
        document.getElementById('search-filter').value = '';
        this.currentPage = 1;
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

        this.currentPage = 1; // Reset to first page when sorting
        this.renderTable();
        this.renderPagination();
    }

    renderTable() {
        const tbody = document.getElementById('table-body');

        if (this.filteredItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No stale items found</td></tr>';
            return;
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const itemsToShow = this.filteredItems.slice(startIndex, endIndex);

        tbody.innerHTML = itemsToShow.map(item => `
            <tr>
                <td>
                    <span class="badge ${item.type === 'issue' ? 'badge-issue' : 'badge-pr'}">
                        ${item.type === 'issue' ? 'Issue' : 'PR'}
                    </span>
                </td>
                <td>${item.repoName}</td>
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
                    <button class="btn-close"
                            ${!this.hasWriteAccess ? 'disabled' : ''}
                            ${!this.hasWriteAccess ? 'title="Requires GitHub token with \'repo\' scope. See README for instructions."' : ''}
                            data-org="${item.org}"
                            data-repo="${item.repoName}"
                            data-number="${item.number}"
                            data-type="${item.type}"
                            data-title="${encodeURIComponent(item.title)}">Close</button>
                </td>
            </tr>
        `).join('');

        // Attach event listeners to close buttons
        tbody.querySelectorAll('.btn-close:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const { org, repo, number, type, title: encodedTitle } = btn.dataset;
                const title = decodeURIComponent(encodedTitle);
                this.closeStaleItem(org, repo, parseInt(number), type, title);
            });
        });
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        const paginationContainer = document.getElementById('pagination');

        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';

        const startItem = this.filteredItems.length === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.filteredItems.length);

        let paginationHTML = `
            <div class="pagination-info">
                Showing ${startItem}-${endItem} of ${this.filteredItems.length}
            </div>
            <div class="pagination-controls">
        `;

        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''}
                    onclick="dashboard.goToPage(${this.currentPage - 1})">
                Previous
            </button>
        `;

        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage < maxVisiblePages - 1) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="dashboard.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}"
                        onclick="dashboard.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span class="pagination-ellipsis">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" onclick="dashboard.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === totalPages ? 'disabled' : ''}
                    onclick="dashboard.goToPage(${this.currentPage + 1})">
                Next
            </button>
        `;

        paginationHTML += `</div>`;
        paginationContainer.innerHTML = paginationHTML;
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredItems.length / this.itemsPerPage);
        if (page < 1 || page > totalPages) return;

        this.currentPage = page;
        this.renderTable();
        this.renderPagination();

        // Scroll to top of table
        document.querySelector('.table-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    async loadHistoricalData() {
        try {
            // Load index of available historical data files
            const indexResponse = await fetch('data/history/index.json');
            if (!indexResponse.ok) {
                console.log('Historical data index not available');
                return;
            }

            const index = await indexResponse.json();
            const historyData = await Promise.all(
                index.available_dates.map(async (dateStr) => {
                    try {
                        const response = await fetch(`data/history/${dateStr}.json`);
                        if (response.ok) {
                            return await response.json();
                        }
                    } catch (err) {
                        console.error(`Failed to load ${dateStr}:`, err);
                    }
                    return null;
                })
            );

            const validData = historyData.filter(d => d !== null);

            if (validData.length > 0) {
                this.historicalData = validData.sort((a, b) =>
                    new Date(a.date) - new Date(b.date)
                );
                document.getElementById('trends-panel').style.display = 'block';
                this.updateCharts();
            }
        } catch (error) {
            console.log('Historical data not available yet:', error.message);
        }
    }

    updateCharts() {
        if (this.historicalData.length === 0) return;

        const period = document.getElementById('trend-period').value;
        let data = this.historicalData;

        // Filter by period
        if (period !== 'all') {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));
            data = this.historicalData.filter(d => new Date(d.date) >= cutoffDate);
        }

        this.renderTrendsChart(data);
        this.renderBreakdownChart(data);
    }

    renderTrendsChart(data) {
        const ctx = document.getElementById('stale-trends-chart');

        // Destroy existing chart
        if (this.charts.trends) {
            this.charts.trends.destroy();
        }

        const dates = data.map(d => d.date);
        const totalStale = data.map(d => d.totals?.totalStale || 0);
        const staleIssues = data.map(d => d.totals?.staleIssues || 0);
        const stalePRs = data.map(d => d.totals?.stalePRs || 0);

        this.charts.trends = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Total Stale Items',
                        data: totalStale,
                        borderColor: '#33b5e5',
                        backgroundColor: 'rgba(51, 181, 229, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Stale Issues',
                        data: staleIssues,
                        borderColor: '#73bf69',
                        backgroundColor: 'rgba(115, 191, 105, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Stale PRs',
                        data: stalePRs,
                        borderColor: '#ff9830',
                        backgroundColor: 'rgba(255, 152, 48, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#d8d9da',
                            font: { size: 12 }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Stale Items Over Time',
                        color: '#d8d9da',
                        font: { size: 14, weight: 'normal' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9fa3a7', maxTicksLimit: 10 },
                        grid: { color: '#2d3138' }
                    },
                    y: {
                        ticks: { color: '#9fa3a7' },
                        grid: { color: '#2d3138' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    renderBreakdownChart(data) {
        const ctx = document.getElementById('repo-breakdown-chart');

        // Destroy existing chart
        if (this.charts.breakdown) {
            this.charts.breakdown.destroy();
        }

        // Get latest data point
        const latest = data[data.length - 1];
        if (!latest || !latest.repositories) return;

        const repos = latest.repositories
            .filter(r => r.totalStale > 0)
            .sort((a, b) => b.totalStale - a.totalStale)
            .slice(0, 10); // Top 10 repos

        // Display just repo names without org prefix
        const labels = repos.map(r => r.repo.split('/')[1] || r.repo);
        const staleData = repos.map(r => r.totalStale);
        const colors = [
            '#33b5e5', '#73bf69', '#ff9830', '#e02f44', '#a77ddc',
            '#5bc0de', '#f0ad4e', '#d9534f', '#5cb85c', '#337ab7'
        ];

        this.charts.breakdown = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Stale Items',
                    data: staleData,
                    backgroundColor: colors.slice(0, repos.length),
                    borderColor: colors.slice(0, repos.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Stale Items by Repository (Current)',
                        color: '#d8d9da',
                        font: { size: 14, weight: 'normal' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9fa3a7' },
                        grid: { color: '#2d3138' }
                    },
                    y: {
                        ticks: { color: '#9fa3a7' },
                        grid: { color: '#2d3138' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    async closeStaleItem(org, repo, number, type, title) {
        // Show confirmation dialog
        const itemType = type === 'issue' ? 'issue' : 'pull request';
        const confirmed = confirm(
            `Are you sure you want to close this stale ${itemType}?\n\n` +
            `Repository: ${org}/${repo}\n` +
            `${type === 'issue' ? 'Issue' : 'PR'} #${number}: ${title}\n\n` +
            `This will post a closing message and close the ${itemType}.`
        );

        if (!confirmed) {
            return;
        }

        const loadingIndicator = document.getElementById('loading-indicator');
        loadingIndicator.style.display = 'flex';

        try {
            const token = DASHBOARD_CONFIG.githubToken;

            if (!token) {
                alert('GitHub token is required to close items. Please set your token using setGitHubToken() in the browser console.');
                loadingIndicator.style.display = 'none';
                return;
            }

            const baseUrl = 'https://api.github.com';
            const headers = {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            };

            // Note: If closing fails after posting the comment, the comment will remain.
            // This is intentional to provide visibility. Users can manually close the item
            // from GitHub without re-posting the comment.

            // Post closing comment
            const commentUrl = `${baseUrl}/repos/${org}/${repo}/issues/${number}/comments`;
            const commentResponse = await fetch(commentUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    body: DASHBOARD_CONFIG.staleCloseMessage
                })
            });

            if (!commentResponse.ok) {
                throw new Error(`Failed to post comment: ${commentResponse.status} ${commentResponse.statusText}`);
            }

            // Close the issue/PR
            const closeUrl = `${baseUrl}/repos/${org}/${repo}/issues/${number}`;
            const closeResponse = await fetch(closeUrl, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({
                    state: 'closed'
                })
            });

            if (!closeResponse.ok) {
                const errorMsg = `Failed to close ${itemType}: ${closeResponse.status} ${closeResponse.statusText}`;
                // Comment was posted but close failed - inform user about partial state
                alert(`Warning: Closing comment was posted, but closing the ${itemType} failed.\n\n${errorMsg}\n\nYou can manually close it from GitHub without re-posting the comment.`);
                throw new Error(errorMsg);
            }

            // Success! Reload the dashboard to reflect changes
            alert(`Successfully closed ${itemType} #${number}`);
            this.loadData();
        } catch (error) {
            console.error('Error closing stale item:', error);
            alert(`Failed to close ${itemType}: ${error.message}`);
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Dashboard is initialized in index.html to make it globally accessible
