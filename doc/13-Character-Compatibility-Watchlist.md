# Character compatibility watchlist — preproduction text QA

**Version:** 0.1.0  
**Researched:** 2026-09-17  
**Status:** Research-backed starter catalog; only rows marked *shipped* are current QA rules.

## Scope and terminology

There is no fixed set of ordinary Unicode characters that Chrome or Safari
universally “do not support.” A character may be valid text but display
differently when the selected webfont lacks its glyph, an OS fallback font is
chosen, a shaping/emoji sequence is unsupported, CSS changes line breaking, or
the Photoshop-to-production converter mishandles an otherwise valid character.
The same character can work in one creative and fail in another. Record the
**code point or sequence, font file and style, browser/OS versions, renderer
version, artboard/state, and actual outcome** before calling it unsupported.
[CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/),
[Unicode display FAQ](https://www.unicode.org/faq/unsup_char.html).

Terms used below:

- **Invalid/interchange defect:** a control, malformed string, or replacement
  marker that should not reach approved copy. A static error can be justified.
- **Layout-sensitive:** valid Unicode that can change wrapping, width,
  direction, or glyph choice. Review intent; do not auto-replace.
- **Glyph/sequence coverage:** valid content whose appearance depends on the
  actual font and platform. A code-point scan is only a candidate signal.
- **Pipeline-specific:** valid or unusual source text with a verified failure
  in this Turbo publishing path; severity is based on that evidence, not a
  claim about browser-wide support.

`document.fonts.check()` is a font-*loading* check, **not** a glyph-coverage
test. A missing-glyph verdict needs font cmap/cluster inspection and/or an
observed rendered fallback or missing-glyph symbol in the target environment.
[MDN FontFaceSet.check](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/check),
[CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/).

## Starter watchlist

| Code point(s) / example | Why it matters | Initial QA disposition |
|---|---|---|
| **U+0003** (Photoshop Shift+Enter soft return) | Production maps it to a paragraph element; nonzero following paragraph spacing may create an unintended gap. This is a Turbo pipeline case, not proof that Chrome/Safari lack a glyph. | **Conditional warning** as `rendering.shift-enter-soft-return` only when following paragraph spacing is nonzero. Preserve the raw character and preview paragraph structure. See TR-005 in [Text Render Issue Catalog](06-Text-Render-Issue-Catalog.md). |
| **C0 controls** U+0000–U+001F and **DEL** U+007F, excluding expected CR/LF, U+0003, and contextually valid TAB | Non-printing controls are not approved visible copy. HTML defines parsing behavior, but that is not a guarantee of correct creative rendering. | **Error — shipped** for unsupported controls via `copy.unsupported-control-character`; U+0003 has a separate conditional rule. Review TAB as spacing separately. Do not call every control “browser unsupported.” [HTML parsing](https://html.spec.whatwg.org/multipage/parsing.html). |
| **C1 controls** U+0080–U+009F | Common mojibake/interchange signal; numeric references can have special HTML parsing behavior. | **Candidate error** only after verifying raw export encoding and intended copy; do not silently reinterpret bytes. [HTML parsing](https://html.spec.whatwg.org/multipage/parsing.html). |
| **U+FFFD** replacement character `�` | Often indicates earlier decode loss, but can be intentionally quoted. | **Candidate warning** with source comparison; escalate if source text was lost. [Encoding Standard](https://encoding.spec.whatwg.org/), [CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/). |
| **Mojibake patterns** such as `Ã©`, `â€™`, `Â ` | Valid characters in the wrong sequence can indicate UTF-8 bytes decoded using a different encoding; this is an encoding fault, not missing browser glyphs. | **Candidate warning** only after comparing the intended copy and raw export. Avoid blanket pattern replacement because such text can be intentional. [W3C i18n glossary](https://www.w3.org/TR/i18n-glossary/). |
| **Unpaired UTF-16 surrogate** U+D800–U+DFFF | Not a valid Unicode scalar value by itself; may be replaced during serialization or HTML parsing. A valid surrogate *pair* represents one supplementary character and must not be flagged. | **Candidate error** after scanning code points/pairing in raw strings. [HTML parsing](https://html.spec.whatwg.org/multipage/parsing.html). |
| **Noncharacters** U+FDD0–U+FDEF and plane-ending U+FFFE/U+FFFF equivalents | Reserved for internal use; unexpected in client-facing copy. | **Candidate warning**, then error if confirmed as corruption. They are not the same as unassigned characters. [Unicode FAQ](https://www.unicode.org/faq/private_use.html). |
| **Private-use** U+E000–U+F8FF, U+F0000–U+FFFFD, U+100000–U+10FFFD | Meaning and glyph depend on an agreed font. OS fallback cannot infer the intended icon/logo. | **Candidate warning** unless the exact supplied font maps the code point; error only on confirmed missing glyph. [Unicode FAQ](https://www.unicode.org/faq/private_use.html), [CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/). |
| **U+00A0** NBSP, **U+202F** narrow NBSP, **U+2007** figure space, **U+2009** thin space | Visually subtle width/nonbreaking differences can cause hanging copy or mismatch across artboards. Valid in many languages and typography systems. | **Review only** when unexpected, repeated, or different from approved copy; measure wrap before error. [CSS Text 3](https://www.w3.org/TR/css-text-3/), [W3C Character Model](https://www.w3.org/TR/charmod-norm/). |
| **U+200B** zero-width space, **U+2060** word joiner, **U+FEFF** embedded word joiner/BOM | Invisible break/no-break controls may change wrapping without visible evidence. U+200B can be intentional in languages without spaces; U+FEFF also has BOM use. | **Candidate warning** with language/context exclusions; error only for a demonstrated unwanted break or stray embedded BOM. [Unicode display FAQ](https://www.unicode.org/faq/unsup_char.html), [CSS Text 3](https://www.w3.org/TR/css-text-3/). |
| **U+00AD** soft hyphen | Usually invisible until a line breaks, when it may produce a hyphen; copy comparison and screenshots may disagree. | **Candidate warning** only for unapproved discretionary hyphenation or measured wrap mismatch. [Unicode display FAQ](https://www.unicode.org/faq/unsup_char.html), [W3C Character Model](https://www.w3.org/TR/charmod-norm/). |
| **U+200C/U+200D** ZWNJ/ZWJ, **U+FE0E/U+FE0F** variation selectors, emoji modifiers and regional indicators | Joiners and selectors alter shaping or emoji presentation. A complete emoji sequence can fall back to separate symbols on an older platform; joiners are essential in some scripts. | **Sequence-level review**, never blanket-error these code points. Validate the complete grapheme/emoji sequence, intended language, and target OS. [Unicode Emoji](https://unicode.org/reports/tr51/), [W3C Character Model](https://www.w3.org/TR/charmod-norm/). |
| **Bidi controls** U+200E/U+200F, U+202A–U+202E, U+2066–U+2069 | Invisible direction changes can reorder mixed LTR/RTL copy or make source order misleading. Legitimate for multilingual text. | **Candidate warning** for unbalanced/unexpected controls; compare logical order and rendered order before error. [Unicode Bidi](https://www.unicode.org/reports/tr9/). |
| **Combining marks** such as U+0301 and canonically equivalent composed/decomposed forms | A font may support the base but not the whole cluster or position the mark differently. A mark without a base is especially suspect. | **Candidate warning** for isolated marks or inconsistent normalization; preserve approved copy and compare whole grapheme clusters. Never strip accents globally. [CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/), [W3C Character Model](https://www.w3.org/TR/charmod-norm/). |
| **Common special glyphs** ® ™ © ° € £ ¥ ₹ • … ± × ÷ Greek/math symbols, accented letters | These are valid Unicode, not inherently unsupported. Missing glyphs or fallback can alter weight, baseline, and width in a brand font. | **Font-coverage candidate**, not an error based solely on presence. Verify the actual font file and rendered output. [CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/). |
| **U+2028/U+2029** line/paragraph separators | Semantically different from a Photoshop CR or U+0003; converters may not preserve the intended break kind. | **Candidate warning** if present in export; compare authored and published line count. [CSS Text 3](https://www.w3.org/TR/css-text-3/). |

## Form differences to compare, not ban

These are intentional Unicode distinctions with different metrics or break
behavior. A proofreading or cross-artboard check can show exact code points,
but must not silently replace one with another:

| Similar-looking forms | Typical risk |
|---|---|
| `-` U+002D, `‐` U+2010, `‑` U+2011, `–` U+2013, `—` U+2014, `−` U+2212 | Different width and line-break behavior; mathematical minus is not a hyphen. |
| `'` U+0027, `’` U+2019, `′` U+2032; `"` U+0022 versus “ ” U+201C/U+201D | Copy, glyph shape, kerning, and proofing differences. |
| Space U+0020 versus NBSP U+00A0 or narrow NBSP U+202F | Invisible difference with different wrapping and width. |
| `é` U+00E9 versus `e` U+0065 + U+0301 | Usually equivalent reading, but font coverage and source matching can differ. |
| `™` U+2122 versus raised `TM`; `®` U+00AE versus superscript-styled ® | Appearance depends on font and style ranges, not just the character. |

CSS line breaking and font matching explain why these can produce different
layouts without either form being universally unsupported.
[CSS Text 3](https://www.w3.org/TR/css-text-3/),
[CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/).

## Front-end rendering guidelines

- Keep source, JSON, HTML, and response encoding consistently UTF-8; investigate
  `�` or mojibake at the decoding boundary before blaming a font. Do not
  repair an already-corrupted string by guessing replacements.
  [W3C character encoding guide](https://www.w3.org/International/questions/qa-what-is-encoding).
- Load the exact webfont files and styles used by the creative. Wait for
  `document.fonts.ready` before geometry/screenshot checks, but inspect actual
  glyph coverage separately; `document.fonts.check()` is not sufficient.
  [MDN document.fonts](https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts),
  [MDN FontFaceSet.check](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/check).
- Preserve break *kind* from Photoshop through publishing: paragraph return,
  U+0003 soft return, CSS soft wrap, and discretionary hyphen are different.
  Define `white-space`, wrapping and hyphenation behavior deliberately and
  compare rendered line count at each artboard size.
  [CSS Text 3](https://www.w3.org/TR/css-text-3/).
- Set the content language and base direction when applicable. For mixed RTL
  text use structural `lang`/`dir` markup and isolation rather than injecting
  unexplained bidi controls into approved copy.
  [W3C language guidance](https://www.w3.org/International/questions/qa-html-language-declarations.html),
  [W3C direction guidance](https://www.w3.org/International/questions/qa-html-dir).
- Treat a grapheme cluster (base + combining mark, emoji sequence, etc.) as
  one unit when inspecting or truncating text. Code-point presence alone does
  not establish rendered sequence support. `Intl.Segmenter` can provide
  grapheme boundaries on supported browsers; retain a tested fallback for
  older targets.
  [Unicode text segmentation](https://unicode.org/reports/tr29/),
  [MDN Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter).
- Never normalize live approved copy with NFKC or strip invisible characters
  automatically. Use escaped code-point diagnostics and designer review;
  normalization can erase meaningful distinctions.
  [W3C Character Model](https://www.w3.org/TR/charmod-norm/).

## Rule-promotion workflow

1. **Keep the raw text.** Record each code point/sequence with offsets and
   source style ranges before whitespace normalization; do not put invisible
   characters themselves in a finding title.
2. **Establish intent.** Check approved copy, language, Photoshop layer, and
   whether the character is necessary for shaping or typography.
3. **Reproduce.** Compare Preview and production (or the exact publishing
   renderer) on the target Chrome/Safari + OS matrix, with fonts loaded. Save
   font filename/hash, browser/OS and renderer versions, state, layer ID, and
   screenshots/DOM measurements. A font-loading success alone is insufficient.
4. **Classify.** Use an error for proven source corruption or a confirmed
   production failure; warning for context-dependent risk; information for
   valid but noteworthy typography. Separate source defects from tool/renderer
   bugs. Exclude legitimate language and emoji use.
5. **Regress.** Add a minimal source fixture, at least one negative/legitimate
   fixture, and a stable rule ID. Update the relevant case in
   [Text Render Issue Catalog](06-Text-Render-Issue-Catalog.md). Never rewrite
   approved copy automatically.

### New entry template

| Field | Record |
|---|---|
| Code point/sequence and Unicode name | `U+....` |
| Observed source and intended copy | Raw export excerpt with control characters escaped |
| Failure mechanism | Encoding / converter / CSS / font coverage / shaping / platform |
| Reproduction matrix | Preview and production build; Chrome/Safari and OS versions |
| Evidence | Package, artboard > tab > slide > layer ID, font file/hash, screenshot/DOM |
| False-positive exclusions | Language, deliberate spacing, valid emoji/combining sequence |
| Proposed rule | Stable ID, severity, confidence, message, repair |
| Regression tests | Positive and negative fixtures |
