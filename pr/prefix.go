// Motivated by, and largely copied from,
// https://github.com/kubernetes-sigs/kubebuilder-release-tools
package pr

import (
	"regexp"
	"strings"
)

type PRType string

const (
	UnknownPR  PRType = ""
	FeaturePR  PRType = "feature"
	BugFixPR   PRType = "bugfix"
	DocsPR     PRType = "docs"
	InfraPR    PRType = "infra"
	BreakingPR PRType = "breaking"
	NoNotePR   PRType = "nonote"

	// TODO(djzager): Should we allow emoji?
	PrefixFeature  string = ":sparkles:"
	PrefixBugFix   string = ":bug:"
	PrefixDocs     string = ":book:"
	PrefixInfra    string = ":seedling:"
	PrefixBreaking string = ":warning:"
	PrefixNoNote   string = ":ghost:"

	emojiFeature  = string('✨')
	emojiBugFix   = string('🐛')
	emojiDocs     = string('📖')
	emojiInfra    = string('🌱')
	emojiBreaking = string('⚠')
	emojiNoNote   = string('👻')
)

// Extracted from kubernetes/test-infra/prow/plugins/wip/wip-label.go
var wipRegex = regexp.MustCompile(`(?i)^\W?WIP\W`)

var tagRegex = regexp.MustCompile(`^\[[\w-\.]*\]`)

// TypeFromTitle returns the type of PR and the title without prefix.
func TypeFromTitle(title string) (PRType, string, error) {
	// Remove the WIP prefix if found.
	title = wipRegex.ReplaceAllString(title, "")

	// Trim to remove spaces after WIP.
	title = strings.TrimSpace(title)

	// Remove a tag prefix if found.
	title = tagRegex.ReplaceAllString(title, "")
	title = strings.TrimSpace(title)

	if len(title) == 0 {
		return UnknownPR, title, PRTypeError{title: title}
	}

	var prType PRType
	switch {
	case strings.HasPrefix(title, PrefixFeature):
		title = strings.TrimPrefix(title, PrefixFeature)
		prType = FeaturePR
	case strings.HasPrefix(title, PrefixBugFix):
		title = strings.TrimPrefix(title, PrefixBugFix)
		prType = BugFixPR
	case strings.HasPrefix(title, PrefixDocs):
		title = strings.TrimPrefix(title, PrefixDocs)
		prType = DocsPR
	case strings.HasPrefix(title, PrefixInfra):
		title = strings.TrimPrefix(title, PrefixInfra)
		prType = InfraPR
	case strings.HasPrefix(title, PrefixBreaking):
		title = strings.TrimPrefix(title, PrefixBreaking)
		prType = BreakingPR
	case strings.HasPrefix(title, PrefixNoNote):
		title = strings.TrimPrefix(title, PrefixNoNote)
		prType = NoNotePR
	default:
		if strings.HasPrefix(title, emojiFeature) ||
			strings.HasPrefix(title, emojiBugFix) ||
			strings.HasPrefix(title, emojiDocs) ||
			strings.HasPrefix(title, emojiInfra) ||
			strings.HasPrefix(title, emojiBreaking) ||
			strings.HasPrefix(title, emojiNoNote) {
			return UnknownPR, title, PRTypeUsedEmojiError{
				PRTypeError: PRTypeError{title: title},
				emojiUsed: []rune(title)[0],
			}
		}
		return UnknownPR, title, PRTypeError{title: title}
	}

	// Trusting those that came before...
	// https://github.com/kubernetes-sigs/kubebuilder-release-tools/blob/4f3d1085b4458a49ed86918b4b55505716715b77/notes/common/prefix.go#L123-L125
	// strip the variation selector from the title, if present
	// (some systems sneak it in -- my guess is OSX)
	title = strings.TrimPrefix(title, "\uFE0F")

	return prType, strings.TrimSpace(title), nil
}
