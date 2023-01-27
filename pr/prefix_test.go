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
			expectedType:  NonePR,
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
			title:         "WIP: :seedling: Infrastructure change",
			expectedType:  InfraPR,
			expectedTitle: "Infrastructure change",
			expectedError: nil,
		},
		{
			title:         "WIP: No prefix in title",
			expectedType:  NonePR,
			expectedTitle: "No prefix in title",
			expectedError: PRTypeError{title: "No prefix in title"},
		},
		{
			title:         "No prefix in title",
			expectedType:  NonePR,
			expectedTitle: "No prefix in title",
			expectedError: PRTypeError{title: "No prefix in title"},
		},
		{
			title:         "WIP:",
			expectedType:  NonePR,
			expectedTitle: "",
			expectedError: PRTypeError{title: ""},
		},
		{
			title:         "",
			expectedType:  NonePR,
			expectedTitle: "",
			expectedError: PRTypeError{title: ""},
		},
		{
			title:         "WIP: [tag] :sparkles: Add new feature",
			expectedType:  FeaturePR,
			expectedTitle: "Add new feature",
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
