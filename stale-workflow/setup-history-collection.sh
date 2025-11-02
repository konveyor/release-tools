#!/bin/bash

# Script to set up the stale issues history collection workflow
# This creates a PR to enable automated data collection in the repository
#
# Usage: ./setup-history-collection.sh

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "${SCRIPT_DIR}/.." && pwd )"

WORKFLOW_FILE="collect-stale-history.yml"
WORKFLOW_DEST=".github/workflows/collect-stale-history.yml"
BRANCH_NAME="add-stale-history-collection"
COMMIT_MESSAGE=":sparkles: Add stale issues history collection workflow"

echo -e "${YELLOW}Stale Issues History Collection Setup${NC}"
echo ""
echo "This script will create a PR to set up automated collection of stale issues data."
echo "The workflow will:"
echo "  - Run daily at 2:00 AM UTC"
echo "  - Collect stale issue/PR counts from all configured repositories"
echo "  - Commit data to stale-dashboard/data/history/"
echo "  - Enable historical trend analysis in the dashboard"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI.${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Get current repository info
CURRENT_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$CURRENT_REPO" ]; then
    echo -e "${RED}Error: Could not determine current repository${NC}"
    exit 1
fi

echo -e "Setting up history collection for: ${GREEN}${CURRENT_REPO}${NC}"
echo ""
read -p "Do you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

cd "$REPO_ROOT"

# Get default branch
DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | cut -d' ' -f5)

# Ensure we're on the default branch and up to date
git checkout "$DEFAULT_BRANCH"
git pull origin "$DEFAULT_BRANCH"

# Check if branch already exists and delete it
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo -e "${YELLOW}Branch $BRANCH_NAME already exists, deleting it${NC}"
    git branch -D "$BRANCH_NAME"
fi

# Create a new branch
git checkout -b "$BRANCH_NAME"

# Create .github/workflows directory if it doesn't exist
mkdir -p .github/workflows

# Copy workflow file
cp "${SCRIPT_DIR}/${WORKFLOW_FILE}" "$WORKFLOW_DEST"

echo -e "${GREEN}✓ Workflow file copied to .github/workflows/${NC}"

# Create data directory structure
mkdir -p stale-dashboard/data/history

# Create .gitkeep to ensure directory is tracked
touch stale-dashboard/data/history/.gitkeep

echo -e "${GREEN}✓ Created data directory structure${NC}"

# Create a sample README in the data directory
cat > stale-dashboard/data/history/README.md << 'EOF'
# Stale Issues Historical Data

This directory contains daily snapshots of stale issues and pull requests across Konveyor repositories.

## Data Format

Each file is named `YYYY-MM-DD.json` and contains:

```json
{
  "timestamp": "2025-11-01T02:00:00.000Z",
  "date": "2025-11-01",
  "totals": {
    "repositories": 5,
    "totalStale": 42,
    "staleIssues": 30,
    "stalePRs": 12
  },
  "repositories": [
    {
      "org": "konveyor",
      "repo": "analyzer-lsp",
      "totalStale": 10,
      "staleIssues": 7,
      "stalePRs": 3,
      "items": [...]
    }
  ]
}
```

## Data Collection

Data is automatically collected by the GitHub Actions workflow `.github/workflows/collect-stale-history.yml`.

The workflow runs daily at 2:00 AM UTC and commits new data files to this directory.

## Retention

By default, all historical data is retained. You may want to implement a retention policy to:
- Keep daily snapshots for the last 90 days
- Keep weekly snapshots for older data
- Archive very old data

This can be implemented by modifying the collection workflow.
EOF

echo -e "${GREEN}✓ Created data directory documentation${NC}"

# Stage the changes
git add "$WORKFLOW_DEST" \
    stale-dashboard/data/history/.gitkeep \
    stale-dashboard/data/history/README.md

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo -e "${YELLOW}No changes to commit (workflow already exists and is identical)${NC}"
    git checkout "$DEFAULT_BRANCH"
    git branch -D "$BRANCH_NAME"
    exit 0
fi

# Commit with DCO sign-off
git commit -s -m "$COMMIT_MESSAGE"

echo -e "${GREEN}✓ Changes committed${NC}"

# Push the branch
if ! git push -u origin "$BRANCH_NAME" 2>/dev/null; then
    echo -e "${RED}Failed to push branch to origin${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Branch pushed to origin${NC}"

# Create pull request
PR_OUTPUT=$(gh pr create \
    --repo "$CURRENT_REPO" \
    --head "$BRANCH_NAME" \
    --base "$DEFAULT_BRANCH" \
    --title "$COMMIT_MESSAGE" \
    --body "This PR adds automated historical data collection for stale issues and pull requests.

## What This Does

- Adds a GitHub Actions workflow that runs daily at 2:00 AM UTC
- Collects current counts of stale issues and PRs from all configured repositories
- Commits daily snapshots to \`stale-dashboard/data/history/\`
- Enables historical trend analysis in the stale issues dashboard

## How It Works

The workflow:
1. Reads the repository list from \`stale-dashboard/config.js\`
2. Queries the GitHub API for issues/PRs with the \`stale\` label
3. Generates a JSON file with date, totals, and per-repository breakdowns
4. Commits the file to the repository

## Dashboard Integration

Once this is merged and the workflow runs, the dashboard at \`stale-dashboard/index.html\` will automatically:
- Display trend charts showing stale items over time
- Show repository breakdowns
- Allow filtering by time period (30/60/90 days, etc.)

## Required Settings

After merging, ensure workflow write permissions are enabled:
1. Go to Settings > Actions > General
2. Under \"Workflow permissions\", select \"Read and write permissions\"
3. Click \"Save\"

## Testing

You can manually trigger the workflow after merging:
\`\`\`bash
gh workflow run collect-stale-history.yml
\`\`\`

The workflow will also run automatically daily at 2:00 AM UTC." 2>&1)

PR_EXIT_CODE=$?

if [ $PR_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Pull request created successfully!${NC}"
    echo "$PR_OUTPUT"
    echo ""
    echo -e "${YELLOW}Important:${NC} After the PR is merged, make sure to enable workflow write permissions:"
    echo "  Settings > Actions > General > Workflow permissions > Read and write permissions"
else
    echo -e "${RED}Failed to create pull request${NC}"
    echo "$PR_OUTPUT"
    exit 1
fi

# Return to default branch
git checkout "$DEFAULT_BRANCH"

echo ""
echo -e "${GREEN}Setup complete!${NC}"
