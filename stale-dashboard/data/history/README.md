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
