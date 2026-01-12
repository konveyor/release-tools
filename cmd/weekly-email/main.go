package main

import (
	"flag"

	"github.com/konveyor/release-tools/pkg/config"
	"github.com/konveyor/release-tools/pkg/email"
	"github.com/sirupsen/logrus"
)

var (
	maintainersPath = flag.String("maintainers", "pkg/config/maintainers.yaml", "Path to maintainers configuration file")
	confirm         = flag.Bool("confirm", false, "Actually send emails (required for production)")
	dryRun          = flag.Bool("dry-run", false, "Generate emails but don't send them")
	preview         = flag.Bool("preview", false, "Output a single email HTML to stdout and exit")
	filterEmail     = flag.String("email", "", "Filter to specific maintainer email (for testing)")
	filterRepo      = flag.String("repo", "", "Filter to specific repository org/repo (for testing)")
	logLevel        = flag.String("log-level", "info", "Log level (debug, info, warn, error)")
)

func main() {
	flag.Parse()

	// Configure logging
	level, err := logrus.ParseLevel(*logLevel)
	if err != nil {
		logrus.WithError(err).Fatal("Invalid log level")
	}
	logrus.SetLevel(level)
	logrus.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	logrus.Info("Starting weekly email report tool")

	// Validate flags
	if !*confirm && !*dryRun && !*preview {
		logrus.Fatal("Must specify either --confirm, --dry-run, or --preview")
	}

	if *confirm && *dryRun {
		logrus.Fatal("Cannot specify both --confirm and --dry-run")
	}

	if *preview && (*confirm || *dryRun) {
		logrus.Fatal("Cannot use --preview with --confirm or --dry-run")
	}

	// Load maintainer configuration
	logrus.WithField("path", *maintainersPath).Info("Loading maintainer configuration")
	maintainerConfig, err := config.LoadMaintainerConfig(*maintainersPath)
	if err != nil {
		logrus.WithError(err).Fatal("Failed to load maintainer configuration")
	}

	logrus.WithFields(logrus.Fields{
		"maintainers": len(maintainerConfig.Maintainers),
		"cc_emails":   len(maintainerConfig.CCEmails),
		"smtp_server": maintainerConfig.SMTP.Server,
	}).Info("Maintainer configuration loaded")

	// Prepare options
	options := email.ReportOptions{
		DryRun:      *dryRun,
		Preview:     *preview,
		FilterEmail: *filterEmail,
		FilterRepo:  *filterRepo,
	}

	// Generate and send reports
	if err := email.GenerateAndSendWeeklyReports(maintainerConfig, options); err != nil {
		logrus.WithError(err).Fatal("Failed to generate and send weekly reports")
	}

	if *dryRun {
		logrus.Info("Dry run completed successfully")
	} else if *preview {
		logrus.Info("Preview completed successfully")
	} else {
		logrus.Info("Weekly reports sent successfully")
	}
}
