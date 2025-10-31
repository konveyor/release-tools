#!/bin/bash

# Script to remove stale issues workflow from multiple GitHub repositories
# Usage: ./remove-stale-workflow.sh [repo1] [repo2] ...
#   or:  ./remove-stale-workflow.sh (removes from all repos in config.yaml)
#
# To exclude repositories, create a stale-workflow-blacklist.txt file with one repo name per line.

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "${SCRIPT_DIR}/.." && pwd )"

# File paths
CONFIG_FILE="${REPO_ROOT}/pkg/config/config.yaml"
BLACKLIST_FILE="${SCRIPT_DIR}/stale-workflow-blacklist.txt"
WORKFLOW_PATH=".github/workflows/stale.yml"
BRANCH_NAME="remove-stale-workflow"
COMMIT_MESSAGE="Remove stale issue marking workflow"

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

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Config file not found at ${CONFIG_FILE}${NC}"
    exit 1
fi

# Function to parse repositories from config.yaml
parse_repos_from_config() {
    # Extract repo names from the YAML config
    # Looking for lines like "    repo: repository-name" under the repos section
    grep -A 1 "^  - org:" "$CONFIG_FILE" | grep "    repo:" | awk '{print $2}'
}

# Function to check if a repo is blacklisted
is_blacklisted() {
    local repo="$1"
    if [ -f "$BLACKLIST_FILE" ]; then
        if grep -q "^${repo}$" "$BLACKLIST_FILE"; then
            return 0  # true, is blacklisted
        fi
    fi
    return 1  # false, not blacklisted
}

# Function to get org name for a repo from config.yaml
get_org_for_repo() {
    local repo="$1"
    # Find the org that corresponds to this repo
    # This assumes repos are listed as:
    # - org: orgname
    #   repo: reponame
    awk -v repo="$repo" '
        /^  - org:/ { org=$3 }
        /^    repo:/ { if ($2 == repo) print org }
    ' "$CONFIG_FILE"
}

# Function to remove workflow from a single repository
remove_from_repo() {
    local repo="$1"
    local org=$(get_org_for_repo "$repo")

    if [ -z "$org" ]; then
        echo -e "${RED}  Could not find org for repo: ${repo}${NC}"
        return 1
    fi

    local full_repo="${org}/${repo}"

    echo -e "\n${YELLOW}Processing: ${full_repo}${NC}"

    # Clean up any previous failed runs
    rm -rf "/tmp/${repo}"

    # Clone the repository
    if ! gh repo clone "$full_repo" "/tmp/${repo}" -- --depth 1 2>/dev/null; then
        echo -e "${RED}  Failed to clone ${full_repo}${NC}"
        return 1
    fi

    cd "/tmp/${repo}"

    # Get default branch
    DEFAULT_BRANCH=$(git remote show origin | grep 'HEAD branch' | cut -d' ' -f5)

    # Check if workflow file exists
    if [ ! -f "${WORKFLOW_PATH}" ]; then
        echo -e "${YELLOW}  No workflow file found (already removed or never existed)${NC}"
        cd - > /dev/null
        rm -rf "/tmp/${repo}"
        return 0
    fi

    # Remove workflow file
    rm "${WORKFLOW_PATH}"

    # Check if there are changes
    if git diff --quiet && git diff --cached --quiet; then
        echo -e "${YELLOW}  No changes detected${NC}"
        cd - > /dev/null
        rm -rf "/tmp/${repo}"
        return 0
    fi

    # Create a new branch
    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

    # Add and commit with DCO sign-off
    git add "${WORKFLOW_PATH}"
    git commit -s -m "$COMMIT_MESSAGE"

    # Push the branch
    if ! git push -u origin "$BRANCH_NAME" 2>/dev/null; then
        echo -e "${RED}  Failed to push to ${full_repo}${NC}"
        cd - > /dev/null
        rm -rf "/tmp/${repo}"
        return 1
    fi

    # Create pull request
    if gh pr create --title "$COMMIT_MESSAGE" --body "This PR removes the automated stale issues/PRs workflow.

The workflow was previously deployed to mark stale items after 60 days of inactivity. This removal indicates that the repository no longer requires automated stale marking." 2>/dev/null; then
        echo -e "${GREEN}  Pull request created successfully${NC}"
    else
        echo -e "${YELLOW}  Branch pushed but PR creation failed (may already exist)${NC}"
    fi

    cd - > /dev/null
    rm -rf "/tmp/${repo}"
}

