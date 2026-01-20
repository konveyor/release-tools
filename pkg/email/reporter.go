package email

import (
	"fmt"

	"github.com/konveyor/release-tools/pkg/config"
	"github.com/konveyor/release-tools/pkg/goals"
	"github.com/sirupsen/logrus"
)

// ReportOptions contains options for generating and sending reports
type ReportOptions struct {
	DryRun      bool   // Generate emails but don't send
	Preview     bool   // Output single email to stdout
	FilterEmail string // Filter to specific maintainer email
	FilterRepo  string // Filter to specific repo (org/repo format)
}

// GenerateAndSendWeeklyReports is the main orchestration function
func GenerateAndSendWeeklyReports(
	maintainerConfig *config.MaintainerConfig,
	options ReportOptions,
) error {
	logrus.WithFields(logrus.Fields{
		"dry_run":      options.DryRun,
		"preview":      options.Preview,
		"filter_email": options.FilterEmail,
		"filter_repo":  options.FilterRepo,
	}).Info("Starting weekly email report generation")

	// Load historical data (last 14 days for trend calculation)
	data, err := LoadHistoricalData(14)
	if err != nil {
		return fmt.Errorf("failed to load historical data: %w", err)
	}

	// Generate email reports for all maintainers
	reports, err := GenerateEmailReports(maintainerConfig, data)
	if err != nil {
		return fmt.Errorf("failed to generate email reports: %w", err)
	}

	// Keep all reports for summary generation (even when filtering individual emails)
	allReports := reports

	// Apply filters if specified (for individual email sending only)
	if options.FilterEmail != "" {
		if report, ok := reports[options.FilterEmail]; ok {
			reports = map[string]*EmailReport{options.FilterEmail: report}
			logrus.WithField("email", options.FilterEmail).Info("Filtered to specific email")
		} else {
			return fmt.Errorf("no report found for email: %s", options.FilterEmail)
		}
	}

	// Preview mode: output single email and exit
	if options.Preview {
		if len(reports) == 0 {
			return fmt.Errorf("no reports to preview")
		}

		// Get first report
		var firstReport *EmailReport
		for _, report := range reports {
			firstReport = report
			break
		}

		htmlBody, err := RenderHTMLEmail(firstReport)
		if err != nil {
			return fmt.Errorf("failed to render HTML email: %w", err)
		}

		fmt.Println(htmlBody)
		return nil
	}

	// Create SMTP sender (unless dry-run)
	var sender *EmailSender
	if !options.DryRun {
		sender, err = NewEmailSender(maintainerConfig.SMTP)
		if err != nil {
			return fmt.Errorf("failed to create email sender: %w", err)
		}

		// Test connection
		if err := sender.TestConnection(); err != nil {
			return fmt.Errorf("SMTP connection test failed: %w", err)
		}
	}

	// Send individual maintainer emails (without CC)
	sentCount := 0
	failedCount := 0

	for email, report := range reports {
		logrus.WithFields(logrus.Fields{
			"email": email,
			"repos": len(report.Repos),
		}).Info("Processing email report")

		// Render email templates
		htmlBody, err := RenderHTMLEmail(report)
		if err != nil {
			logrus.WithError(err).WithField("email", email).Error("Failed to render HTML email")
			failedCount++
			continue
		}

		textBody, err := RenderTextEmail(report)
		if err != nil {
			logrus.WithError(err).WithField("email", email).Error("Failed to render text email")
			failedCount++
			continue
		}

		subject := fmt.Sprintf("[Konveyor Health] Weekly Report - Week ending %s", report.WeekEnding)

		// Dry-run mode: log but don't send
		if options.DryRun {
			logrus.WithFields(logrus.Fields{
				"to":          email,
				"subject":     subject,
				"repos":       len(report.Repos),
				"total_stale": report.TotalStale,
			}).Info("[DRY RUN] Would send email")
			sentCount++
			continue
		}

		// Send email without CC (CC recipients will receive summary email instead)
		if err := sender.SendEmail(email, subject, htmlBody, textBody, nil); err != nil {
			logrus.WithError(err).WithField("email", email).Error("Failed to send email")
			failedCount++
			continue
		}

		sentCount++
	}

	// Generate and send summary email to CC recipients
	// Always use allReports so summary includes all maintainers even when filtering individual emails
	if len(maintainerConfig.CCEmails) > 0 && len(allReports) > 0 {
		logrus.WithField("cc_count", len(maintainerConfig.CCEmails)).Info("Generating summary email for CC recipients")

		// Get goals progress from first report (same for all maintainers)
		var goalsProgress *goals.GoalsProgress
		for _, report := range allReports {
			goalsProgress = report.GoalsProgress
			break
		}

		summaryReport := GenerateSummaryReport(allReports, goalsProgress)

		// Render summary email templates
		summaryHTMLBody, err := RenderSummaryHTMLEmail(summaryReport)
		if err != nil {
			logrus.WithError(err).Error("Failed to render summary HTML email")
			failedCount += len(maintainerConfig.CCEmails) // Count failure for all CC recipients
		} else {
			summaryTextBody, err := RenderSummaryTextEmail(summaryReport)
			if err != nil {
				logrus.WithError(err).Error("Failed to render summary text email")
				failedCount += len(maintainerConfig.CCEmails) // Count failure for all CC recipients
			} else {
				summarySubject := fmt.Sprintf("[Konveyor Health] Team Summary - Week ending %s", summaryReport.WeekEnding)

				// Send summary email to each CC recipient
				for _, ccEmail := range maintainerConfig.CCEmails {
					if options.DryRun {
						logrus.WithFields(logrus.Fields{
							"to":                  ccEmail,
							"subject":             summarySubject,
							"total_maintainers":   summaryReport.TotalMaintainers,
							"total_repos":         summaryReport.TotalRepos,
							"total_stale_items":   summaryReport.TotalStaleItems,
						}).Info("[DRY RUN] Would send summary email")
						sentCount++
					} else {
						if err := sender.SendEmail(ccEmail, summarySubject, summaryHTMLBody, summaryTextBody, nil); err != nil {
							logrus.WithError(err).WithField("email", ccEmail).Error("Failed to send summary email")
							failedCount++
						} else {
							logrus.WithField("email", ccEmail).Info("Sent summary email to CC recipient")
							sentCount++
						}
					}
				}
			}
		}
	}

	// Log summary
	totalExpected := len(reports)
	if len(allReports) > 0 && len(maintainerConfig.CCEmails) > 0 {
		totalExpected += len(maintainerConfig.CCEmails)
	}
	logrus.WithFields(logrus.Fields{
		"sent":   sentCount,
		"failed": failedCount,
		"total":  totalExpected,
	}).Info("Email report generation completed")

	if failedCount > 0 {
		return fmt.Errorf("failed to send %d emails", failedCount)
	}

	return nil
}
