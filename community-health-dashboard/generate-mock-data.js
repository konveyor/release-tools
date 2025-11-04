// Generate mock historical data for testing trends
const fs = require('fs');
const path = require('path');

// Create history directory if it doesn't exist
const historyDir = path.join(__dirname, 'data', 'history');
if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
}

// Configuration
const daysToGenerate = 90;
const repositories = [
    'analyzer-lsp', 'enhancements', 'java-analyzer-bundle',
    'kai', 'kantra', 'operator', 'rulesets',
    'tackle2-hub', 'tackle2-ui'
];

// Helper function to generate random number within range
function randomInRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to add trend (increasing, decreasing, or stable)
function applyTrend(baseValue, dayIndex, totalDays, trendType, variance = 0.2) {
    let trendMultiplier = 1;
    const progress = dayIndex / totalDays; // 0 to 1

    if (trendType === 'increasing') {
        trendMultiplier = 0.7 + (progress * 0.6); // 0.7 to 1.3
    } else if (trendType === 'decreasing') {
        trendMultiplier = 1.3 - (progress * 0.6); // 1.3 to 0.7
    } else {
        trendMultiplier = 1 + (Math.random() * variance * 2 - variance); // stable with small variance
    }

    return Math.floor(baseValue * trendMultiplier);
}

// Generate data for each day
const dates = [];
for (let i = daysToGenerate - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dates.push(dateStr);

    const dayIndex = daysToGenerate - i;

    // Generate repository data
    const repoData = repositories.map(repo => ({
        org: 'konveyor',
        repo: repo,
        contributors: applyTrend(randomInRange(15, 30), dayIndex, daysToGenerate, 'increasing', 0.15),
        newContributors: applyTrend(randomInRange(2, 8), dayIndex, daysToGenerate, 'increasing', 0.3),
        avgIssueResponseMs: applyTrend(randomInRange(3600000, 86400000), dayIndex, daysToGenerate, 'decreasing', 0.4), // 1-24 hours
        avgPRResponseMs: applyTrend(randomInRange(1800000, 43200000), dayIndex, daysToGenerate, 'decreasing', 0.4), // 0.5-12 hours
        prMergeRate: Math.min(100, Math.max(50, applyTrend(70, dayIndex, daysToGenerate, 'increasing', 0.15))),
        openIssues: applyTrend(randomInRange(20, 50), dayIndex, daysToGenerate, 'stable', 0.3),
        openPRs: applyTrend(randomInRange(5, 15), dayIndex, daysToGenerate, 'stable', 0.3)
    }));

    // Calculate aggregate metrics
    const totalContributors = repoData.reduce((sum, r) => sum + r.contributors, 0);
    const totalNewContributors = repoData.reduce((sum, r) => sum + r.newContributors, 0);

    let totalIssueResponseMs = 0;
    let totalPRResponseMs = 0;
    let issueRepoCount = 0;
    let prRepoCount = 0;

    repoData.forEach(repo => {
        if (repo.avgIssueResponseMs > 0) {
            totalIssueResponseMs += repo.avgIssueResponseMs;
            issueRepoCount++;
        }
        if (repo.avgPRResponseMs > 0) {
            totalPRResponseMs += repo.avgPRResponseMs;
            prRepoCount++;
        }
    });

    const avgIssueResponse = issueRepoCount > 0 ? totalIssueResponseMs / issueRepoCount : 0;
    const avgPRResponse = prRepoCount > 0 ? totalPRResponseMs / prRepoCount : 0;
    const avgResponseTime = (avgIssueResponse + avgPRResponse) / 2;

    const avgPRMergeRate = repoData.reduce((sum, r) => sum + r.prMergeRate, 0) / repoData.length;
    const totalOpenIssues = repoData.reduce((sum, r) => sum + r.openIssues, 0);
    const totalOpenPRs = repoData.reduce((sum, r) => sum + r.openPRs, 0);

    // Generate PR health metrics
    const avgReviewTime = applyTrend(randomInRange(7200000, 36000000), dayIndex, daysToGenerate, 'decreasing', 0.4); // 2-10 hours
    const avgMergeTime = applyTrend(randomInRange(43200000, 259200000), dayIndex, daysToGenerate, 'decreasing', 0.3); // 12-72 hours
    const avgRevisions = applyTrend(randomInRange(2, 5), dayIndex, daysToGenerate, 'stable', 0.3);

    // Generate issue health metrics
    const closureRate = applyTrend(randomInRange(60, 80), dayIndex, daysToGenerate, 'increasing', 0.15); // 60-80% closure rate
    const avgTimeToClose = applyTrend(randomInRange(172800000, 604800000), dayIndex, daysToGenerate, 'decreasing', 0.3); // 2-7 days
    const avgTimeToFirstResponse = applyTrend(randomInRange(3600000, 43200000), dayIndex, daysToGenerate, 'decreasing', 0.4); // 1-12 hours
    const responseCoverage = applyTrend(randomInRange(75, 90), dayIndex, daysToGenerate, 'increasing', 0.1); // 75-90%
    const communityResponseRate = applyTrend(randomInRange(35, 55), dayIndex, daysToGenerate, 'stable', 0.3); // 35-55%

    // Generate maintainer health metrics
    const activeMaintainers = applyTrend(randomInRange(8, 14), dayIndex, daysToGenerate, 'stable', 0.2); // 8-14 maintainers
    const responseConcentration = applyTrend(randomInRange(60, 80), dayIndex, daysToGenerate, 'stable', 0.15); // 60-80% concentration

    // Generate activity heatmap data (7 days × 24 hours)
    const activityHeatmap = [];
    for (let day = 0; day < 7; day++) {
        const dayData = [];
        const isWeekend = day === 0 || day === 6;

        for (let hour = 0; hour < 24; hour++) {
            let baseActivity;

            // Business hours (9-17) have more activity
            if (hour >= 9 && hour <= 17) {
                baseActivity = isWeekend ? 5 : 15;
            } else if (hour >= 6 && hour <= 22) {
                baseActivity = isWeekend ? 3 : 8;
            } else {
                baseActivity = isWeekend ? 1 : 3;
            }

            // Add randomness
            const activity = Math.floor(baseActivity + Math.random() * 5);
            dayData.push(activity);
        }

        activityHeatmap.push(dayData);
    }

    const data = {
        timestamp: date.toISOString(),
        date: dateStr,
        repositories: repoData,
        metrics: {
            totalContributors,
            newContributors: totalNewContributors,
            avgResponseTime,
            avgIssueResponse,
            avgPRResponse,
            prMergeRate: avgPRMergeRate,
            openIssues: totalOpenIssues,
            openPRs: totalOpenPRs,
            repositories: repoData.length
        },
        prMetrics: {
            avgReviewTime,
            avgMergeTime,
            avgRevisions
        },
        issueMetrics: {
            closureRate,
            avgTimeToClose,
            avgTimeToFirstResponse,
            responseCoverage,
            communityResponseRate
        },
        maintainerMetrics: {
            activeMaintainers: Math.floor(activeMaintainers),
            responseConcentration
        },
        activityHeatmap
    };

    // Write file
    const filename = path.join(historyDir, `${dateStr}.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`Generated ${dateStr}.json`);
}

// Create index.json
const index = {
    available_dates: dates
};

fs.writeFileSync(path.join(historyDir, 'index.json'), JSON.stringify(index, null, 2));
console.log(`\nCreated index.json with ${dates.length} dates`);
console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
