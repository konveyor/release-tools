// Community Health Dashboard App
class CommunityHealthDashboard {
    constructor() {
        this.repoHealthData = [];
        this.recentActivity = [];
        this.historicalData = [];
        this.currentSort = { field: 'repo', ascending: true };
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.charts = {
            contributors: null,
            activity: null,
            responseTime: null,
            mergeRate: null
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.loadHistoricalData();
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadData();
        });

        // Activity filter
        document.getElementById('activity-filter').addEventListener('change', () => {
            this.filterActivity();
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                this.sortBy(field);
            });
        });

        // Trend period selector
        const trendPeriod = document.getElementById('trend-period');
        if (trendPeriod) {
            trendPeriod.addEventListener('change', () => {
                this.updateCharts();
            });
        }
    }

    async loadData() {
        const loadingIndicator = document.getElementById('loading-indicator');
        loadingIndicator.style.display = 'flex';

        try {
            this.repoHealthData = [];
            this.recentActivity = [];

            // Fetch data from all configured repositories
            const promises = DASHBOARD_CONFIG.repositories.map(repo =>
                this.fetchRepoHealth(repo.org, repo.repo)
            );

            await Promise.all(promises);

            this.updateStats();
            this.populateActivityFilter();
            this.renderTable();
            this.renderRecentActivity();
            this.updateLastUpdated();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please check your GitHub token and try again.');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    async fetchRepoHealth(org, repo) {
        const baseUrl = 'https://api.github.com';
        const headers = {};

        // Add token if configured
        if (DASHBOARD_CONFIG.githubToken) {
            headers['Authorization'] = `Bearer ${DASHBOARD_CONFIG.githubToken}`;
        }

        try {
            const repoFullName = `${org}/${repo}`;
            const now = new Date();
            const contributorsPeriod = new Date(now - DASHBOARD_CONFIG.periods.contributors * 24 * 60 * 60 * 1000);
            const newContribPeriod = new Date(now - DASHBOARD_CONFIG.periods.newContributors * 24 * 60 * 60 * 1000);
            const responseTimePeriod = new Date(now - DASHBOARD_CONFIG.periods.responseTime * 24 * 60 * 60 * 1000);
            const activityPeriod = new Date(now - DASHBOARD_CONFIG.periods.recentActivity * 24 * 60 * 60 * 1000);

            // Fetch recent commits to get contributors
            const commitsResponse = await fetch(
                `${baseUrl}/repos/${org}/${repo}/commits?since=${contributorsPeriod.toISOString()}&per_page=100`,
                { headers }
            );

            let contributors = new Set();
            let newContributors = new Set();
            let allContributors = new Set();

            if (commitsResponse.ok) {
                const commits = await commitsResponse.json();
                commits.forEach(commit => {
                    if (commit.author && commit.author.login) {
                        contributors.add(commit.author.login);
                        allContributors.add(commit.author.login);

                        const commitDate = new Date(commit.commit.author.date);
                        if (commitDate >= newContribPeriod) {
                            newContributors.add(commit.author.login);
                        }
                    }
                });
            }

            // For new contributors, we need to check if they contributed before the period
            // This is a simplified version - a more accurate version would check all commit history
            const actualNewContributors = newContributors.size;

            // Fetch recent issues for response time calculation
            const issuesResponse = await fetch(
                `${baseUrl}/repos/${org}/${repo}/issues?state=all&since=${responseTimePeriod.toISOString()}&per_page=100`,
                { headers }
            );

            let avgIssueResponseMs = 0;
            let avgPRResponseMs = 0;
            let issueCount = 0;
            let prCount = 0;
            let openIssues = 0;
            let openPRs = 0;

            if (issuesResponse.ok) {
                const issues = await issuesResponse.json();

                for (const issue of issues) {
                    if (issue.pull_request) {
                        // It's a PR
                        if (issue.state === 'open') openPRs++;

                        // Get PR details for response time
                        const firstComment = await this.getFirstComment(org, repo, issue.number, headers);
                        if (firstComment) {
                            const createdAt = new Date(issue.created_at);
                            const firstResponseAt = new Date(firstComment.created_at);
                            avgPRResponseMs += (firstResponseAt - createdAt);
                            prCount++;
                        }
                    } else {
                        // It's an issue
                        if (issue.state === 'open') openIssues++;

                        const firstComment = await this.getFirstComment(org, repo, issue.number, headers);
                        if (firstComment) {
                            const createdAt = new Date(issue.created_at);
                            const firstResponseAt = new Date(firstComment.created_at);
                            avgIssueResponseMs += (firstResponseAt - createdAt);
                            issueCount++;
                        }
                    }
                }
            }

            // Calculate averages
            const avgIssueResponse = issueCount > 0 ? avgIssueResponseMs / issueCount : 0;
            const avgPRResponse = prCount > 0 ? avgPRResponseMs / prCount : 0;

            // Fetch PR merge rate
            const prsResponse = await fetch(
                `${baseUrl}/repos/${org}/${repo}/pulls?state=all&per_page=100`,
                { headers }
            );

            let totalPRs = 0;
            let mergedPRs = 0;

            if (prsResponse.ok) {
                const prs = await prsResponse.json();
                const recentPRs = prs.filter(pr => {
                    const createdAt = new Date(pr.created_at);
                    return createdAt >= responseTimePeriod;
                });

                totalPRs = recentPRs.length;
                mergedPRs = recentPRs.filter(pr => pr.merged_at !== null).length;
            }

            const prMergeRate = totalPRs > 0 ? (mergedPRs / totalPRs) * 100 : 0;

            // Store repo health data
            this.repoHealthData.push({
                org,
                repo,
                repoFullName,
                contributors: contributors.size,
                newContributors: actualNewContributors,
                avgIssueResponse,
                avgPRResponse,
                prMergeRate,
                openIssues,
                openPRs
            });

            // Fetch recent activity (issues and PRs)
            const recentIssuesResponse = await fetch(
                `${baseUrl}/repos/${org}/${repo}/issues?state=all&since=${activityPeriod.toISOString()}&per_page=20`,
                { headers }
            );

            if (recentIssuesResponse.ok) {
                const recentIssues = await recentIssuesResponse.json();
                recentIssues.forEach(issue => {
                    this.recentActivity.push({
                        type: issue.pull_request ? 'pr' : 'issue',
                        repo: repoFullName,
                        repoName: repo,
                        title: issue.title,
                        number: issue.number,
                        author: issue.user.login,
                        created: new Date(issue.created_at),
                        updated: new Date(issue.updated_at),
                        state: issue.state,
                        url: issue.html_url
                    });
                });
            }

        } catch (error) {
            console.error(`Error fetching data for ${org}/${repo}:`, error);
        }
    }

    async getFirstComment(org, repo, issueNumber, headers) {
        try {
            const response = await fetch(
                `https://api.github.com/repos/${org}/${repo}/issues/${issueNumber}/comments?per_page=1`,
                { headers }
            );

            if (response.ok) {
                const comments = await response.json();
                return comments.length > 0 ? comments[0] : null;
            }
        } catch (error) {
            console.error(`Error fetching comments for issue #${issueNumber}:`, error);
        }
        return null;
    }

    updateStats() {
        // Calculate overall stats
        const totalContributors = this.repoHealthData.reduce((sum, repo) =>
            sum + repo.contributors, 0
        );

        const totalNewContributors = this.repoHealthData.reduce((sum, repo) =>
            sum + repo.newContributors, 0
        );

        // Calculate weighted average response time
        let totalIssueResponseMs = 0;
        let totalPRResponseMs = 0;
        let issueRepoCount = 0;
        let prRepoCount = 0;

        this.repoHealthData.forEach(repo => {
            if (repo.avgIssueResponse > 0) {
                totalIssueResponseMs += repo.avgIssueResponse;
                issueRepoCount++;
            }
            if (repo.avgPRResponse > 0) {
                totalPRResponseMs += repo.avgPRResponse;
                prRepoCount++;
            }
        });

        const avgIssueResponse = issueRepoCount > 0 ? totalIssueResponseMs / issueRepoCount : 0;
        const avgPRResponse = prRepoCount > 0 ? totalPRResponseMs / prRepoCount : 0;
        const avgResponseTime = (avgIssueResponse + avgPRResponse) / 2;

        // Calculate average PR merge rate
        const avgPRMergeRate = this.repoHealthData.reduce((sum, repo) =>
            sum + repo.prMergeRate, 0
        ) / this.repoHealthData.length;

        // Update UI
        document.getElementById('total-contributors').textContent = totalContributors;
        document.getElementById('new-contributors').textContent = totalNewContributors;
        document.getElementById('avg-response-time').textContent =
            this.formatDuration(avgResponseTime);
        document.getElementById('pr-merge-rate').textContent =
            `${avgPRMergeRate.toFixed(1)}%`;
    }

    populateActivityFilter() {
        const activityFilter = document.getElementById('activity-filter');
        const repos = [...new Set(this.repoHealthData.map(item => item.repo))].sort();

        // Keep "All Repositories" option
        activityFilter.innerHTML = '<option value="all">All Repositories</option>';

        repos.forEach(repo => {
            const option = document.createElement('option');
            option.value = repo;
            option.textContent = repo;
            activityFilter.appendChild(option);
        });
    }

    filterActivity() {
        const filter = document.getElementById('activity-filter').value;
        this.renderRecentActivity(filter);
    }

    sortBy(field) {
        if (this.currentSort.field === field) {
            this.currentSort.ascending = !this.currentSort.ascending;
        } else {
            this.currentSort.field = field;
            this.currentSort.ascending = true;
        }

        this.repoHealthData.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            // Handle different data types
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.currentSort.ascending ? -1 : 1;
            if (aVal > bVal) return this.currentSort.ascending ? 1 : -1;
            return 0;
        });

        this.currentPage = 1;
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('table-body');

        if (this.repoHealthData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="no-data">No repository health data available</td></tr>';
            return;
        }

        tbody.innerHTML = this.repoHealthData.map(repo => `
            <tr>
                <td><a href="https://github.com/${repo.repoFullName}" target="_blank">${repo.repo}</a></td>
                <td>${repo.contributors}</td>
                <td>${repo.newContributors}</td>
                <td>${this.formatDuration(repo.avgIssueResponse)}</td>
                <td>${this.formatDuration(repo.avgPRResponse)}</td>
                <td>
                    <span class="badge ${repo.prMergeRate >= 70 ? 'badge-issue' : 'badge-pr'}">
                        ${repo.prMergeRate.toFixed(1)}%
                    </span>
                </td>
                <td>${repo.openIssues}</td>
                <td>${repo.openPRs}</td>
            </tr>
        `).join('');
    }

    renderRecentActivity(filterRepo = 'all') {
        const tbody = document.getElementById('activity-body');

        let activities = this.recentActivity;
        if (filterRepo !== 'all') {
            activities = activities.filter(a => a.repoName === filterRepo);
        }

        // Sort by created date (most recent first)
        activities.sort((a, b) => b.created - a.created);

        // Limit to 50 most recent
        activities = activities.slice(0, 50);

        if (activities.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No recent activity found</td></tr>';
            return;
        }

        tbody.innerHTML = activities.map(activity => `
            <tr>
                <td>
                    <span class="badge ${activity.type === 'issue' ? 'badge-issue' : 'badge-pr'}">
                        ${activity.type === 'issue' ? 'Issue' : 'PR'}
                    </span>
                </td>
                <td>${activity.repoName}</td>
                <td>
                    <a href="${activity.url}" target="_blank" title="${activity.title}">
                        ${this.truncate(activity.title, 60)}
                    </a>
                </td>
                <td>${activity.author}</td>
                <td>${this.formatDate(activity.created)}</td>
                <td>
                    <span class="badge ${activity.state === 'open' ? 'badge-pr' : 'badge-issue'}">
                        ${activity.state}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    formatDuration(milliseconds) {
        if (milliseconds === 0 || !milliseconds) return 'N/A';

        const hours = Math.floor(milliseconds / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h`;
        } else {
            const minutes = Math.floor(milliseconds / (1000 * 60));
            return `${minutes}m`;
        }
    }

    formatDate(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return date.toLocaleDateString();
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

        this.renderContributorsChart(data);
        this.renderActivityChart(data);
        this.renderResponseTimeChart(data);
        this.renderMergeRateChart(data);
    }

    renderContributorsChart(data) {
        const ctx = document.getElementById('contributors-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.contributors) {
            this.charts.contributors.destroy();
        }

        const dates = data.map(d => d.date);
        const totalContributors = data.map(d => d.metrics?.totalContributors || 0);
        const newContributors = data.map(d => d.metrics?.newContributors || 0);

        this.charts.contributors = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Total Contributors',
                        data: totalContributors,
                        borderColor: '#33b5e5',
                        backgroundColor: 'rgba(51, 181, 229, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'New Contributors',
                        data: newContributors,
                        borderColor: '#73bf69',
                        backgroundColor: 'rgba(115, 191, 105, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: this.getChartOptions('Contributor Trends')
        });
    }

    renderActivityChart(data) {
        const ctx = document.getElementById('activity-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.activity) {
            this.charts.activity.destroy();
        }

        const dates = data.map(d => d.date);
        const issues = data.map(d => d.metrics?.openIssues || 0);
        const prs = data.map(d => d.metrics?.openPRs || 0);

        this.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Open Issues',
                        data: issues,
                        borderColor: '#ff9830',
                        backgroundColor: 'rgba(255, 152, 48, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Open PRs',
                        data: prs,
                        borderColor: '#a77ddc',
                        backgroundColor: 'rgba(167, 125, 220, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: this.getChartOptions('Activity Trends')
        });
    }

    renderResponseTimeChart(data) {
        const ctx = document.getElementById('response-time-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.responseTime) {
            this.charts.responseTime.destroy();
        }

        const dates = data.map(d => d.date);
        const avgResponseTime = data.map(d => {
            const rt = d.metrics?.avgResponseTime || 0;
            // Convert milliseconds to hours
            return rt / (1000 * 60 * 60);
        });

        this.charts.responseTime = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Avg Response Time (hours)',
                        data: avgResponseTime,
                        borderColor: '#33b5e5',
                        backgroundColor: 'rgba(51, 181, 229, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: this.getChartOptions('Response Time Trends')
        });
    }

    renderMergeRateChart(data) {
        const ctx = document.getElementById('merge-rate-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.mergeRate) {
            this.charts.mergeRate.destroy();
        }

        const dates = data.map(d => d.date);
        const mergeRate = data.map(d => d.metrics?.prMergeRate || 0);

        this.charts.mergeRate = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'PR Merge Rate (%)',
                        data: mergeRate,
                        borderColor: '#73bf69',
                        backgroundColor: 'rgba(115, 191, 105, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: this.getChartOptions('PR Merge Rate Trends')
        });
    }

    getChartOptions(title) {
        return {
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
                    text: title,
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
        };
    }
}

// Dashboard is initialized in index.html to make it globally accessible
