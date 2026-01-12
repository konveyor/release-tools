package email

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	textTemplate "text/template"
)

// RenderHTMLEmail renders the HTML email template
func RenderHTMLEmail(report *EmailReport) (string, error) {
	tmplContent, err := os.ReadFile("templates/email/weekly-report.html")
	if err != nil {
		return "", fmt.Errorf("failed to read HTML template: %w", err)
	}

	funcMap := template.FuncMap{
		"divideMs": func(ms int64) float64 {
			return float64(ms) / 3600000.0 // Convert ms to hours
		},
	}

	tmpl, err := template.New("email").Funcs(funcMap).Parse(string(tmplContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse HTML template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, report); err != nil {
		return "", fmt.Errorf("failed to execute HTML template: %w", err)
	}

	return buf.String(), nil
}

// RenderTextEmail renders the plain text email template
func RenderTextEmail(report *EmailReport) (string, error) {
	tmplContent, err := os.ReadFile("templates/email/weekly-report.txt")
	if err != nil {
		return "", fmt.Errorf("failed to read text template: %w", err)
	}

	funcMap := textTemplate.FuncMap{
		"divideMs": func(ms int64) float64 {
			return float64(ms) / 3600000.0 // Convert ms to hours
		},
	}

	tmpl, err := textTemplate.New("email").Funcs(funcMap).Parse(string(tmplContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse text template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, report); err != nil {
		return "", fmt.Errorf("failed to execute text template: %w", err)
	}

	return buf.String(), nil
}

// FormatDuration formats milliseconds into a human-readable duration
func FormatDuration(ms int64) string {
	hours := float64(ms) / 3600000.0
	if hours < 1.0 {
		minutes := float64(ms) / 60000.0
		return fmt.Sprintf("%.0fm", minutes)
	}
	return fmt.Sprintf("%.1fh", hours)
}

// FormatTrend formats a trend with an arrow indicator
func FormatTrend(trend TrendMetrics) string {
	var arrow string
	switch trend.Direction {
	case "up":
		arrow = "↑"
	case "down":
		arrow = "↓"
	default:
		arrow = "→"
	}

	if trend.Direction == "same" {
		return fmt.Sprintf("%s No change", arrow)
	}

	return fmt.Sprintf("%s %d (%.1f%%)", arrow, trend.Absolute, trend.Percent)
}

// FormatPercentChange formats a percentage change with sign
func FormatPercentChange(percent float64) string {
	if percent > 0 {
		return fmt.Sprintf("+%.1f%%", percent)
	} else if percent < 0 {
		return fmt.Sprintf("%.1f%%", percent)
	}
	return "0%"
}