# Get list of repositories
if [ $# -eq 0 ]; then
    # No arguments provided - use repos from config.yaml
    echo "Reading repositories from config.yaml..."
    ALL_REPOS=$(parse_repos_from_config)

    if [ -z "$ALL_REPOS" ]; then
        echo -e "${RED}No repositories found in ${CONFIG_FILE}${NC}"
        exit 1
    fi

    # Filter out blacklisted repos
    REPOS=""
    BLACKLISTED_REPOS=""
    BLACKLIST_COUNT=0

    while IFS= read -r repo; do
        if is_blacklisted "$repo"; then
            BLACKLISTED_REPOS="${BLACKLISTED_REPOS}${repo}\n"
            ((BLACKLIST_COUNT++))
        else
            REPOS="${REPOS}${repo}\n"
        fi
    done <<< "$ALL_REPOS"

    # Remove trailing newlines
    REPOS=$(echo -e "$REPOS" | sed '/^$/d')
    BLACKLISTED_REPOS=$(echo -e "$BLACKLISTED_REPOS" | sed '/^$/d')

    REPO_COUNT=$(echo "$REPOS" | wc -l | xargs)

    echo -e "${GREEN}Found ${REPO_COUNT} repositories to remove workflow from${NC}"

    if [ $BLACKLIST_COUNT -gt 0 ]; then
        echo -e "${YELLOW}Blacklisted ${BLACKLIST_COUNT} repositories:${NC}"
        echo "$BLACKLISTED_REPOS" | sed 's/^/  - /'
    fi

    echo ""
    echo -e "${RED}WARNING: This will remove the stale workflow from ${REPO_COUNT} repositories.${NC}"
    read -p "Do you want to proceed? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi

    # Remove from all repos (excluding blacklisted)
    SUCCESS_COUNT=0
    FAIL_COUNT=0
    SKIP_COUNT=0

    while IFS= read -r repo; do
        if [ -z "$repo" ]; then
            continue
        fi
        if remove_from_repo "$repo"; then
            ((SUCCESS_COUNT++))
        else
            ((FAIL_COUNT++))
        fi
    done <<< "$REPOS"

    echo -e "\n${GREEN}Removal complete!${NC}"
    echo -e "  Successful: ${SUCCESS_COUNT}"
    echo -e "  Failed: ${FAIL_COUNT}"
    if [ $BLACKLIST_COUNT -gt 0 ]; then
        echo -e "  Blacklisted: ${BLACKLIST_COUNT}"
    fi
else
    # Remove from specified repos
    echo "Removing workflow from specified repositories..."
    SUCCESS_COUNT=0
    FAIL_COUNT=0
    SKIP_COUNT=0

    for repo in "$@"; do
        if is_blacklisted "$repo"; then
            echo -e "${YELLOW}Skipping blacklisted repository: ${repo}${NC}"
            ((SKIP_COUNT++))
            continue
        fi

        if remove_from_repo "$repo"; then
            ((SUCCESS_COUNT++))
        else
            ((FAIL_COUNT++))
        fi
    done

    echo -e "\n${GREEN}Removal complete!${NC}"
    echo -e "  Successful: ${SUCCESS_COUNT}"
    echo -e "  Failed: ${FAIL_COUNT}"
    if [ $SKIP_COUNT -gt 0 ]; then
        echo -e "  Skipped (blacklisted): ${SKIP_COUNT}"
    fi
fi
