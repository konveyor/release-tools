# Snyk CLI Integration for Community Health Dashboard

## Overview

The community health dashboard now uses **Snyk CLI via GitHub Actions** instead of the Snyk REST API to collect security vulnerability data. This approach is more reliable and avoids API authentication issues.

## Architecture

### Two-Workflow System

1. **`scan-snyk-vulnerabilities.yml`** (runs at 2:00 AM UTC)
   - Scans all configured repositories using Snyk CLI
   - Stores results in `community-health-dashboard/data/snyk/latest.json`
   - Commits results to the repository

2. **`collect-community-health.yml`** (runs at 3:00 AM UTC)
   - Reads Snyk data from `latest.json`
   - Combines with other community health metrics
   - Stores complete snapshot in `data/history/{date}.json`

### Why This Approach?

**Previous Approach (Snyk REST API):**
- ❌ Required service account token (personal tokens don't work)
- ❌ Failed with 403 Forbidden errors
- ❌ Complex API pagination and filtering
- ❌ Tight coupling between data collection and API

**New Approach (Snyk CLI + GitHub Actions):**
- ✅ Works with personal Snyk token (`SNYK_TOKEN`)
- ✅ More reliable - CLI is battle-tested
- ✅ Simpler implementation - one scan per repo
- ✅ Decoupled - scans run independently
- ✅ Better error handling and logging
- ✅ Can run scans manually or on-demand

## Setup

### 1. Add SNYK_TOKEN Secret

The Snyk CLI workflow requires a single token (not API-specific credentials):

1. Get your Snyk token:
   ```bash
   # If you have Snyk CLI installed locally:
   snyk config get api

   # Or get it from:
   # https://app.snyk.io/account (click "Generate Token")
   ```

2. Add to GitHub Secrets:
   - Go to: Repository → Settings → Secrets and variables → Actions
   - Click: **New repository secret**
   - Name: `SNYK_TOKEN`
   - Value: `your-snyk-token-here` (starts with `snyk-`)
   - Click: **Add secret**

### 2. Enable Workflow Permissions

The scan workflow needs to commit results back to the repository:

1. Go to: Repository → Settings → Actions → General
2. Under "**Workflow permissions**":
   - Select: **Read and write permissions**
   - Check: **Allow GitHub Actions to create and approve pull requests** (optional)
3. Click: **Save**

### 3. Configure Repositories

The scan workflow automatically reads the repository list from `community-health-dashboard/config.js`:

```javascript
repositories: [
    { org: 'konveyor', repo: 'analyzer-lsp' },
    { org: 'konveyor', repo: 'tackle2-hub' },
    { org: 'konveyor', repo: 'kai' },
    // Add more repositories here...
]
```

No additional configuration needed - both workflows use the same list!

## Usage

### Running Scans Manually

To trigger a Snyk scan manually:

1. Go to: **Actions** tab
2. Select: **Scan Snyk Vulnerabilities** workflow
3. Click: **Run workflow** → **Run workflow**
4. Wait for completion (~2-5 minutes depending on number of repos)

### Viewing Results

The scan creates a JSON file at:
```
community-health-dashboard/data/snyk/latest.json
```

Example format:
```json
{
  "timestamp": "2026-01-13T02:00:00Z",
  "repositories": [
    {
      "org": "konveyor",
      "repo": "analyzer-lsp",
      "vulnerabilities": {
        "critical": 2,
        "high": 5,
        "medium": 12,
        "low": 8,
        "total": 27
      }
    },
    {
      "org": "konveyor",
      "repo": "tackle2-hub",
      "vulnerabilities": null  // Not scanned or no data
    }
  ]
}
```

### Automated Schedule

By default, scans run automatically:
- **Snyk scans**: Daily at 2:00 AM UTC
- **Community health collection**: Daily at 3:00 AM UTC (includes Snyk data)

You can modify the schedule in the workflow files:
```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
```

## Dashboard Display

The dashboard automatically displays Snyk data from the scans:

### Security Column
- **Critical** (red badge): `2C` - Requires immediate attention
- **High** (orange badge): `5H` - Should be addressed soon
- **Medium** (yellow badge): `12M` - Address in due course
- **Low** (gray badge): `8L` - Minimal risk
- **✓** (green): No vulnerabilities found
- **N/A**: Repository not scanned or no data available

### Severity Badges
The dashboard shows severity counts in a compact format:
```
2C 5H 12M  (2 critical, 5 high, 12 medium)
✓          (no vulnerabilities)
N/A        (not scanned)
```

## Troubleshooting

### "No scan results file found"

**Problem**: Community health workflow can't find `latest.json`

**Solution**:
1. Run the **Scan Snyk Vulnerabilities** workflow manually first
2. Verify the file was created in `community-health-dashboard/data/snyk/latest.json`
3. Check workflow logs for errors

### "Failed to clone repository"

**Problem**: Git clone failed during scan

**Causes**:
- Repository is private (Snyk workflow can only scan public repos)
- Repository doesn't exist
- Network issues

**Solution**:
- Verify repository exists and is public
- Check repository name spelling in `config.js`
- Re-run workflow (transient network issues)

### "Snyk test failed" or "No Snyk data available"

**Problem**: Snyk CLI couldn't scan the repository

**Causes**:
- Repository has no dependency files (package.json, requirements.txt, etc.)
- Repository uses unsupported package manager
- Snyk token is invalid or expired

**Solution**:
- Check that repository has scannable files
- Verify `SNYK_TOKEN` secret is correct
- Check Snyk CLI logs in workflow output

### "Permission denied" when committing

**Problem**: Workflow can't commit results

**Solution**:
1. Go to Settings → Actions → General
2. Enable "Read and write permissions"
3. Re-run the workflow

### Scan is very slow

**Problem**: Scanning many repositories takes a long time

**Optimization**:
- Each repo is scanned sequentially (to avoid rate limits)
- There's a 2-second delay between repos
- Large repos take longer to clone and scan

**Solutions**:
- Reduce number of repositories in `config.js`
- Increase the delay if you hit rate limits
- Run scans less frequently (e.g., weekly instead of daily)

## Migration from API Approach

If you were using the previous Snyk REST API approach:

### What Changed
1. ❌ Removed: `SNYK_API_TOKEN` secret (API-specific)
2. ❌ Removed: `SNYK_ORG_ID` secret (API-specific)
3. ✅ Added: `SNYK_TOKEN` secret (CLI token)
4. ✅ Added: `scan-snyk-vulnerabilities.yml` workflow
5. ✅ Modified: `collect-community-health.yml` - reads from file instead of API

### Migration Steps
1. Delete old secrets: `SNYK_API_TOKEN`, `SNYK_ORG_ID` (if they exist)
2. Add new secret: `SNYK_TOKEN` (see Setup section)
3. Run the scan workflow manually once to populate initial data
4. Future community health collections will automatically use the new data

### Data Compatibility
The data format is the same - the dashboard doesn't need any changes:
```javascript
{
  critical: 2,
  high: 5,
  medium: 12,
  low: 8,
  total: 27
}
```

## Advanced Configuration

### Changing Snyk Organization

By default, scans use `--org=konveyor`. To change:

Edit `.github/workflows/scan-snyk-vulnerabilities.yml`:
```yaml
snyk test --json --org=your-org-name
```

### Scanning Private Repositories

The current implementation only works with public repos. For private repos:

1. Use a GitHub token with repo access:
   ```yaml
   git clone "https://${{ secrets.GITHUB_TOKEN }}@github.com/${org}/${repo}.git"
   ```

2. Ensure the token has appropriate permissions

### Custom Scan Options

Modify the Snyk CLI command in the workflow:

```bash
# Example: Only scan high/critical, ignore dev dependencies
snyk test --json --org=konveyor --severity-threshold=high --dev
```

See [Snyk CLI documentation](https://docs.snyk.io/snyk-cli/commands/test) for all options.

### Parallel Scanning

To speed up scans by running in parallel:

```yaml
strategy:
  matrix:
    repo: [analyzer-lsp, tackle2-hub, kai, move2kube]
  max-parallel: 4  # Scan 4 repos at once
```

Note: Be careful with rate limits if scanning many repos in parallel.

## Monitoring

### Workflow Status

Check workflow runs at:
```
Actions → Scan Snyk Vulnerabilities → Recent runs
```

### Scan Logs

View detailed logs by clicking on a workflow run:
- Clone status for each repository
- Vulnerability counts
- Errors or warnings
- Scan summary at the end

### Commit History

Scan results are committed automatically:
```
:shield: Update Snyk vulnerability scan results - 2026-01-13 02:15 UTC
```

Check git history to see when scans ran and what changed.

## Cost Considerations

### Snyk Free Tier
- ✅ Unlimited tests for open source projects
- ✅ Suitable for public Konveyor repositories
- ❌ Limited projects in the Snyk dashboard (200 tests/month for private projects)

### GitHub Actions Minutes
- Each scan uses approximately 2-5 minutes of Actions time per repository
- Free tier: 2,000 minutes/month for public repos
- Example: 20 repos × 3 min/scan × 30 days = 1,800 minutes/month

### Recommendations
- ✅ Keep scans to public repos (unlimited Snyk tests)
- ✅ Run daily for active projects, weekly for stable ones
- ✅ Monitor Actions usage in Settings → Billing

## Future Enhancements

Potential improvements to consider:

1. **Delta Notifications**: Alert on new vulnerabilities
2. **Trend Analysis**: Track vulnerability changes over time
3. **Severity Filtering**: Only track critical/high
4. **Integration with Issues**: Auto-create GitHub issues for critical vulns
5. **Badge Generation**: Generate security badges for READMEs
6. **Historical Archiving**: Keep scan history beyond just `latest.json`

## Support

### Resources
- [Snyk CLI Documentation](https://docs.snyk.io/snyk-cli)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Community Health Dashboard README](community-health-dashboard/README.md)

### Getting Help
- File an issue in the release-tools repository
- Check workflow logs for detailed error messages
- Review this document for common troubleshooting steps
