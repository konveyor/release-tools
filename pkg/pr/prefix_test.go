package pr

import (
	"testing"
)

func TestTypeFromTitle(t *testing.T) {
	testCases := []struct {
		title         string
		expectedType  PRType
		expectedTitle string
		expectedError error
	}{
		{
			title:         "WIP: [docs] Update documentation",
			expectedType:  UnknownPR,
			expectedTitle: "Update documentation",
			expectedError: PRTypeError{title: "Update documentation"},
		},
		{
			title:         "WIP: :sparkles: Add new feature",
			expectedType:  FeaturePR,
			expectedTitle: "Add new feature",
			expectedError: nil,
		},
		{
			title:         "WIP: :warning: Breaking change",
			expectedType:  BreakingPR,
			expectedTitle: "Breaking change",
			expectedError: nil,
		},
		{
			title:         "WIP: :bug: Fix bug",
			expectedType:  BugFixPR,
			expectedTitle: "Fix bug",
			expectedError: nil,
		},
		{
			title:         ":ghost: Don't put me in release notes",
			expectedType:  NoNotePR,
			expectedTitle: "Don't put me in release notes",
			expectedError: nil,
		},
		{
			title:         "WIP: :seedling: Infrastructure change",
			expectedType:  InfraPR,
			expectedTitle: "Infrastructure change",
			expectedError: nil,
		},
		{
			title:         "WIP: No prefix in title",
			expectedType:  UnknownPR,
			expectedTitle: "No prefix in title",
			expectedError: PRTypeError{title: "No prefix in title"},
		},
		{
			title:         "No prefix in title",
			expectedType:  UnknownPR,
			expectedTitle: "No prefix in title",
			expectedError: PRTypeError{title: "No prefix in title"},
		},
		{
			title:         "WIP:",
			expectedType:  UnknownPR,
			expectedTitle: "",
			expectedError: PRTypeError{title: ""},
		},
		{
			title:         "",
			expectedType:  UnknownPR,
			expectedTitle: "",
			expectedError: PRTypeError{title: ""},
		},
		{
			title:         "WIP: [tag] :sparkles: Add new feature",
			expectedType:  FeaturePR,
			expectedTitle: "Add new feature",
			expectedError: nil,
		},
		{
			title:         "👻 I should have used the alias",
			expectedType:  UnknownPR,
			expectedTitle: "👻 I should have used the alias",
			expectedError: PRTypeUsedEmojiError{
				PRTypeError: PRTypeError{title: "👻 I should have used the alias"},
				emojiUsed:   rune('👻'),
			},
		},
		{
			title:         "WIP: :test_tube: Integration test",
			expectedType:  TestPR,
			expectedTitle: "Integration test",
			expectedError: nil,
		},
		{
			title:         ":test_tube: Integration test",
			expectedType:  TestPR,
			expectedTitle: "Integration test",
			expectedError: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.title, func(t *testing.T) {
			typ, title, err := TypeFromTitle(tc.title)
			if typ != tc.expectedType {
				t.Errorf("Expected PR type %q but got %q", tc.expectedType, typ)
			}
			if title != tc.expectedTitle {
				t.Errorf("Expected title %q but got %q", tc.expectedTitle, title)
			}
			if err != tc.expectedError {
				t.Errorf("Expected error %q but got %q", tc.expectedError, err)
			}
		})
	}
}
