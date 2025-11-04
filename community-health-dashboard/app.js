// Community Health Dashboard App
class CommunityHealthDashboard {
    constructor() {
        this.repoHealthData = [];
        this.prHealthData = [];
        this.issueHealthData = [];
        this.maintainerHealthData = [];
        this.recentActivity = [];
        this.historicalData = [];
        this.currentSort = { field: 'repo', ascending: true };
        this.prCurrentSort = { field: 'repo', ascending: true };
        this.issueCurrentSort = { field: 'repo', ascending: true };
        this.maintainerCurrentSort = { field: 'responseCount', ascending: false };
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.charts = {
            contributors: null,
            activity: null,
            responseTime: null,
            mergeRate: null,
            prSize: null,
            reviewTimeTrend: null,
            mergeTimeTrend: null,
            issueAge: null,
            responseDistribution: null,
            closureRateTrend: null,
            responseTimeTrend: null,
            maintainerConcentration: null,
            busFactor: null,
            maintainerCountTrend: null,
            maintainerResponseTrend: null
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadData();
        this.loadHistoricalData();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadData();
            this.loadPRHealthData();
        });

        // Activity filter
        document.getElementById('activity-filter').addEventListener('change', () => {
            this.filterActivity();
        });

        // Table sorting
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                const table = th.closest('table');
                if (table.id === 'pr-metrics-table') {
                    this.sortPRMetrics(field);
                } else if (table.id === 'issue-metrics-table') {
                    this.sortIssueMetrics(field);
                } else if (table.id === 'maintainer-metrics-table') {
                    this.sortMaintainerMetrics(field);
                } else {
                    this.sortBy(field);
                }
            });
        });

        // Trend period selector
        const trendPeriod = document.getElementById('trend-period');
        if (trendPeriod) {
            trendPeriod.addEventListener('change', () => {
                this.updateCharts();
            });
        }

        // PR Trend period selector
        const prTrendPeriod = document.getElementById('pr-trend-period');
        if (prTrendPeriod) {
            prTrendPeriod.addEventListener('change', () => {
                this.updatePRTrendCharts();
            });
        }

        // Issue Trend period selector
        const issueTrendPeriod = document.getElementById('issue-trend-period');
        if (issueTrendPeriod) {
            issueTrendPeriod.addEventListener('change', () => {
                this.updateIssueTrendCharts();
            });
        }

        // Maintainer Trend period selector
        const maintainerTrendPeriod = document.getElementById('maintainer-trend-period');
        if (maintainerTrendPeriod) {
            maintainerTrendPeriod.addEventListener('change', () => {
                this.updateMaintainerTrendCharts();
            });
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Load data for tabs if needed
        if (tabName === 'pr-health' && this.prHealthData.length === 0) {
            this.loadPRHealthData();
        } else if (tabName === 'issue-health' && this.issueHealthData.length === 0) {
            this.loadIssueHealthData();
        } else if (tabName === 'maintainer-health' && this.maintainerHealthData.length === 0) {
            this.loadMaintainerHealthData();
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
            this.renderActivityHeatmap();
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

    renderActivityHeatmap() {
        const container = document.getElementById('activity-heatmap');
        if (!container) return;

        const activityData = this.generateMockActivityData();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        let html = '';

        // Add hour headers
        html += '<div class="heatmap-label"></div>'; // Empty corner cell
        for (let hour = 0; hour < 24; hour++) {
            html += `<div class="heatmap-hour">${hour}</div>`;
        }

        // Add rows for each day
        days.forEach((day, dayIndex) => {
            html += `<div class="heatmap-label">${day}</div>`;

            for (let hour = 0; hour < 24; hour++) {
                const activity = activityData[dayIndex][hour];
                const level = this.getActivityLevel(activity);
                const tooltip = `${day} ${hour}:00 - ${activity} events`;

                html += `<div class="heatmap-cell heatmap-${level}" data-tooltip="${tooltip}"></div>`;
            }
        });

        container.innerHTML = html;
    }

    generateMockActivityData() {
        // Generate realistic activity patterns: higher during weekdays and business hours
        const data = [];

        for (let day = 0; day < 7; day++) {
            const dayData = [];
            const isWeekend = day === 0 || day === 6; // Sunday or Saturday

            for (let hour = 0; hour < 24; hour++) {
                let baseActivity;

                // Business hours (9-17) have more activity
                if (hour >= 9 && hour <= 17) {
                    baseActivity = isWeekend ? 5 : 15;
                } else if (hour >= 6 && hour <= 22) {
                    // Extended hours still have some activity
                    baseActivity = isWeekend ? 3 : 8;
                } else {
                    // Night hours have minimal activity
                    baseActivity = isWeekend ? 1 : 3;
                }

                // Add some randomness
                const randomVariation = Math.random() * 5;
                const activity = Math.floor(baseActivity + randomVariation);

                dayData.push(activity);
            }

            data.push(dayData);
        }

        return data;
    }

    getActivityLevel(activity) {
        // Map activity count to color levels (0-3)
        if (activity <= 3) return 0;
        if (activity <= 8) return 1;
        if (activity <= 15) return 2;
        return 3;
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

    // PR Health Methods
    async loadPRHealthData() {
        const loadingIndicator = document.getElementById('pr-loading-indicator');
        loadingIndicator.style.display = 'flex';

        try {
            this.prHealthData = [];

            // Use mock data for testing (comment out to use real API)
            const useMockData = true;

            if (useMockData) {
                // Generate mock PR health data
                this.generateMockPRHealthData();
            } else {
                // Fetch PR metrics from all configured repositories
                const promises = DASHBOARD_CONFIG.repositories.map(repo =>
                    this.fetchPRHealth(repo.org, repo.repo)
                );
                await Promise.all(promises);
            }

            this.updatePRStats();
            this.renderPRMetricsTable();
            this.renderPRSizeChart();
            this.updatePRTrendCharts();
        } catch (error) {
            console.error('Error loading PR health data:', error);
            this.showPRError('Failed to load PR health data. Please try again.');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    generateMockPRHealthData() {
        // Generate realistic mock PR health data for testing
        const repos = DASHBOARD_CONFIG.repositories;

        repos.forEach(repo => {
            const avgReviewTime = Math.random() * 28800000 + 3600000; // 1-9 hours
            const avgMergeTime = Math.random() * 172800000 + 43200000; // 12-60 hours
            const avgRevisions = Math.random() * 3 + 2; // 2-5 revisions
            const mergeRate = Math.random() * 30 + 60; // 60-90%
            const totalPRs = Math.floor(Math.random() * 30 + 10); // 10-40 PRs
            const openPRs = Math.floor(Math.random() * 15 + 3); // 3-18 open PRs

            // Generate PR size distribution
            const prSizes = {
                xs: Math.floor(Math.random() * 5 + 2),
                s: Math.floor(Math.random() * 6 + 4),
                m: Math.floor(Math.random() * 5 + 3),
                l: Math.floor(Math.random() * 3 + 1),
                xl: Math.floor(Math.random() * 2)
            };

            this.prHealthData.push({
                org: repo.org,
                repo: repo.repo,
                repoFullName: `${repo.org}/${repo.repo}`,
                avgReviewTime,
                avgMergeTime,
                avgRevisions,
                mergeRate,
                totalPRs,
                openPRs,
                prSizes
            });
        });

        console.log('Generated mock PR health data for', this.prHealthData.length, 'repositories');
    }

    async fetchPRHealth(org, repo) {
        const baseUrl = 'https://api.github.com';
        const headers = {};

        if (DASHBOARD_CONFIG.githubToken) {
            headers['Authorization'] = `Bearer ${DASHBOARD_CONFIG.githubToken}`;
        }

        try {
            const repoFullName = `${org}/${repo}`;
            const now = new Date();
            const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

            // Fetch recent PRs
            const prsResponse = await fetch(
                `${baseUrl}/repos/${org}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`,
                { headers }
            );

            if (!prsResponse.ok) {
                console.error(`Failed to fetch PRs for ${org}/${repo}`);
                return;
            }

            const allPRs = await prsResponse.json();

            // Filter to PRs from last 30 days
            const recentPRs = allPRs.filter(pr => {
                const createdAt = new Date(pr.created_at);
                return createdAt >= thirtyDaysAgo;
            });

            let totalReviewTimeMs = 0;
            let totalMergeTimeMs = 0;
            let totalRevisions = 0;
            let prWithReview = 0;
            let mergedPRs = 0;
            const prSizes = { xs: 0, s: 0, m: 0, l: 0, xl: 0 };

            // Sample subset to avoid rate limits
            const sampleSize = Math.min(20, recentPRs.length);
            const sampledPRs = recentPRs.slice(0, sampleSize);

            for (const pr of sampledPRs) {
                // Get PR details for changes and reviews
                const prDetailsResponse = await fetch(
                    `${baseUrl}/repos/${org}/${repo}/pulls/${pr.number}`,
                    { headers }
                );

                if (prDetailsResponse.ok) {
                    const prDetails = await prDetailsResponse.json();

                    // Calculate PR size
                    const changes = (prDetails.additions || 0) + (prDetails.deletions || 0);
                    if (changes < 50) prSizes.xs++;
                    else if (changes < 200) prSizes.s++;
                    else if (changes < 500) prSizes.m++;
                    else if (changes < 1000) prSizes.l++;
                    else prSizes.xl++;

                    // Count commits as revisions
                    totalRevisions += prDetails.commits || 1;
                }

                // Get review time (time to first review)
                const reviewsResponse = await fetch(
                    `${baseUrl}/repos/${org}/${repo}/pulls/${pr.number}/reviews`,
                    { headers }
                );

                if (reviewsResponse.ok) {
                    const reviews = await reviewsResponse.json();
                    if (reviews.length > 0) {
                        const createdAt = new Date(pr.created_at);
                        const firstReviewAt = new Date(reviews[0].submitted_at);
                        totalReviewTimeMs += (firstReviewAt - createdAt);
                        prWithReview++;
                    }
                }

                // Calculate merge time
                if (pr.merged_at) {
                    const createdAt = new Date(pr.created_at);
                    const mergedAt = new Date(pr.merged_at);
                    totalMergeTimeMs += (mergedAt - createdAt);
                    mergedPRs++;
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const avgReviewTime = prWithReview > 0 ? totalReviewTimeMs / prWithReview : 0;
            const avgMergeTime = mergedPRs > 0 ? totalMergeTimeMs / mergedPRs : 0;
            const avgRevisions = sampledPRs.length > 0 ? totalRevisions / sampledPRs.length : 0;
            const mergeRate = recentPRs.length > 0 ?
                (recentPRs.filter(pr => pr.merged_at !== null).length / recentPRs.length) * 100 : 0;

            // Get open PRs count
            const openPRs = allPRs.filter(pr => pr.state === 'open').length;

            this.prHealthData.push({
                org,
                repo,
                repoFullName,
                avgReviewTime,
                avgMergeTime,
                avgRevisions,
                mergeRate,
                totalPRs: recentPRs.length,
                openPRs,
                prSizes
            });

            console.log(`✓ Fetched PR health for ${org}/${repo}`);
        } catch (error) {
            console.error(`Error fetching PR health for ${org}/${repo}:`, error);
        }
    }

    updatePRStats() {
        // Calculate aggregate PR stats
        let totalReviewTime = 0;
        let totalMergeTime = 0;
        let totalRevisions = 0;
        let repoCount = this.prHealthData.length;

        this.prHealthData.forEach(repo => {
            totalReviewTime += repo.avgReviewTime;
            totalMergeTime += repo.avgMergeTime;
            totalRevisions += repo.avgRevisions;
        });

        const avgReviewTime = repoCount > 0 ? totalReviewTime / repoCount : 0;
        const avgMergeTime = repoCount > 0 ? totalMergeTime / repoCount : 0;
        const avgRevisions = repoCount > 0 ? totalRevisions / repoCount : 0;
        const avgMergeRate = this.prHealthData.reduce((sum, repo) => sum + repo.mergeRate, 0) / repoCount;

        document.getElementById('pr-merge-rate-detail').textContent = `${avgMergeRate.toFixed(1)}%`;
        document.getElementById('avg-time-to-review').textContent = this.formatDuration(avgReviewTime);
        document.getElementById('avg-time-to-merge').textContent = this.formatDuration(avgMergeTime);
        document.getElementById('avg-pr-revisions').textContent = avgRevisions.toFixed(1);
    }

    renderPRMetricsTable() {
        const tbody = document.getElementById('pr-metrics-body');

        if (this.prHealthData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No PR health data available</td></tr>';
            return;
        }

        tbody.innerHTML = this.prHealthData.map(repo => `
            <tr>
                <td><a href="https://github.com/${repo.repoFullName}" target="_blank">${repo.repo}</a></td>
                <td>
                    <span class="badge ${repo.mergeRate >= 70 ? 'badge-issue' : 'badge-pr'}">
                        ${repo.mergeRate.toFixed(1)}%
                    </span>
                </td>
                <td>${this.formatDuration(repo.avgReviewTime)}</td>
                <td>${this.formatDuration(repo.avgMergeTime)}</td>
                <td>${repo.avgRevisions.toFixed(1)}</td>
                <td>${repo.totalPRs}</td>
                <td>${repo.openPRs}</td>
            </tr>
        `).join('');
    }

    renderPRSizeChart() {
        const ctx = document.getElementById('pr-size-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.prSize) {
            this.charts.prSize.destroy();
        }

        // Aggregate PR sizes across all repos
        const aggregatedSizes = { xs: 0, s: 0, m: 0, l: 0, xl: 0 };
        this.prHealthData.forEach(repo => {
            if (repo.prSizes) {
                aggregatedSizes.xs += repo.prSizes.xs || 0;
                aggregatedSizes.s += repo.prSizes.s || 0;
                aggregatedSizes.m += repo.prSizes.m || 0;
                aggregatedSizes.l += repo.prSizes.l || 0;
                aggregatedSizes.xl += repo.prSizes.xl || 0;
            }
        });

        this.charts.prSize = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['XS (<50 lines)', 'S (50-200)', 'M (200-500)', 'L (500-1000)', 'XL (>1000)'],
                datasets: [{
                    data: [
                        aggregatedSizes.xs,
                        aggregatedSizes.s,
                        aggregatedSizes.m,
                        aggregatedSizes.l,
                        aggregatedSizes.xl
                    ],
                    backgroundColor: [
                        '#73bf69',
                        '#33b5e5',
                        '#ff9830',
                        '#e02f44',
                        '#a77ddc'
                    ],
                    borderColor: '#1a1d23',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#d8d9da',
                            font: { size: 12 }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Distribution of PR Sizes (by lines changed)',
                        color: '#d8d9da',
                        font: { size: 14, weight: 'normal' }
                    }
                }
            }
        });
    }

    sortPRMetrics(field) {
        if (this.prCurrentSort.field === field) {
            this.prCurrentSort.ascending = !this.prCurrentSort.ascending;
        } else {
            this.prCurrentSort.field = field;
            this.prCurrentSort.ascending = true;
        }

        this.prHealthData.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.prCurrentSort.ascending ? -1 : 1;
            if (aVal > bVal) return this.prCurrentSort.ascending ? 1 : -1;
            return 0;
        });

        this.renderPRMetricsTable();
    }

    updatePRTrendCharts() {
        if (this.historicalData.length === 0) return;

        const period = document.getElementById('pr-trend-period')?.value || '90';
        let data = this.historicalData;

        // Filter by period
        if (period !== 'all') {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));
            data = this.historicalData.filter(d => new Date(d.date) >= cutoffDate);
        }

        if (data.length > 0) {
            document.getElementById('pr-trends-panel').style.display = 'block';
            this.renderReviewTimeTrendChart(data);
            this.renderMergeTimeTrendChart(data);
        }
    }

    renderReviewTimeTrendChart(data) {
        const ctx = document.getElementById('review-time-trend-chart');
        if (!ctx) return;

        if (this.charts.reviewTimeTrend) {
            this.charts.reviewTimeTrend.destroy();
        }

        const dates = data.map(d => d.date);
        const reviewTimes = data.map(d => {
            const rt = d.prMetrics?.avgReviewTime || 0;
            return rt / (1000 * 60 * 60); // Convert to hours
        });

        this.charts.reviewTimeTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Avg Review Time (hours)',
                    data: reviewTimes,
                    borderColor: '#33b5e5',
                    backgroundColor: 'rgba(51, 181, 229, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: this.getChartOptions('Review Time Trends')
        });
    }

    renderMergeTimeTrendChart(data) {
        const ctx = document.getElementById('merge-time-trend-chart');
        if (!ctx) return;

        if (this.charts.mergeTimeTrend) {
            this.charts.mergeTimeTrend.destroy();
        }

        const dates = data.map(d => d.date);
        const mergeTimes = data.map(d => {
            const mt = d.prMetrics?.avgMergeTime || 0;
            return mt / (1000 * 60 * 60); // Convert to hours
        });

        this.charts.mergeTimeTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Avg Merge Time (hours)',
                    data: mergeTimes,
                    borderColor: '#73bf69',
                    backgroundColor: 'rgba(115, 191, 105, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: this.getChartOptions('Merge Time Trends')
        });
    }

    showPRError(message) {
        const tbody = document.getElementById('pr-metrics-body');
        tbody.innerHTML = `<tr><td colspan="7" class="no-data" style="color: var(--accent-red);">${message}</td></tr>`;
    }

    // Issue Health Methods
    async loadIssueHealthData() {
        const loadingIndicator = document.getElementById('issue-loading-indicator');
        loadingIndicator.style.display = 'flex';

        try {
            this.issueHealthData = [];

            // Use mock data for testing
            const useMockData = true;

            if (useMockData) {
                this.generateMockIssueHealthData();
            } else {
                // Fetch issue metrics from all configured repositories
                const promises = DASHBOARD_CONFIG.repositories.map(repo =>
                    this.fetchIssueHealth(repo.org, repo.repo)
                );
                await Promise.all(promises);
            }

            this.updateIssueStats();
            this.renderIssueMetricsTable();
            this.renderIssueAgeChart();
            this.renderResponseDistributionChart();
            this.updateIssueTrendCharts();
        } catch (error) {
            console.error('Error loading issue health data:', error);
            this.showIssueError('Failed to load issue health data. Please try again.');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    generateMockIssueHealthData() {
        const repos = DASHBOARD_CONFIG.repositories;

        repos.forEach(repo => {
            const totalIssues = Math.floor(Math.random() * 150 + 50); // 50-200 issues
            const closedIssues = Math.floor(totalIssues * (Math.random() * 0.3 + 0.5)); // 50-80% closure rate
            const closureRate = (closedIssues / totalIssues) * 100;

            const avgTimeToClose = Math.random() * 604800000 + 172800000; // 2-9 days
            const avgTimeToFirstResponse = Math.random() * 43200000 + 3600000; // 1-13 hours
            const responseCoverage = Math.random() * 20 + 75; // 75-95%
            const communityResponseRate = Math.random() * 40 + 30; // 30-70%
            const avgCommentsPerIssue = Math.random() * 5 + 3; // 3-8 comments
            const openIssues = totalIssues - closedIssues;

            // Issue age distribution
            const issueAgeDistribution = {
                '0-7d': Math.floor(openIssues * (Math.random() * 0.2 + 0.2)), // 20-40%
                '7-30d': Math.floor(openIssues * (Math.random() * 0.2 + 0.2)), // 20-40%
                '30-90d': Math.floor(openIssues * (Math.random() * 0.15 + 0.15)), // 15-30%
                '90d+': Math.floor(openIssues * (Math.random() * 0.15 + 0.05)) // 5-20%
            };

            this.issueHealthData.push({
                org: repo.org,
                repo: repo.repo,
                repoFullName: `${repo.org}/${repo.repo}`,
                closureRate,
                avgTimeToClose,
                avgTimeToFirstResponse,
                responseCoverage,
                communityResponseRate,
                avgCommentsPerIssue,
                openIssues,
                issueAgeDistribution
            });
        });

        console.log('Generated mock issue health data for', this.issueHealthData.length, 'repositories');
    }

    updateIssueStats() {
        let totalClosureRate = 0;
        let totalTimeToClose = 0;
        let totalResponseCoverage = 0;
        let totalCommunityResponseRate = 0;
        const repoCount = this.issueHealthData.length;

        this.issueHealthData.forEach(repo => {
            totalClosureRate += repo.closureRate;
            totalTimeToClose += repo.avgTimeToClose;
            totalResponseCoverage += repo.responseCoverage;
            totalCommunityResponseRate += repo.communityResponseRate;
        });

        const avgClosureRate = repoCount > 0 ? totalClosureRate / repoCount : 0;
        const avgTimeToClose = repoCount > 0 ? totalTimeToClose / repoCount : 0;
        const avgResponseCoverage = repoCount > 0 ? totalResponseCoverage / repoCount : 0;
        const avgCommunityResponseRate = repoCount > 0 ? totalCommunityResponseRate / repoCount : 0;

        document.getElementById('issue-closure-rate').textContent = `${avgClosureRate.toFixed(1)}%`;
        document.getElementById('avg-time-to-close').textContent = this.formatDuration(avgTimeToClose);
        document.getElementById('response-coverage').textContent = `${avgResponseCoverage.toFixed(1)}%`;
        document.getElementById('community-response-rate').textContent = `${avgCommunityResponseRate.toFixed(1)}%`;
    }

    renderIssueMetricsTable() {
        const tbody = document.getElementById('issue-metrics-body');

        if (this.issueHealthData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No issue health data available</td></tr>';
            return;
        }

        tbody.innerHTML = this.issueHealthData.map(repo => `
            <tr>
                <td><a href="https://github.com/${repo.repoFullName}" target="_blank">${repo.repo}</a></td>
                <td>
                    <span class="badge ${repo.closureRate >= 70 ? 'badge-issue' : 'badge-pr'}">
                        ${repo.closureRate.toFixed(1)}%
                    </span>
                </td>
                <td>${this.formatDuration(repo.avgTimeToClose)}</td>
                <td>${this.formatDuration(repo.avgTimeToFirstResponse)}</td>
                <td>
                    <span class="badge ${repo.responseCoverage >= 80 ? 'badge-issue' : 'badge-pr'}">
                        ${repo.responseCoverage.toFixed(1)}%
                    </span>
                </td>
                <td>${repo.avgCommentsPerIssue.toFixed(1)}</td>
                <td>${repo.openIssues}</td>
            </tr>
        `).join('');
    }

    renderIssueAgeChart() {
        const ctx = document.getElementById('issue-age-chart');
        if (!ctx) return;

        if (this.charts.issueAge) {
            this.charts.issueAge.destroy();
        }

        // Aggregate issue age distribution across all repos
        const aggregatedAges = { '0-7d': 0, '7-30d': 0, '30-90d': 0, '90d+': 0 };
        this.issueHealthData.forEach(repo => {
            if (repo.issueAgeDistribution) {
                aggregatedAges['0-7d'] += repo.issueAgeDistribution['0-7d'] || 0;
                aggregatedAges['7-30d'] += repo.issueAgeDistribution['7-30d'] || 0;
                aggregatedAges['30-90d'] += repo.issueAgeDistribution['30-90d'] || 0;
                aggregatedAges['90d+'] += repo.issueAgeDistribution['90d+'] || 0;
            }
        });

        this.charts.issueAge = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-7 days', '7-30 days', '30-90 days', '90+ days'],
                datasets: [{
                    label: 'Number of Issues',
                    data: [
                        aggregatedAges['0-7d'],
                        aggregatedAges['7-30d'],
                        aggregatedAges['30-90d'],
                        aggregatedAges['90d+']
                    ],
                    backgroundColor: [
                        '#73bf69',
                        '#33b5e5',
                        '#ff9830',
                        '#e02f44'
                    ],
                    borderColor: '#1a1d23',
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
                        text: 'Distribution of Open Issues by Age',
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

    renderResponseDistributionChart() {
        const ctx = document.getElementById('response-distribution-chart');
        if (!ctx) return;

        if (this.charts.responseDistribution) {
            this.charts.responseDistribution.destroy();
        }

        // Calculate average response distribution
        let totalCommunity = 0;
        let totalMaintainer = 0;
        const repoCount = this.issueHealthData.length;

        this.issueHealthData.forEach(repo => {
            totalCommunity += repo.communityResponseRate || 0;
            totalMaintainer += (100 - (repo.communityResponseRate || 0));
        });

        const avgCommunity = repoCount > 0 ? totalCommunity / repoCount : 0;
        const avgMaintainer = repoCount > 0 ? totalMaintainer / repoCount : 0;

        this.charts.responseDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Community Responses', 'Maintainer Responses'],
                datasets: [{
                    data: [avgCommunity, avgMaintainer],
                    backgroundColor: [
                        '#73bf69',
                        '#33b5e5'
                    ],
                    borderColor: '#1a1d23',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#d8d9da',
                            font: { size: 12 }
                        }
                    },
                    title: {
                        display: true,
                        text: 'First Response Distribution',
                        color: '#d8d9da',
                        font: { size: 14, weight: 'normal' }
                    }
                }
            }
        });
    }

    sortIssueMetrics(field) {
        if (this.issueCurrentSort.field === field) {
            this.issueCurrentSort.ascending = !this.issueCurrentSort.ascending;
        } else {
            this.issueCurrentSort.field = field;
            this.issueCurrentSort.ascending = true;
        }

        this.issueHealthData.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.issueCurrentSort.ascending ? -1 : 1;
            if (aVal > bVal) return this.issueCurrentSort.ascending ? 1 : -1;
            return 0;
        });

        this.renderIssueMetricsTable();
    }

    updateIssueTrendCharts() {
        if (this.historicalData.length === 0) return;

        const period = document.getElementById('issue-trend-period')?.value || '90';
        let data = this.historicalData;

        // Filter by period
        if (period !== 'all') {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));
            data = this.historicalData.filter(d => new Date(d.date) >= cutoffDate);
        }

        if (data.length > 0) {
            document.getElementById('issue-trends-panel').style.display = 'block';
            this.renderClosureRateTrendChart(data);
            this.renderResponseTimeTrendChart(data);
        }
    }

    renderClosureRateTrendChart(data) {
        const ctx = document.getElementById('closure-rate-trend-chart');
        if (!ctx) return;

        if (this.charts.closureRateTrend) {
            this.charts.closureRateTrend.destroy();
        }

        const dates = data.map(d => d.date);
        const closureRates = data.map(d => d.issueMetrics?.closureRate || 0);

        this.charts.closureRateTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Closure Rate (%)',
                    data: closureRates,
                    borderColor: '#73bf69',
                    backgroundColor: 'rgba(115, 191, 105, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: this.getChartOptions('Issue Closure Rate Trends')
        });
    }

    renderResponseTimeTrendChart(data) {
        const ctx = document.getElementById('response-time-trend-chart');
        if (!ctx) return;

        if (this.charts.responseTimeTrend) {
            this.charts.responseTimeTrend.destroy();
        }

        const dates = data.map(d => d.date);
        const responseTimes = data.map(d => {
            const rt = d.issueMetrics?.avgTimeToFirstResponse || 0;
            return rt / (1000 * 60 * 60); // Convert to hours
        });

        this.charts.responseTimeTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Avg Response Time (hours)',
                    data: responseTimes,
                    borderColor: '#33b5e5',
                    backgroundColor: 'rgba(51, 181, 229, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: this.getChartOptions('Issue Response Time Trends')
        });
    }

    showIssueError(message) {
        const tbody = document.getElementById('issue-metrics-body');
        tbody.innerHTML = `<tr><td colspan="7" class="no-data" style="color: var(--accent-red);">${message}</td></tr>`;
    }

    // Maintainer Health Methods
    async loadMaintainerHealthData() {
        const loadingIndicator = document.getElementById('maintainer-loading-indicator');
        loadingIndicator.style.display = 'flex';

        try {
            this.maintainerHealthData = [];

            // Use mock data for testing
            const useMockData = true;

            if (useMockData) {
                this.generateMockMaintainerHealthData();
            } else {
                // Fetch maintainer metrics from all configured repositories
                const promises = DASHBOARD_CONFIG.repositories.map(repo =>
                    this.fetchMaintainerHealth(repo.org, repo.repo)
                );
                await Promise.all(promises);
            }

            this.updateMaintainerStats();
            this.renderMaintainerMetricsTable();
            this.renderMaintainerConcentrationChart();
            this.renderBusFactorChart();
            this.updateMaintainerTrendCharts();
        } catch (error) {
            console.error('Error loading maintainer health data:', error);
            this.showMaintainerError('Failed to load maintainer health data. Please try again.');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    generateMockMaintainerHealthData() {
        // Generate mock maintainer names
        const maintainerNames = [
            'alice-maintainer', 'bob-developer', 'carol-reviewer',
            'dave-contributor', 'eve-engineer', 'frank-dev',
            'grace-coder', 'henry-tech', 'iris-reviewer',
            'jack-contributor', 'karen-dev', 'leo-maintainer'
        ];

        // Generate realistic distribution (power law - few people do most work)
        const totalResponses = 500;
        let remainingResponses = totalResponses;

        maintainerNames.forEach((username, index) => {
            // Power law distribution - first few get most responses
            const baseShare = Math.pow(0.7, index); // Exponential decay
            const responseCount = Math.floor(remainingResponses * baseShare * 0.4);
            remainingResponses -= responseCount;

            if (responseCount > 0) {
                const issueResponses = Math.floor(responseCount * (Math.random() * 0.3 + 0.4)); // 40-70%
                const prResponses = responseCount - issueResponses;
                const avgResponseTime = Math.random() * 36000000 + 7200000; // 2-12 hours
                const repoCount = Math.floor(Math.random() * 5 + 1); // 1-6 repos

                this.maintainerHealthData.push({
                    username,
                    responseCount,
                    issueResponses,
                    prResponses,
                    avgResponseTime,
                    repoCount,
                    responseShare: 0 // Will be calculated later
                });
            }
        });

        // Sort by response count
        this.maintainerHealthData.sort((a, b) => b.responseCount - a.responseCount);

        // Calculate response share
        const totalMaintainerResponses = this.maintainerHealthData.reduce((sum, m) => sum + m.responseCount, 0);
        this.maintainerHealthData.forEach(maintainer => {
            maintainer.responseShare = (maintainer.responseCount / totalMaintainerResponses) * 100;
        });

        console.log('Generated mock maintainer health data for', this.maintainerHealthData.length, 'maintainers');
    }

    updateMaintainerStats() {
        const activeMaintainers = this.maintainerHealthData.length;
        const totalResponses = this.maintainerHealthData.reduce((sum, m) => sum + m.responseCount, 0);
        const avgResponseLoad = activeMaintainers > 0 ? Math.floor(totalResponses / activeMaintainers) : 0;

        // Calculate response concentration (Gini coefficient approximation)
        // Top 20% doing what % of the work
        const top20Count = Math.ceil(activeMaintainers * 0.2);
        const top20Responses = this.maintainerHealthData.slice(0, top20Count).reduce((sum, m) => sum + m.responseCount, 0);
        const concentration = totalResponses > 0 ? (top20Responses / totalResponses) * 100 : 0;

        // Burnout risk indicator - based on response time trend
        // For now, use concentration as a proxy (high concentration = higher burnout risk)
        let burnoutRisk = 'Low';
        if (concentration > 80) {
            burnoutRisk = 'High';
        } else if (concentration > 60) {
            burnoutRisk = 'Medium';
        }

        document.getElementById('active-maintainers').textContent = activeMaintainers;
        document.getElementById('response-load').textContent = `${avgResponseLoad}/person`;
        document.getElementById('response-concentration').textContent = `${concentration.toFixed(0)}%`;
        document.getElementById('burnout-indicator').textContent = burnoutRisk;

        // Update burnout indicator color
        const burnoutElement = document.getElementById('burnout-indicator');
        if (burnoutRisk === 'High') {
            burnoutElement.style.color = 'var(--accent-red)';
        } else if (burnoutRisk === 'Medium') {
            burnoutElement.style.color = 'var(--accent-orange)';
        } else {
            burnoutElement.style.color = 'var(--accent-green)';
        }
    }

    renderMaintainerMetricsTable() {
        const tbody = document.getElementById('maintainer-metrics-body');

        if (this.maintainerHealthData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No maintainer health data available</td></tr>';
            return;
        }

        // Show top 20 maintainers
        const topMaintainers = this.maintainerHealthData.slice(0, 20);

        tbody.innerHTML = topMaintainers.map(maintainer => `
            <tr>
                <td>
                    <a href="https://github.com/${maintainer.username}" target="_blank">
                        ${maintainer.username}
                    </a>
                </td>
                <td>${maintainer.responseCount}</td>
                <td>${maintainer.issueResponses}</td>
                <td>${maintainer.prResponses}</td>
                <td>${this.formatDuration(maintainer.avgResponseTime)}</td>
                <td>${maintainer.repoCount}</td>
                <td>
                    <span class="badge ${maintainer.responseShare > 15 ? 'badge-pr' : 'badge-issue'}">
                        ${maintainer.responseShare.toFixed(1)}%
                    </span>
                </td>
            </tr>
        `).join('');
    }

    renderMaintainerConcentrationChart() {
        const ctx = document.getElementById('maintainer-concentration-chart');
        if (!ctx) return;

        if (this.charts.maintainerConcentration) {
            this.charts.maintainerConcentration.destroy();
        }

        // Show top 10 maintainers
        const topMaintainers = this.maintainerHealthData.slice(0, 10);
        const labels = topMaintainers.map(m => m.username);
        const data = topMaintainers.map(m => m.responseCount);

        this.charts.maintainerConcentration = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Responses',
                    data: data,
                    backgroundColor: '#33b5e5',
                    borderColor: '#1a1d23',
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
                        text: 'Top 10 Responders (30d)',
                        color: '#d8d9da',
                        font: { size: 14, weight: 'normal' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#9fa3a7', maxRotation: 45, minRotation: 45 },
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

    renderBusFactorChart() {
        const ctx = document.getElementById('bus-factor-chart');
        if (!ctx) return;

        if (this.charts.busFactor) {
            this.charts.busFactor.destroy();
        }

        // Calculate cumulative response share
        const totalResponses = this.maintainerHealthData.reduce((sum, m) => sum + m.responseCount, 0);
        let cumulative = 0;
        const cumulativeData = [];

        this.maintainerHealthData.forEach((maintainer, index) => {
            cumulative += maintainer.responseCount;
            cumulativeData.push({
                index: index + 1,
                percentage: (cumulative / totalResponses) * 100
            });
        });

        // Show up to 15 maintainers
        const displayData = cumulativeData.slice(0, 15);

        this.charts.busFactor = new Chart(ctx, {
            type: 'line',
            data: {
                labels: displayData.map(d => `Top ${d.index}`),
                datasets: [{
                    label: 'Cumulative Response Share (%)',
                    data: displayData.map(d => d.percentage),
                    borderColor: '#ff9830',
                    backgroundColor: 'rgba(255, 152, 48, 0.1)',
                    tension: 0.3,
                    fill: true
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
                        text: 'Cumulative Response Distribution (Bus Factor)',
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
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    sortMaintainerMetrics(field) {
        if (this.maintainerCurrentSort.field === field) {
            this.maintainerCurrentSort.ascending = !this.maintainerCurrentSort.ascending;
        } else {
            this.maintainerCurrentSort.field = field;
            this.maintainerCurrentSort.ascending = field === 'username'; // username ascending by default, others descending
        }

        this.maintainerHealthData.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.maintainerCurrentSort.ascending ? -1 : 1;
            if (aVal > bVal) return this.maintainerCurrentSort.ascending ? 1 : -1;
            return 0;
        });

        this.renderMaintainerMetricsTable();
    }

    updateMaintainerTrendCharts() {
        if (this.historicalData.length === 0) return;

        const period = document.getElementById('maintainer-trend-period')?.value || '90';
        let data = this.historicalData;

        // Filter by period
        if (period !== 'all') {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - parseInt(period));
            data = this.historicalData.filter(d => new Date(d.date) >= cutoffDate);
        }

        if (data.length > 0) {
            document.getElementById('maintainer-trends-panel').style.display = 'block';
            this.renderMaintainerCountTrendChart(data);
            this.renderMaintainerResponseTrendChart(data);
        }
    }

    renderMaintainerCountTrendChart(data) {
        const ctx = document.getElementById('maintainer-count-trend-chart');
        if (!ctx) return;

        if (this.charts.maintainerCountTrend) {
            this.charts.maintainerCountTrend.destroy();
        }

        const dates = data.map(d => d.date);
        const maintainerCounts = data.map(d => d.maintainerMetrics?.activeMaintainers || 0);

        this.charts.maintainerCountTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Active Maintainers',
                    data: maintainerCounts,
                    borderColor: '#73bf69',
                    backgroundColor: 'rgba(115, 191, 105, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: this.getChartOptions('Active Maintainer Trends')
        });
    }

    renderMaintainerResponseTrendChart(data) {
        const ctx = document.getElementById('maintainer-response-trend-chart');
        if (!ctx) return;

        if (this.charts.maintainerResponseTrend) {
            this.charts.maintainerResponseTrend.destroy();
        }

        const dates = data.map(d => d.date);
        const concentrations = data.map(d => d.maintainerMetrics?.responseConcentration || 0);

        this.charts.maintainerResponseTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Response Concentration (%)',
                    data: concentrations,
                    borderColor: '#ff9830',
                    backgroundColor: 'rgba(255, 152, 48, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: this.getChartOptions('Response Concentration Trends')
        });
    }

    showMaintainerError(message) {
        const tbody = document.getElementById('maintainer-metrics-body');
        tbody.innerHTML = `<tr><td colspan="7" class="no-data" style="color: var(--accent-red);">${message}</td></tr>`;
    }
}

// Dashboard is initialized in index.html to make it globally accessible
