# Weekly Email Reports for Repository Maintainers

Automated weekly email notifications that send repository health summaries to maintainers every Monday at 9:00 AM UTC.

## Overview

The weekly email system aggregates data from the stale dashboard and community health dashboard to provide maintainers with a comprehensive weekly summary of their repositories' health, including:

- **Stale Issues & PRs** - Count and list of stale items with week-over-week trends
- **Community Health** - Contributors, response times, PR merge rates
- **Security & Coverage** - Snyk vulnerabilities and code coverage (when available)
- **New Contributors** - List of new contributors this week
- **Quick Links** - Direct links to GitHub dashboards

## Features

- ✅ **Consolidated emails** - One email per maintainer with all their repositories
- ✅ **Week-over-week trends** - See how metrics changed from last week
- ✅ **Smart formatting** - Response times shown in minutes (<1h) or hours (≥1h)
- ✅ **Conditional sections** - Security section only shown when data exists
- ✅ **HTML + Plain Text** - Beautiful HTML email with plain text fallback
- ✅ **Multiple testing modes** - Preview, dry-run, and single-email testing
- ✅ **Automated delivery** - GitHub Actions workflow runs every Monday

## Quick Start

### 1. Create Configuration

Copy the example configuration and customize it:

```bash
cp pkg/config/maintainers.yaml.example pkg/config/maintainers.yaml
```

Edit `pkg/config/maintainers.yaml`:

```yaml
maintainers:
  - org: konveyor
    repo: analyzer-lsp
    email: maintainer@example.com
    name: John Doe

  - org: konveyor
    repo: kai
    email: maintainer@example.com
    name: John Doe

cc_emails:
  - team-lead@example.com

smtp:
  server: smtp.gmail.com
  port: 587
  from_email: noreply-konveyor@example.com
  from_name: Konveyor Health Reports
```

### 2. Preview Locally (No SMTP Required)

```bash
# Build the tool
go build -o weekly-email ./cmd/weekly-email/main.go

# Generate preview
./weekly-email \
  --maintainers=pkg/config/maintainers.yaml \
  --preview > preview.html

# Open in browser
open preview.html
```

### 3. Test with Dry Run

Set SMTP credentials:

```bash
export SMTP_USERNAME="your-email@gmail.com"
export SMTP_PASSWORD="your-app-password"
```

Run dry-run mode:

```bash
./weekly-email \
  --maintainers=pkg/config/maintainers.yaml \
  --dry-run
```

### 4. Send Test Email

```bash
./weekly-email \
  --maintainers=pkg/config/maintainers.yaml \
  --email=your-test-email@example.com \
  --confirm
```

## Configuration

### Maintainers Configuration

The `maintainers.yaml` file maps repositories to maintainer email addresses.

**Structure:**

```yaml
maintainers:
  - org: string          # GitHub organization
    repo: string         # Repository name
    email: string        # Maintainer email address
    name: string         # Maintainer name (for personalization)

cc_emails:               # Optional: emails to CC on all reports
  - string

smtp:
  server: string         # SMTP server hostname
  port: integer          # SMTP port (usually 587 for TLS)
  from_email: string     # Email address to send from
  from_name: string      # Display name for sender
```

**Notes:**
- Multiple repos can have the same email (results in one consolidated email)
- Multiple emails can be assigned to the same repo (each gets a separate email)
- SMTP credentials (`SMTP_USERNAME` and `SMTP_PASSWORD`) are read from environment variables

### SMTP Configuration

#### Gmail

1. Enable 2-Factor Authentication on your Gmail account
2. Create App Password: https://myaccount.google.com/apppasswords
3. Use these settings:

```yaml
smtp:
  server: smtp.gmail.com
  port: 587
  from_email: your-email@gmail.com
  from_name: Konveyor Health Reports
```

```bash
export SMTP_USERNAME="your-email@gmail.com"
export SMTP_PASSWORD="your-16-char-app-password"
```

#### SendGrid

```yaml
smtp:
  server: smtp.sendgrid.net
  port: 587
  from_email: noreply@yourdomain.com
  from_name: Konveyor Health Reports
```

```bash
export SMTP_USERNAME="apikey"
export SMTP_PASSWORD="your-sendgrid-api-key"
```

#### Office 365

```yaml
smtp:
  server: smtp.office365.com
  port: 587
  from_email: your-email@company.com
  from_name: Konveyor Health Reports
```

```bash
export SMTP_USERNAME="your-email@company.com"
export SMTP_PASSWORD="your-password"
```

## CLI Usage

### Command-line Flags

