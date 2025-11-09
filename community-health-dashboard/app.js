// Community Health Dashboard App
class CommunityHealthDashboard {
    constructor() {
        this.repoHealthData = [];
        this.prHealthData = [];
        this.issueHealthData = [];
        this.maintainerHealthData = [];
        this.ciHealthData = [];
        this.componentCIData = [];
        this.recentActivity = [];
        this.historicalData = [];
        this.currentSort = { field: 'repo', ascending: true };
        this.prCurrentSort = { field: 'repo', ascending: true };
        this.issueCurrentSort = { field: 'repo', ascending: true };
        this.maintainerCurrentSort = { field: 'responseCount', ascending: false };
        this.ciCurrentSort = { field: 'name', ascending: true };
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
            maintainerResponseTrend: null,
            ciSuccessTrend: null,
            ciDurationTrend: null,
            branchHealth: null
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

        // Contributor cards click handlers
        const totalContributorsCard = document.getElementById('total-contributors-card');
        if (totalContributorsCard) {
            totalContributorsCard.addEventListener('click', () => {
                this.showContributorsModal('total');
            });
        }

        const newContributorsCard = document.getElementById('new-contributors-card');
        if (newContributorsCard) {
            newContributorsCard.addEventListener('click', () => {
                this.showContributorsModal('new');
            });
        }

        // Modal close handlers
        const closeModal = document.getElementById('close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.hideContributorsModal();
            });
        }

        const modal = document.getElementById('contributors-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideContributorsModal();
                }
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
        } else if (tabName === 'ci-health' && this.ciHealthData.length === 0) {
            this.loadCIHealthData();
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

                // Sample only 3 issues per repo to avoid rate limits and get representative data
                // Filter to only include issues created within the response time period
                const recentIssues = issues
                    .filter(issue => {
                        const createdAt = new Date(issue.created_at);
                        return createdAt >= responseTimePeriod;
                    })
                    .slice(0, 3);

                // Calculate response times from sampled recent issues
                for (const issue of recentIssues) {
                    const firstComment = await this.getFirstComment(org, repo, issue.number, headers);
                    if (firstComment) {
                        const createdAt = new Date(issue.created_at);
                        const firstResponseAt = new Date(firstComment.created_at);

                        if (issue.pull_request) {
                            avgPRResponseMs += (firstResponseAt - createdAt);
                            prCount++;
                        } else {
                            avgIssueResponseMs += (firstResponseAt - createdAt);
                            issueCount++;
                        }
                    }
                }

                // Count all open issues/PRs from full list
                issues.forEach(issue => {
                    if (issue.state === 'open') {
                        if (issue.pull_request) {
                            openPRs++;
                        } else {
                            openIssues++;
                        }
                    }
                });
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
                contributorsList: Array.from(contributors), // Store usernames for deduplication
                newContributors: actualNewContributors,
                newContributorsList: Array.from(newContributors), // Store usernames for deduplication
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
        // Deduplicate contributors across all repos
        const allContributors = new Set();
        const allNewContributors = new Set();

        this.repoHealthData.forEach(repo => {
            if (repo.contributorsList) {
                repo.contributorsList.forEach(username => allContributors.add(username));
            }
            if (repo.newContributorsList) {
                repo.newContributorsList.forEach(username => allNewContributors.add(username));
            }
        });

        const totalContributors = allContributors.size;
        const totalNewContributors = allNewContributors.size;

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

            // Use mock data for local development, live data on GitHub Pages
            const useMockData = DASHBOARD_CONFIG.useMockData;

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

            // Use mock data for local development, live data on GitHub Pages
            const useMockData = DASHBOARD_CONFIG.useMockData;

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

            // Use mock data for local development, live data on GitHub Pages
            const useMockData = DASHBOARD_CONFIG.useMockData;

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

    // CI/CD Health Methods
    async loadCIHealthData() {
        const loadingIndicator = document.getElementById('ci-loading-indicator');
        loadingIndicator.style.display = 'flex';

        try {
            this.ciHealthData = [];
            this.componentCIData = [];

            // Use mock data for local development, live data on GitHub Pages
            const useMockData = DASHBOARD_CONFIG.useMockData;

            if (useMockData) {
                this.generateMockCIHealthData();
                this.generateMockComponentCIData();
            } else {
                await this.fetchCIHealth();
                await this.fetchComponentCIHealth();
            }

            this.updateCIStats();
            this.renderWorkflowStatusTable();
            this.renderComponentCIStatus();
            this.renderRecentRuns();
            this.renderBranchHealthChart();
            this.updateCITrendCharts();
        } catch (error) {
            console.error('Error loading CI/CD health data:', error);
            this.showCIError('Failed to load CI/CD health data. Please try again.');
        } finally {
            loadingIndicator.style.display = 'none';
        }
    }

    generateMockCIHealthData() {
        const workflows = [
            { name: 'Konveyor e2e CI shared workflow', id: 59293862, branch: 'main' },
            { name: 'Run Konveyor nightly main branch tests', id: 60001312, branch: 'main' },
            { name: 'Konveyor e2e CI via Operator Bundle', id: 75321830, branch: 'main' },
            { name: 'Konveyor CI repo testing', id: 147762287, branch: 'main' },
            { name: 'Run Konveyor release-0.7 nightly tests', id: 160083009, branch: 'release-0.7' },
            { name: 'Run Konveyor release-0.8 nightly tests', id: 191123204, branch: 'release-0.8' }
        ];

        workflows.forEach(workflow => {
            const totalRuns = Math.floor(Math.random() * 20 + 10); // 10-30 runs in 7 days
            const successRuns = Math.floor(totalRuns * (Math.random() * 0.3 + 0.65)); // 65-95% success
            const successRate = (successRuns / totalRuns) * 100;

            // Generate recent runs
            const runs = [];
            for (let i = 0; i < Math.min(10, totalRuns); i++) {
                const hoursAgo = i * 12 + Math.random() * 12; // Runs spread over last 5 days
                const duration = Math.random() * 900000 + 300000; // 5-20 minutes
                const status = Math.random() < (successRate / 100) ? 'success' : 'failure';

                runs.push({
                    id: workflow.id + i,
                    name: workflow.name,
                    branch: workflow.branch,
                    status: status,
                    conclusion: status,
                    created_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
                    updated_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000 + duration).toISOString(),
                    duration: duration,
                    triggeredBy: ['github-actions[bot]', 'dependabot[bot]', 'renovate[bot]'][Math.floor(Math.random() * 3)]
                });
            }

            const avgDuration = runs.reduce((sum, r) => sum + r.duration, 0) / runs.length;
            const lastRun = runs[0];

            this.ciHealthData.push({
                workflowId: workflow.id,
                name: workflow.name,
                branch: workflow.branch,
                status: lastRun.status,
                lastRun: lastRun.created_at,
                duration: avgDuration,
                successRate: successRate,
                totalRuns: totalRuns,
                runs: runs
            });
        });

        console.log('Generated mock CI/CD health data for', this.ciHealthData.length, 'workflows');
    }

    async fetchCIHealth() {
        const baseUrl = 'https://api.github.com';
        const headers = {};

        if (DASHBOARD_CONFIG.githubToken) {
            headers['Authorization'] = `Bearer ${DASHBOARD_CONFIG.githubToken}`;
        }

        try {
            const org = 'konveyor';
            const repo = 'ci';
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            // Fetch all workflows
            const workflowsResponse = await fetch(
                `${baseUrl}/repos/${org}/${repo}/actions/workflows`,
                { headers }
            );

            if (!workflowsResponse.ok) {
                console.error('Failed to fetch workflows');
                return;
            }

            const workflowsData = await workflowsResponse.json();
            const workflows = workflowsData.workflows.filter(w => w.state === 'active');

            // Fetch runs for each workflow
            for (const workflow of workflows) {
                const runsResponse = await fetch(
                    `${baseUrl}/repos/${org}/${repo}/actions/workflows/${workflow.id}/runs?per_page=50&created=>${sevenDaysAgo}`,
                    { headers }
                );

                if (runsResponse.ok) {
                    const runsData = await runsResponse.json();
                    const runs = runsData.workflow_runs;

                    if (runs.length === 0) continue;

                    const successRuns = runs.filter(r => r.conclusion === 'success').length;
                    const successRate = (successRuns / runs.length) * 100;

                    const durations = runs
                        .filter(r => r.updated_at && r.created_at)
                        .map(r => new Date(r.updated_at) - new Date(r.created_at));

                    const avgDuration = durations.length > 0
                        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
                        : 0;

                    const lastRun = runs[0];
                    const branch = lastRun.head_branch || 'main';

                    this.ciHealthData.push({
                        workflowId: workflow.id,
                        name: workflow.name,
                        branch: branch,
                        status: lastRun.conclusion || lastRun.status,
                        lastRun: lastRun.created_at,
                        duration: avgDuration,
                        successRate: successRate,
                        totalRuns: runs.length,
                        runs: runs.slice(0, 10).map(r => ({
                            id: r.id,
                            name: workflow.name,
                            branch: r.head_branch || 'main',
                            status: r.status,
                            conclusion: r.conclusion || 'in_progress',
                            created_at: r.created_at,
                            updated_at: r.updated_at,
                            duration: r.updated_at && r.created_at
                                ? new Date(r.updated_at) - new Date(r.created_at)
                                : 0,
                            triggeredBy: r.triggering_actor?.login || 'unknown'
                        }))
                    });
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log('Fetched CI/CD health data for', this.ciHealthData.length, 'workflows');
        } catch (error) {
            console.error('Error fetching CI health data:', error);
        }
    }

    updateCIStats() {
        // Calculate overall stats
        let totalRuns = 0;
        let totalSuccessRuns = 0;
        let totalDuration = 0;
        let nightlyWorkflows = 0;
        let nightlySuccessRuns = 0;
        let nightlyTotalRuns = 0;

        this.ciHealthData.forEach(workflow => {
            totalRuns += workflow.totalRuns;
            totalSuccessRuns += Math.floor((workflow.successRate / 100) * workflow.totalRuns);
            totalDuration += workflow.duration;

            if (workflow.name.toLowerCase().includes('nightly')) {
                nightlyWorkflows++;
                nightlyTotalRuns += workflow.totalRuns;
                nightlySuccessRuns += Math.floor((workflow.successRate / 100) * workflow.totalRuns);
            }
        });

        const overallSuccessRate = totalRuns > 0 ? (totalSuccessRuns / totalRuns) * 100 : 0;
        const avgDuration = this.ciHealthData.length > 0 ? totalDuration / this.ciHealthData.length : 0;
        const nightlySuccessRate = nightlyTotalRuns > 0 ? (nightlySuccessRuns / nightlyTotalRuns) * 100 : 0;

        document.getElementById('ci-success-rate').textContent = `${overallSuccessRate.toFixed(1)}%`;
        document.getElementById('ci-avg-duration').textContent = this.formatDuration(avgDuration);
        document.getElementById('ci-nightly-success').textContent = `${nightlySuccessRate.toFixed(1)}%`;
        document.getElementById('ci-total-runs').textContent = totalRuns;
    }

    renderWorkflowStatusTable() {
        const tbody = document.getElementById('workflow-status-body');

        if (this.ciHealthData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No CI/CD workflow data available</td></tr>';
            return;
        }

        tbody.innerHTML = this.ciHealthData.map(workflow => {
            const statusClass = workflow.status === 'success' ? 'badge-issue' :
                               workflow.status === 'failure' ? 'badge-failure' : '';
            const statusText = workflow.status === 'success' ? '✓ Success' :
                              workflow.status === 'failure' ? '✗ Failed' : '⟳ Running';

            return `
                <tr>
                    <td>${workflow.name}</td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>${this.formatDate(new Date(workflow.lastRun))}</td>
                    <td>${this.formatDuration(workflow.duration)}</td>
                    <td>
                        <span class="badge ${workflow.successRate >= 80 ? 'badge-issue' : workflow.successRate >= 60 ? 'badge-pr' : 'badge-failure'}">
                            ${workflow.successRate.toFixed(1)}%
                        </span>
                    </td>
                    <td>${workflow.totalRuns}</td>
                </tr>
            `;
        }).join('');
    }

    renderRecentRuns() {
        const tbody = document.getElementById('recent-runs-body');

        // Collect all runs from all workflows
        const allRuns = [];
        this.ciHealthData.forEach(workflow => {
            if (workflow.runs) {
                allRuns.push(...workflow.runs);
            }
        });

        // Sort by created_at (most recent first)
        allRuns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Take top 20
        const recentRuns = allRuns.slice(0, 20);

        if (recentRuns.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">No recent runs found</td></tr>';
            return;
        }

        tbody.innerHTML = recentRuns.map(run => {
            const statusClass = run.conclusion === 'success' ? 'badge-issue' :
                               run.conclusion === 'failure' ? 'badge-failure' : '';
            const statusText = run.conclusion === 'success' ? '✓' :
                              run.conclusion === 'failure' ? '✗' : '⟳';

            return `
                <tr>
                    <td title="${run.name}">${this.truncate(run.name, 40)}</td>
                    <td>${run.branch}</td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${statusText} ${run.conclusion || run.status}
                        </span>
                    </td>
                    <td>${this.formatDate(new Date(run.created_at))}</td>
                    <td>${this.formatDuration(run.duration)}</td>
                    <td>${run.triggeredBy}</td>
                </tr>
            `;
        }).join('');
    }

    renderBranchHealthChart() {
        const ctx = document.getElementById('branch-health-chart');
        if (!ctx) return;

        if (this.charts.branchHealth) {
            this.charts.branchHealth.destroy();
        }

        // Group workflows by branch
        const branchData = {};
        this.ciHealthData.forEach(workflow => {
            if (!branchData[workflow.branch]) {
                branchData[workflow.branch] = {
                    totalRuns: 0,
                    successRuns: 0,
                    workflows: 0
                };
            }
            branchData[workflow.branch].totalRuns += workflow.totalRuns;
            branchData[workflow.branch].successRuns += Math.floor((workflow.successRate / 100) * workflow.totalRuns);
            branchData[workflow.branch].workflows++;
        });

        const branches = Object.keys(branchData);
        const successRates = branches.map(branch => {
            const data = branchData[branch];
            return data.totalRuns > 0 ? (data.successRuns / data.totalRuns) * 100 : 0;
        });

        this.charts.branchHealth = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: branches,
                datasets: [{
                    label: 'Success Rate (%)',
                    data: successRates,
                    backgroundColor: successRates.map(rate =>
                        rate >= 80 ? '#73bf69' : rate >= 60 ? '#ff9830' : '#e02f44'
                    ),
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
                        text: 'CI Success Rate by Branch (Last 7 Days)',
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

    updateCITrendCharts() {
        // For now, trends will only show if historical data is available
        // This would require collecting CI metrics over time similar to other metrics
        // Placeholder for future implementation
        console.log('CI trend charts require historical data collection');
    }

    sortCIMetrics(field) {
        if (this.ciCurrentSort.field === field) {
            this.ciCurrentSort.ascending = !this.ciCurrentSort.ascending;
        } else {
            this.ciCurrentSort.field = field;
            this.ciCurrentSort.ascending = true;
        }

        this.ciHealthData.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.ciCurrentSort.ascending ? -1 : 1;
            if (aVal > bVal) return this.ciCurrentSort.ascending ? 1 : -1;
            return 0;
        });

        this.renderWorkflowStatusTable();
    }

    showCIError(message) {
        const tbody = document.getElementById('workflow-status-body');
        tbody.innerHTML = `<tr><td colspan="6" class="no-data" style="color: var(--accent-red);">${message}</td></tr>`;
    }

    // Component CI Methods
    generateMockComponentCIData() {
        DASHBOARD_CONFIG.repositories.forEach(({ org, repo }) => {
            const workflowCount = Math.floor(Math.random() * 5 + 1); // 1-5 workflows per repo
            const totalRuns = Math.floor(Math.random() * 30 + 10); // 10-40 runs total
            const successRuns = Math.floor(totalRuns * (Math.random() * 0.3 + 0.65)); // 65-95% success
            const successRate = (successRuns / totalRuns) * 100;

            const lastStatus = Math.random() < (successRate / 100) ? 'success' : 'failure';
            const hoursAgo = Math.random() * 48; // Last run within 48 hours

            this.componentCIData.push({
                org,
                repo,
                status: lastStatus,
                branch: 'main',
                lastRun: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
                successRate: successRate,
                totalWorkflows: workflowCount,
                totalRuns: totalRuns
            });
        });

        console.log('Generated mock component CI data for', this.componentCIData.length, 'components');
    }

    async fetchComponentCIHealth() {
        const baseUrl = 'https://api.github.com';
        const headers = {};

        if (DASHBOARD_CONFIG.githubToken) {
            headers['Authorization'] = `Bearer ${DASHBOARD_CONFIG.githubToken}`;
        }

        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            for (const { org, repo } of DASHBOARD_CONFIG.repositories) {
                try {
                    // Fetch workflows for this repo
                    const workflowsResponse = await fetch(
                        `${baseUrl}/repos/${org}/${repo}/actions/workflows`,
                        { headers }
                    );

                    if (!workflowsResponse.ok) {
                        console.log(`No workflows found for ${org}/${repo}`);
                        continue;
                    }

                    const workflowsData = await workflowsResponse.json();
                    const activeWorkflows = workflowsData.workflows?.filter(w => w.state === 'active') || [];

                    if (activeWorkflows.length === 0) {
                        continue;
                    }

                    // Fetch runs across all workflows for this repo
                    const runsResponse = await fetch(
                        `${baseUrl}/repos/${org}/${repo}/actions/runs?per_page=50&created=>${sevenDaysAgo}`,
                        { headers }
                    );

                    if (!runsResponse.ok) {
                        continue;
                    }

                    const runsData = await runsResponse.json();
                    const runs = runsData.workflow_runs || [];

                    if (runs.length === 0) {
                        continue;
                    }

                    const successRuns = runs.filter(r => r.conclusion === 'success').length;
                    const successRate = (successRuns / runs.length) * 100;
                    const lastRun = runs[0];

                    this.componentCIData.push({
                        org,
                        repo,
                        status: lastRun.conclusion || lastRun.status,
                        branch: lastRun.head_branch || 'main',
                        lastRun: lastRun.created_at,
                        successRate: successRate,
                        totalWorkflows: activeWorkflows.length,
                        totalRuns: runs.length
                    });

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (error) {
                    console.error(`Error fetching CI for ${org}/${repo}:`, error);
                }
            }

            console.log('Fetched component CI data for', this.componentCIData.length, 'components');
        } catch (error) {
            console.error('Error fetching component CI health:', error);
        }
    }

    renderComponentCIStatus() {
        const tbody = document.getElementById('component-ci-body');

        if (this.componentCIData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No component CI data available</td></tr>';
            return;
        }

        tbody.innerHTML = this.componentCIData.map(component => {
            const statusClass = component.status === 'success' ? 'badge-issue' :
                               component.status === 'failure' ? 'badge-failure' : '';
            const statusText = component.status === 'success' ? '✓ Success' :
                              component.status === 'failure' ? '✗ Failed' :
                              component.status === 'in_progress' ? '⟳ Running' : component.status;

            return `
                <tr>
                    <td><strong>${component.repo}</strong></td>
                    <td>
                        <span class="badge ${statusClass}">
                            ${statusText}
                        </span>
                    </td>
                    <td>${component.branch}</td>
                    <td>${this.formatDate(new Date(component.lastRun))}</td>
                    <td>
                        <span class="badge ${component.successRate >= 80 ? 'badge-issue' : component.successRate >= 60 ? 'badge-pr' : 'badge-failure'}">
                            ${component.successRate.toFixed(1)}%
                        </span>
                    </td>
                    <td>${component.totalWorkflows}</td>
                    <td>${component.totalRuns}</td>
                </tr>
            `;
        }).join('');
    }

    // Contributor Modal Methods
    showContributorsModal(type) {
        const modal = document.getElementById('contributors-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalTotalCount = document.getElementById('modal-total-count');
        const contributorsList = document.getElementById('contributors-list');

        if (!modal || !modalTitle || !modalTotalCount || !contributorsList) {
            return;
        }

        // Gather contributor data with repo information
        const contributorData = this.getContributorData(type);

        // Update modal title and count
        if (type === 'total') {
            modalTitle.textContent = 'Total Contributors (90d)';
        } else {
            modalTitle.textContent = 'New Contributors (30d)';
        }
        modalTotalCount.textContent = contributorData.length;

        // Populate contributors list
        if (contributorData.length === 0) {
            contributorsList.innerHTML = '<p class="no-data">No contributors found</p>';
        } else {
            contributorsList.innerHTML = contributorData
                .sort((a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase()))
                .map(contributor => `
                    <div class="contributor-item">
                        <a href="https://github.com/${contributor.username}"
                           target="_blank"
                           class="contributor-name">
                            ${contributor.username}
                        </a>
                        <div class="contributor-repos">
                            ${contributor.repos.length} repo${contributor.repos.length > 1 ? 's' : ''}:
                            ${contributor.repos.join(', ')}
                        </div>
                    </div>
                `).join('');
        }

        // Show modal
        modal.classList.add('active');
    }

    hideContributorsModal() {
        const modal = document.getElementById('contributors-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    getContributorData(type) {
        // Create a map to track which repos each contributor has contributed to
        const contributorRepoMap = new Map();

        this.repoHealthData.forEach(repo => {
            const list = type === 'total' ? repo.contributorsList : repo.newContributorsList;

            if (list && Array.isArray(list)) {
                list.forEach(username => {
                    if (!contributorRepoMap.has(username)) {
                        contributorRepoMap.set(username, []);
                    }
                    contributorRepoMap.get(username).push(repo.repo);
                });
            }
        });

        // Convert map to array of objects
        const contributors = [];
        contributorRepoMap.forEach((repos, username) => {
            contributors.push({
                username,
                repos: repos.sort()
            });
        });

        return contributors;
    }
}

// Dashboard is initialized in index.html to make it globally accessible
