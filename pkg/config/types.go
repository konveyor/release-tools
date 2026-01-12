package config

// Configuration is a representation of the repositories we will manage
// + their Labels
// + their Milestons
type Configuration struct {
	Repos      []Repo      `json:"repos"`
	Labels     []Label     `json:"labels"`
	Milestones []Milestone `json:"milestone"`
}

// Repo represents the "coordinates" to a repository
type Repo struct {
	Org  string `json:"org"`
	Repo string `json:"repo"`
}

// Label holds declarative data about the label.
type Label struct {
	// Name is the current name of the label
	Name string `json:"name"`
	// Color is rrggbb or color
	Color string `json:"color"`
	// Description is brief text explaining its meaning, who can apply it
	Description string `json:"description"`
	// TODO(djzager): Consider using these if/when we need it
	// // Target specifies whether it targets PRs, issues or both
	// Target LabelTarget `json:"target"`
	// // ProwPlugin specifies which prow plugin add/removes this label
	// ProwPlugin string `json:"prowPlugin"`
	// // IsExternalPlugin specifies if the prow plugin is external or not
	// IsExternalPlugin bool `json:"isExternalPlugin"`
	// // AddedBy specifies whether human/munger/bot adds the label
	// AddedBy string `json:"addedBy"`
	// // Previously lists deprecated names for this label
	// Previously []Label `json:"previously,omitempty"`
	// // DeleteAfter specifies the label is retired and a safe date for deletion
	// DeleteAfter *time.Time `json:"deleteAfter,omitempty"`
	// parent      *Label     // Current name for previous labels (used internally)
}

// Milestone holds declarative data about the milestone.
type Milestone struct {
	Number      int    `json:"number,omitempty"`
	Title       string `json:"title"`
	Description string `json:"description"`
	State       string `json:"state"`
	Due         string `json:"due"`
	Replaces    string `json:"replaces"`
}

// MaintainerConfig holds configuration for weekly email notifications to maintainers
type MaintainerConfig struct {
	Maintainers []Maintainer `json:"maintainers" yaml:"maintainers"`
	CCEmails    []string     `json:"cc_emails" yaml:"cc_emails"`
	SMTP        SMTPConfig   `json:"smtp" yaml:"smtp"`
}

// Maintainer represents a repository maintainer who receives weekly health reports
type Maintainer struct {
	Org   string `json:"org" yaml:"org"`
	Repo  string `json:"repo" yaml:"repo"`
	Email string `json:"email" yaml:"email"`
	Name  string `json:"name" yaml:"name"`
}

// SMTPConfig holds SMTP server configuration for sending emails
type SMTPConfig struct {
	Server    string `json:"server" yaml:"server"`
	Port      int    `json:"port" yaml:"port"`
	FromEmail string `json:"from_email" yaml:"from_email"`
	FromName  string `json:"from_name" yaml:"from_name"`
}
