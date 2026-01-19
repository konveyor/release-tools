package email

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"strings"
	textTemplate "text/template"
	"time"
)

// RenderHTMLEmail renders the HTML email template
func RenderHTMLEmail(report *EmailReport) (string, error) {
	tmplContent, err := os.ReadFile("templates/email/weekly-report.html")
	if err != nil {
		return "", fmt.Errorf("failed to read HTML template: %w", err)
	}

	funcMap := template.FuncMap{
		"divideMs": func(ms float64) float64 {
			return ms / 3600000.0 // Convert ms to hours
		},
		"formatDuration": FormatDuration,
		"formatHours": FormatHours,
		"abs": func(n int) int {
			if n < 0 {
				return -n
			}
			return n
		},
		"absFloat": func(f float64) float64 {
			if f < 0 {
				return -f
			}
			return f
		},
		"derefFloat": func(f *float64) float64 {
			if f == nil {
				return 0
			}
			return *f
		},
		"upper": func(s string) string {
			return strings.ToUpper(s)
		},
		"urgencyIndicator": UrgencyIndicator,
		"urgencyColor":     UrgencyColor,
		"formatDate":       FormatDate,
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
		"divideMs": func(ms float64) float64 {
			return ms / 3600000.0 // Convert ms to hours
		},
		"formatDuration": FormatDuration,
		"formatHours": FormatHours,
		"abs": func(n int) int {
			if n < 0 {
				return -n
			}
			return n
		},
		"absFloat": func(f float64) float64 {
			if f < 0 {
				return -f
			}
			return f
		},
		"derefFloat": func(f *float64) float64 {
			if f == nil {
				return 0
			}
			return *f
		},
		"upper": func(s string) string {
			return strings.ToUpper(s)
		},
		"urgencyIndicator": UrgencyIndicator,
		"urgencyColor":     UrgencyColor,
		"formatDate":       FormatDate,
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
func FormatDuration(ms float64) string {
	hours := ms / 3600000.0
	if hours < 1.0 {
		minutes := ms / 60000.0
		return fmt.Sprintf("%.0fm", minutes)
	}
	if hours >= 48.0 {
		days := hours / 24.0
		return fmt.Sprintf("%.1fd", days)
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

// FormatHours formats hours into a human-readable duration
// Converts to days when > 48 hours for better readability
func FormatHours(hours int) string {
	if hours >= 48 {
		days := hours / 24
		return fmt.Sprintf("%d days", days)
	}
	return fmt.Sprintf("%dh", hours)
}

// UrgencyIndicator returns an emoji indicator based on days since activity
// 🔴 Urgent (>30 days), 🟡 Attention (7-30 days), ⚪ Recent (<7 days)
func UrgencyIndicator(days int) string {
	if days > 30 {
		return "🔴"
	} else if days >= 7 {
		return "🟡"
	}
	return "⚪"
}

// UrgencyColor returns a color code based on days since activity
func UrgencyColor(days int) string {
	if days > 30 {
		return "#d73a49" // Red
	} else if days >= 7 {
		return "#d97706" // Orange
	}
	return "#6a737d" // Gray
}

// FormatDate formats a time.Time as YYYY-MM-DD for use in GitHub search URLs
func FormatDate(t time.Time) string {
	return t.Format("2006-01-02")
}
