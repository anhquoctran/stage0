# Welcome handwriting artwork

These JSON assets contain ordered pen centerlines, not font outlines. Each path
is one pen-down stroke. Translation catalogs remain the source for the accessible
greeting and UI text; the artwork is the visual lettering of those greetings.

- `latin.json`: original Stage0 lettering for English, Vietnamese, Spanish,
  Portuguese, German, French and Italian. Vietnamese/Portuguese accents and dots
  are separate strokes. The original English Hello drawing is retained.
- `cyrillic.json`, `korean.json`, `arabic.json`: original Stage0 centerlines.
  Cyrillic uses cursive letterforms; Hangul is written syllable by syllable;
  Arabic paths follow connected right-to-left writing with separate diacritics.
- `cjk.json`: Japanese kana and the character U+597D are adapted from
  [KanjiVG](https://kanjivg.tagaini.net), copyright (C) 2009/2010/2011 Ulrich Apel,
  under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
  Source files: `03053.svg`, `03093.svg`, `0306b.svg`, `03061.svg`, `0306f.svg`,
  `0597d.svg` in <https://github.com/KanjiVG/kanjivg/tree/master/kanji>.
  Stage0 changes layout, scaling and stroke presentation, and adds an original
  U+4F60 centerline. This combined CJK artwork remains under CC BY-SA 3.0;
  see `LICENSE-KanjiVG.txt`. Attribution is also embedded in each rendered CJK SVG.

The other original artwork is covered by the repository's MIT license.
No external fonts, runtime downloads or system font fallbacks are used.

`OnboardingHandwrittenGreeting.tsx` places the strokes in a luminance mask over
one shared color gradient. `useGreetingHandwriting.ts` measures the pen paths and
animates them in order on one seven-second clock. Short pauses represent pen
lifts. Reduced Motion displays the complete drawing without animation and is
honored immediately when the OS preference changes.