```bash
weekly-email [flags]

Flags:
  --maintainers string   Path to maintainers.yaml (default: pkg/config/maintainers.yaml)
  --confirm             Actually send emails (required for production)
  --dry-run             Generate emails but don't send them
  --preview             Output single email HTML to stdout and exit
  --email string        Filter to specific maintainer email (for testing)
  --repo string         Filter to specific repository org/repo (for testing)
  --log-level string    Log level: debug, info, warn, error (default: info)
```

### Examples

**Preview mode** (no SMTP needed):
```bash
./weekly-email --maintainers=pkg/config/maintainers.yaml --preview > email.html
```

**Dry-run mode** (generates but doesn't send):
```bash
./weekly-email --maintainers=pkg/config/maintainers.yaml --dry-run
```

**Send test email** to one address:
```bash
./weekly-email \
  --maintainers=pkg/config/maintainers.yaml \
  --email=test@example.com \
  --confirm
```

**Production mode** (send to all maintainers):
```bash
./weekly-email --maintainers=pkg/config/maintainers.yaml --confirm
```

**Debug logging:**
```bash
./weekly-email \
  --maintainers=pkg/config/maintainers.yaml \
  --dry-run \
  --log-level=debug
```

## GitHub Actions Deployment

### Setup

1. **Add GitHub Secrets:**
   - Go to: Settings → Secrets and variables → Actions
   - Add `SMTP_USERNAME` and `SMTP_PASSWORD`

2. **Commit configuration:**
   ```bash
   git add pkg/config/maintainers.yaml
   git commit -s -m "Add maintainers configuration"
   git push
   ```

3. **The workflow is already created** at `.github/workflows/send-weekly-emails.yml`

### Workflow Schedule

The workflow runs automatically:
- **Schedule:** Every Monday at 9:00 AM UTC
- **Cron:** `0 9 * * 1`

### Manual Trigger

You can manually trigger the workflow:

1. Go to **Actions** tab in GitHub
2. Select **"Send Weekly Repository Health Emails"**
3. Click **"Run workflow"**
4. Options:
   - **Dry run:** Test without sending emails
   - **Test email:** Send to a specific address only
   - **Log level:** Adjust logging verbosity

### Workflow Inputs

When manually triggering:

- `dry_run` (boolean) - Generate emails but don't send
- `test_email` (string) - Send only to this email address
- `log_level` (choice) - debug, info, warn, error

## Email Content

### Sections

Each email includes the following sections (when data is available):

#### 1. Executive Summary (Multi-repo Maintainers)
Only shown when a maintainer has multiple repositories:
- Total repositories
- Total stale items across all repos
- Total new contributors across all repos

#### 2. Stale Issues & PRs (Per Repository)
- Total stale items count
- Stale issues count
- Stale PRs count
- Week-over-week trend (↑ increase, ↓ decrease, → no change)
- List of stale items (up to 10) with:
  - Issue/PR number and title
  - Author
  - Last update date

#### 3. Community Health (Per Repository)
- Contributors (90-day period)
- New contributors (30-day period)
- Average issue response time
- Average PR response time
- PR merge rate (percentage)
- Open issues count
- Open PRs count
- List of new contributor usernames

#### 4. Security & Coverage (Per Repository)
**Only shown if data exists**

- Snyk vulnerabilities by severity:
  - Critical (red badge)
  - High (orange badge)
  - Medium (yellow badge)
  - Low (gray badge)
- Code coverage percentage (from Codecov)

#### 5. Quick Links
- Repository on GitHub
- Stale items dashboard
- Community insights (GitHub Pulse)

### Formatting

- **Response times:**
  - < 1 hour: Shown in minutes (e.g., "7m")
  - ≥ 1 hour: Shown in hours (e.g., "2.5h")

- **Trends:**
  - ↑ Red arrow for increases (bad for stale items)
  - ↓ Green arrow for decreases (good for stale items)
  - → Gray arrow for no change

- **Percentages:**
  - Shown with % sign (e.g., "88%")
  - Color-coded in HTML version

## Data Sources

The weekly email aggregates data from:

1. **Community Health Dashboard**
   - Location: `community-health-dashboard/data/history/YYYY-MM-DD.json`
   - Collected: Daily at 3:00 AM UTC
   - Metrics: Contributors, response times, PR merge rates, coverage, security

2. **Stale Dashboard**
   - Location: `stale-dashboard/data/history/YYYY-MM-DD.json`
   - Collected: Daily at 2:00 AM UTC
   - Metrics: Stale issues and PRs

### Trend Calculation

Week-over-week trends compare:
- **Current week:** Most recent data snapshot
- **Previous week:** Data from 7 days ago

Example:
- Current stale issues: 42 (from 2025-11-22.json)
- Previous week: 39 (from 2025-11-15.json)
- Trend: ↑ +3 (+7.7%)

### Data Requirements

Minimum data requirements:
- At least **7 days** of historical data for basic reports
- At least **14 days** of data for week-over-week trends

If insufficient data exists:
- Email still sends with available data
- Trend indicators show "No trend data available"

## Troubleshooting

### No historical data available

**Problem:** Error message "no historical data available"

**Solution:**
- Verify data files exist:
  ```bash
  ls community-health-dashboard/data/history/
  ls stale-dashboard/data/history/
  ```
- Ensure data collection workflows have run at least once
- Check workflow logs in GitHub Actions

### SMTP connection failed

**Problem:** "failed to connect to SMTP server"

**Solutions:**
- Verify SMTP credentials are correct
- For Gmail: Use App Password, not regular password
- Check SMTP server and port settings
- Test with a different SMTP provider

### Template execution errors

**Problem:** "failed to execute HTML template"

**Solutions:**
- Check that data files match expected JSON structure
- Look for null/missing fields in recent data snapshots
- Enable debug logging: `--log-level=debug`

### Email not received

**Checklist:**
- [ ] Check spam/junk folder
- [ ] Verify email address in `maintainers.yaml`
- [ ] Check GitHub Actions logs for errors
- [ ] Test with dry-run mode first
- [ ] Try sending to a different email address
- [ ] Verify SMTP credentials are in GitHub Secrets

### Rate limiting

**Problem:** Too many emails sent too quickly

**Solution:**
- The tool includes built-in retry logic (3 attempts with exponential backoff)
- SMTP providers typically allow 100-500 emails per day
- For large numbers of maintainers, consider using a transactional email service (SendGrid, AWS SES)

## Development

### Project Structure

```
release-tools/
├── cmd/weekly-email/
│   └── main.go                    # CLI entry point
├── pkg/
│   ├── config/
│   │   ├── maintainers.yaml       # Maintainer configuration
│   │   ├── maintainers.yaml.example
│   │   ├── config.go              # Config loading functions
│   │   └── types.go               # Config type definitions
│   └── email/
│       ├── aggregator.go          # Data loading and aggregation
│       ├── reporter.go            # Email generation orchestration
│       ├── smtp.go                # SMTP client with retry logic
│       ├── template.go            # Template rendering
│       └── types.go               # Email data structures
├── templates/email/
│   ├── weekly-report.html         # HTML email template
│   └── weekly-report.txt          # Plain text template
└── .github/workflows/
    └── send-weekly-emails.yml     # Automated workflow

```

### Building

```bash
# Standard build
go build -o weekly-email ./cmd/weekly-email/main.go

# With Go workspace
GOWORK=off go build -o weekly-email ./cmd/weekly-email/main.go
```

### Dependencies

Key dependencies:
- `github.com/wneessen/go-mail` - SMTP client with TLS support
- `github.com/sirupsen/logrus` - Structured logging
- `gopkg.in/yaml.v2` - YAML configuration parsing

### Testing

**Unit testing:**
```bash
go test ./pkg/email/...
```

**Integration testing:**
```bash
# Preview mode (no side effects)
./weekly-email --maintainers=test-maintainers.yaml --preview

# Dry-run (validates everything except sending)
./weekly-email --maintainers=test-maintainers.yaml --dry-run
```

## FAQ

### Can I customize the email template?

Yes! Edit these files:
- `templates/email/weekly-report.html` - HTML version
- `templates/email/weekly-report.txt` - Plain text version

After editing, rebuild the tool and test with preview mode.

### Can I change the email schedule?

Yes! Edit `.github/workflows/send-weekly-emails.yml`:

```yaml
on:
  schedule:
    - cron: '0 9 * * 1'  # Monday at 9 AM UTC
    # Change to:
    - cron: '0 15 * * 5'  # Friday at 3 PM UTC
```

### Can I send to multiple emails per repository?

Yes! Just add multiple maintainer entries with the same repo:

```yaml
maintainers:
  - org: konveyor
    repo: analyzer-lsp
    email: lead@example.com
    name: Lead Maintainer

  - org: konveyor
    repo: analyzer-lsp
    email: co-maintainer@example.com
    name: Co-Maintainer
```

Each will receive their own email.

### How do I unsubscribe a maintainer?

Remove their entry from `maintainers.yaml` and commit the change.

### Can I add more metrics to the email?

Yes! The data is available in the JSON files. You can:

1. Update `pkg/email/types.go` to include new fields
2. Update `pkg/email/aggregator.go` to extract the data
3. Update the email templates to display it
4. Rebuild and test

## Support

For issues, questions, or contributions:
- **Issues:** https://github.com/konveyor/release-tools/issues
- **Documentation:** This file and README.md
- **Source Code:** https://github.com/konveyor/release-tools

## License

Same as the parent project (release-tools).
