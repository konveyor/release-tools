# Stale Issues Workflow Setup

This package contains files to deploy a stale issues/PRs marking workflow to your GitHub organization repositories.

## Configuration Summary

- **Mark as stale after:** 60 days of inactivity
- **Auto-close:** Disabled (only marks as stale)
- **Scope:** Both issues and pull requests
- **Exempt labels:** security, critical, pinned, blocked, in-progress, under-review, enhancement, tech-debt
- **Exempt assignees:** Yes (any item with an assignee is exempt)

## Files

- `stale-issues-workflow.yml` - The GitHub Actions workflow configuration
- `deploy-stale-workflow.sh` - Automated deployment script
- `remove-stale-workflow.sh` - Automated removal script
- `collect-stale-history.yml` - Historical data collection workflow (optional)
- `setup-history-collection.sh` - Setup script for historical data tracking
- `README.md` - This documentation
- `stale-workflow-blacklist.txt.example` - Example blacklist file

**Note**: The web-based dashboard is located at [../stale-dashboard/](../stale-dashboard/)

## Automated Deployment

The deployment script reads the repository list from `pkg/config/config.yaml` and automatically creates PRs across all configured repositories.

**Prerequisites:**
- GitHub CLI installed: `brew install gh` (macOS) or see https://cli.github.com/
- Authenticated: `gh auth login`

### Deploy to All Repositories

Run the script without arguments to deploy to all repositories in config.yaml:

```bash
cd stale-workflow
./deploy-stale-workflow.sh
```

The script will:
1. Read repositories from `../pkg/config/config.yaml`
2. Exclude any repositories listed in `stale-workflow-blacklist.txt`
3. Show you the list and ask for confirmation
4. For each repository:
   - Clone the repository
   - Create a new branch `add-stale-workflow`
   - Add the workflow file to `.github/workflows/stale.yml`
   - Create a pull request for review

### Deploy to Specific Repositories

To deploy only to specific repositories:

```bash
./deploy-stale-workflow.sh repo1 repo2 repo3
```

### Blacklisting Repositories

To exclude certain repositories from deployment:

1. Copy the example blacklist file:
   ```bash
   cp stale-workflow-blacklist.txt.example stale-workflow-blacklist.txt
   ```

2. Edit `stale-workflow-blacklist.txt` and add repository names (one per line):
   ```
   konveyor.github.io
   enhancements
   ```

3. Run the deployment script - blacklisted repositories will be automatically skipped

## Manual Deployment

If you prefer to deploy to a single repository manually:

1. Navigate to the repository
2. Create the directory: `mkdir -p .github/workflows`
3. Copy the workflow: `cp stale-issues-workflow.yml .github/workflows/stale.yml`
4. Commit and push:
   ```bash
   git add .github/workflows/stale.yml
   git commit -m "Add stale issue marking workflow"
   git push
   ```

## Removing the Workflow

If you need to remove the stale workflow from repositories in the future, use the removal script:

### Remove from All Repositories

```bash
cd stale-workflow
./remove-stale-workflow.sh
```

This will:
1. Read repositories from `../pkg/config/config.yaml`
2. Exclude any repositories listed in `stale-workflow-blacklist.txt`
3. Show you the list and ask for confirmation
4. For each repository:
   - Clone the repository
   - Remove `.github/workflows/stale.yml` if it exists
   - Create a pull request with the removal

### Remove from Specific Repositories

```bash
./remove-stale-workflow.sh repo1 repo2 repo3
```

The removal script uses the same blacklist file as the deployment script, so any blacklisted repositories will be skipped.

## Historical Data Collection (Optional)

To track trends over time and enable visualizations in the dashboard, you can set up automated historical data collection.

**Note**: This should be set up in the **upstream konveyor/release-tools repository** so that all maintainers can view the same historical data on a shared dashboard.

### Setup

**Prerequisites:**
- GitHub CLI installed and authenticated
- Write access to the repository (for upstream maintainers)

Run the setup script to create a PR that enables automated data collection:

```bash
cd stale-workflow
./setup-history-collection.sh
```

This will:
1. Create a new branch `add-stale-history-collection`
2. Copy the `collect-stale-history.yml` workflow to `.github/workflows/`
3. Create the data directory structure
4. Commit the changes with DCO sign-off
5. Push the branch
6. **Create a pull request** for review

Once the PR is merged, enable workflow write permissions:
- Go to Settings > Actions > General
- Under "Workflow permissions", select "Read and write permissions"
- Click "Save"

### How It Works

- Runs daily at 2:00 AM UTC (after the stale marking workflow)
- Collects current stale issue/PR counts from all configured repositories
- Commits data to `stale-dashboard/data/history/YYYY-MM-DD.json`
- Dashboard automatically detects and displays trend charts

### Manual Trigger

To collect data immediately:

```bash
gh workflow run collect-stale-history.yml
```

See the [dashboard README](../stale-dashboard/README.md) for information about viewing historical trends.

## Viewing Stale Items

Once deployed, you can view stale items using GitHub filters:

**In the repository web UI:**
- Stale issues: Click "Issues" → "Labels" → "stale"
- Stale PRs: Click "Pull requests" → "Labels" → "stale"

**Using GitHub search:**
```
is:issue label:stale
is:pr label:stale
is:open label:stale
```

**Using GitHub CLI:**
```bash
# List stale issues
gh issue list --label stale

# List stale PRs
gh pr list --label stale
```

## Reporting

To generate reports of stale items across the organization:

```bash
# List all stale issues across all repos
gh search issues --owner konveyor "label:stale" --json repository,title,url,updatedAt

# Export to CSV
gh search issues --owner konveyor "label:stale" --json repository,title,url,updatedAt --jq '.[] | [.repository.name, .title, .url, .updatedAt] | @csv'
```

## Customization

To modify the workflow configuration, edit `stale-issues-workflow.yml`:

- **Change stale duration:** Modify `days-before-stale` (line 20)
- **Update messages:** Edit `stale-issue-message` and `stale-pr-message` (lines 26-37)
- **Change exempt labels:** Modify `exempt-issue-labels` and `exempt-pr-labels` (lines 43-44)
- **Disable assignee exemption:** Remove or set to `false` (lines 47-48)
- **Change schedule:** Modify the cron expression (line 6)

## Troubleshooting

**Workflow not running:**
- Ensure the workflow file is in `.github/workflows/` directory
- Check the Actions tab in your repository
- Verify repository has Actions enabled in Settings

**Items not being marked stale:**
- Check if items have exempt labels
- Verify items don't have assignees (if exemption is enabled)
- Ensure 60 days have passed since last activity
- Check workflow run logs in the Actions tab

**Permission errors:**
- Ensure the workflow has proper permissions (configured in lines 9-11)
- Check repository settings allow GitHub Actions to create and modify issues

## Support

For issues with the workflow action itself, see:
https://github.com/actions/stale
