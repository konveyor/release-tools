package pr

import (
	"fmt"
)

var emojiAliasMap = map[string]string{
	emojiFeature:  PrefixFeature,
	emojiBugFix:   PrefixBugFix,
	emojiDocs:     PrefixDocs,
	emojiInfra:    PrefixInfra,
	emojiBreaking: PrefixBreaking,
	emojiNoNote:   PrefixNoNote,
}

type PRTypeError struct {
	title string
}

func (e PRTypeError) Error() string {
	return fmt.Sprintf(`No matching PR type indicator found in title.

I saw a title of %#q, which doesn't seem to have any of the acceptable prefixes.

You need to have one of these as the prefix of your PR title:
- Breaking change: (%#q)
- Non-breaking feature: (%#q)
- Bug fix: (%#q)
- Docs: (%#q)
- Infra/Tests/Other: (%#q)
- No release note: (%#q)

More details can be found at [konveyor/release-tools/VERSIONING.md](https://github.com/konveyor/release-tools/VERSIONING.md).`,
		e.title, PrefixBreaking, PrefixFeature, PrefixBugFix, PrefixDocs, PrefixInfra, PrefixNoNote)
}

type PRTypeUsedEmojiError struct {
	PRTypeError
	emojiUsed rune
}

func (e PRTypeUsedEmojiError) Error() string {
	alias, _ := emojiAliasMap[string(e.emojiUsed)]
	return fmt.Sprintf(`Looks like you used an emoji character, %#q instead of it's alias %#q.

Please use the alias %#q instead.

%s`, e.emojiUsed, alias, alias, e.PRTypeError.Error())
}
