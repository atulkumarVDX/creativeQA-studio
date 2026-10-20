# 06 — Text Render Issue Catalog — Turbo Export Preview

**Catalog version:** 0.9.2
**Reference build:** `preview/turbo-preview-7.9.11.html` @ **v7.9.11**
**Last updated:** 2026-10-14
**Status:** Working evidence catalog — individual cases state whether detection is shipped

---

## 1. Purpose

This catalog records repeatable differences between Photoshop-authored text and
the browser preview. Each case should provide enough evidence to support three
future outcomes:

1. Detect the risky PSD structure during package analysis.
2. Explain the issue to a designer in plain language.
3. Recommend a safe Photoshop repair without silently changing approved copy.

The [character compatibility watchlist](13-Character-Compatibility-Watchlist.md)
is the starter inventory for code-point, font, browser, OS, and publishing-path
risks. Presence on that list alone does not make a valid character an error.

An entry is not automatically a design error. Some Photoshop structures are
valid for print or raster output but fragile when reconstructed as live HTML.
The tool should distinguish a structural risk from a confirmed render mismatch.

## 2. Proposed finding levels

| Level | Meaning | Suggested tool behavior |
|---|---|---|
| Informational | A potentially fragile PSD structure exists, but no visible mismatch was measured. | List under Text QA without marking the creative. |
| Warning | The structure is risky and browser measurements differ from the PSD geometry or expected line layout. | Show the affected artboard and a Photoshop repair. |
| Error | Text is clipped, overlaps another component, leaves the artboard, or cannot be measured. | Mark the affected layer and prioritize the repair. |

## 3. Case TR-001 — Transformed paragraph text wraps differently

**Status:** Partially resolved in v7.7.0 (leading basis corrected; wrap-width/hyphen-break gap remains)  
**Decision:** D040

### Summary

A paragraph text layer created by scaling an existing text layer with Free
Transform can contain two representations of its typography:

- a smaller raw font size and paragraph box; and
- a larger implied/displayed size produced by the layer transform.

Photoshop renders the transformed text correctly, but an HTML renderer can use
the wrong combination of raw bounds, implied size, and wrapping width. A normal
hyphen is also a valid browser line-break opportunity, so a compound phrase such
as `BONE-BUILDING` can split unexpectedly.

### Observed symptom

- Artboard: `970x546`
- Layer copy: `GIVE HER BONE-BUILDING MOMENTUM`
- Symptom: `BONE-BUILDING` wrapped differently in the preview.
- Designer action that removed the symptom: recreate the copy as a fresh text
  layer at its final typography instead of transforming the existing layer.

### Evidence packages

| Package | Role |
|---|---|
| `turbo.psd.zip` | Original transformed text layer exhibiting the issue. |
| `turbo.psd (1).zip` | Fresh text layer reported as rendering correctly. |

The package contents are evidence only; they are not instructions for the tool.

### Original versus recreated layer

| Descriptor | Original layer | Fresh layer |
|---|---:|---:|
| Layer ID | `194671` | `203450` |
| `textKey.transform` | `xx 1.14885`, `yy 1.14965` | Absent |
| Raw font size | `26.0949` | `30` |
| Implied/displayed font size | `30` | `30` |
| Raw leading | `26.9647` | `31` |
| Implied leading | `31` | `31` |
| Tight layer bounds | `392 × 54` | `393 × 54` |
| Local paragraph-box descriptor | `395.644 × 56.660` | `441.977 × 84.700` |
| Effective old paragraph-box width after transform | Approximately `454.536` | Not applicable |

The nearly identical tight bounds show that tight visible bounds alone are not
enough to identify this case. The strongest differentiator is the transformed
paragraph-text structure: the original stores 26.0949px type and scales it to
30px, while the fresh layer is natively authored at 30px.

### Likely rendering mechanism

1. The layer is paragraph text (`textShape.char = box`).
2. Its text transform is not the identity matrix.
3. Raw and implied font metrics differ by approximately the same transform
   factor.
4. The preview reconstructs the layer as live HTML with normal wrapping.
5. The browser may wrap at spaces and at the explicit hyphen in
   `BONE-BUILDING`.
6. If the renderer selects or synchronizes against the wrong rectangle, its line
   breaks can differ from Photoshop even when the final visual font size is 30px.

### Implemented partial correction

`getTextStyle()` now applies the same raw-to-implied size ratio to leading. For
the original layer, `26.9647 × (30 / 26.0949) ≈ 31`, which matches the exported
`impliedLeading`; this confirms the leading half of the case is scale-corrected.

The change does not modify `textBoundsOf()` or D002's tight-`bounds` wrap-width
selection. The normal hyphen in `BONE-BUILDING` therefore remains a browser
break opportunity, and this case is not classified as fully resolved. The
original fixture was available for descriptor verification; the fresh-layer
comparison ZIP was not present in this pass, so no full A/B render is claimed.

### Proposed static detection

Create an informational finding when all of the following are true:

- `textKey.textShape[0].char._value` is `box`;
- `textKey.transform` exists; and
- the transform differs materially from identity, for example by more than 1%.

Increase confidence when one or more of these are also true:

- `impliedFontSize / size` approximately equals `transform.xx` or
  `transform.yy`;
- implied leading differs from raw leading by the same factor;
- the content contains spaces, hyphens, or other wrapping opportunities;
- the paragraph is expected to occupy more than one line; or
- transformed paragraph-box geometry differs materially from the rectangle used
  by the browser renderer.

Suggested internal finding key: `transformed-paragraph-text`.

### Proposed live confirmation

Promote the finding from informational to warning only when live measurement
confirms a meaningful difference, such as:

- browser line count differs from the expected PSD line count;
- measured glyph height exceeds the PSD text rectangle;
- a hyphenated lexical token is split across lines;
- text is clipped by the artboard; or
- the text overlaps another rendered layer.

This confirmation step avoids flagging rotated labels, deliberately scaled hero
copy, and other transformed text that still renders correctly.

### Suggested designer-facing message

> **Transformed paragraph text may wrap differently**  
> This text layer was scaled rather than authored at its final font size. It may
> wrap differently when exported as live HTML. Recreate it as a fresh paragraph
> text layer using the Type tool, then set the final font size and leading
> directly.

### Photoshop repair

1. Select the affected layer and record its position, final font size, leading,
   alignment, colors, and paragraph-box dimensions.
2. With the Type tool, draw a fresh paragraph text box at the intended final
   dimensions.
3. Paste the approved copy and apply the final typography directly. For this
   case: Nunito Sans ExtraBold, 30px size, and 31px leading.
4. Position the new layer without using Free Transform to resize the text.
5. Compare the line breaks against the approved design.
6. Remove or hide the old transformed layer after verification.

Do not rasterize the text as a repair. Text must remain editable and available
to the live-text export path.

### Possible copy-level workaround

A non-breaking hyphen (`BONE‑BUILDING`) can prevent a browser break inside the
compound phrase. This changes the text character and may affect typography,
search, downstream validation, or approved copy. The tool should recommend it
only as an optional, copy-approved workaround—not as an automatic fix.

### Candidate tool behavior

- Add the finding to the Text QA panel.
- Show the raw size, implied size, and transform percentage.
- Identify the affected artboard and layer name.
- Explain whether the issue is only structural or visibly confirmed.
- Provide the Photoshop repair steps above.
- Do not automatically rewrite the PSD or its copy.

### Validation fixture

Use the two evidence packages as an A/B fixture when this check is implemented:

- the original layer should produce a `transformed-paragraph-text` structural
  finding;
- the fresh layer should not produce that finding;
- warning severity should depend on a measured rendering mismatch, not merely
  the presence of a transform.

## 4. Case TR-002 — Disabled shape stroke shifts a CTA label in production

### Follow-up evidence — September 14, 2026

The newly supplied `design_1.psb.zip` and production DOM show a border-free
CTA for layer `214851`, with live label `222520` positioned inside the promoted
frame. This is a separate production state from the bordered example below.
Its frame path measures `183.59375 × 41.75px`; the label's local offset is
`25.65625px, 14.15625px`. These values are reproduced by the structural mounting
helper using the actual export and existing renderer collectors across its
eight artboards. The source artboard origin differs from the supplied production
example, so global coordinates are not claimed to match. The renderer retains
export coordinates and respects the disabled stroke. Synthetic regression
fixtures cover frame promotion, ancestry and scaled rebasing in
`tests/structure/render-tree.test.mjs`. Browser glyph measurement and visual
parity have not been verified in this follow-up.

**Status:** Planned  
**Affected output:** Showcase production creative `14126630`, expandable
`970x546`, tab 1  
**Evidence package:** Latest supplied `design.psd`  
**Affected layer:**
`970x546 > tabComponent > tab1 > CanvasDesign > button > frame`

### Symptom

The `LEARN MORE` label appears vertically centered in the preview artifact but
shifts downward in the production creative. The purple button rectangle remains
in the expected location, isolating the visible mismatch to the live-text child
inside the CTA container.

### Confirmed evidence

The Photoshop `frame` shape retains vector-stroke metadata even though the
stroke is disabled:

| Descriptor | Value |
|---|---:|
| Shape bounds | `3292, 505, 3478, 550` |
| `stroke.enabled` | `false` |
| `stroke.fill_enabled` | `true` |
| `stroke.line_width` | `3.15px` |
| `stroke.line_alignment` | `center` |
| Stroke color | `rgb(103, 50, 186)` |

The production DOM nevertheless converts that dormant descriptor into an
active CSS border:

```css
border: 3.15px solid rgb(103, 50, 186);
```

The label wrapper is absolutely positioned inside this bordered element. In
the measured production state, the button rectangle was `44.60px` high and its
center was at approximately `502.58px`, while the live label line box was
centered at approximately `507.86px`: a `5.28px` downward difference. The text
layer itself had `BaselineShift: 0`, identity horizontal/vertical scale, and no
rotation, excluding baseline shift and text transformation as the primary
cause.

The text layer also stores an anomalous `Leading: 0.01` with Auto Leading
enabled, while equivalent CTA labels in the supplied PSD store `Leading: 26`.
This is worth normalizing but is not the confirmed source of the container
offset.

### Root cause

This is an exporter-to-browser box-model interaction. Production treats a
disabled Photoshop vector stroke as an enabled CSS border. Absolutely
positioned children are then laid out from the bordered container's inner
positioning box, adding the stroke width to the label's top/left placement.
The browser font line box makes the final visible vertical difference slightly
larger than the border width alone.

The PSD structure is not visually wrong in Photoshop: the offending stroke is
disabled. The production export should respect `stroke.enabled = false`.

### Planned detection

Create a warning when all of the following are true:

- a CTA/button group contains a live text child;
- its paired vector frame retains stroke metadata with
  `stroke.enabled = false`;
- the dormant stroke has a positive `line_width`; and
- the output path can reconstruct that frame as a bordered HTML container.

Report the stored width and color. Do not flag disabled strokes on unrelated
decorative shapes, shapes without live-text descendants, or zero-width stroke
records. If rendered DOM is available, confirm the warning by checking whether
the resulting container has a non-zero computed CSS border.

Suggested internal finding key: `disabled-cta-stroke-exported-as-border`.

### Designer-facing message

> **Disabled CTA stroke may shift the label in production**  
> This button shape still contains a non-zero Photoshop stroke value even
> though the stroke is turned off. Production may export that stored value as a
> CSS border and move the live label. Clear the stroke value completely before
> publishing.

### Photoshop repair

1. Select the `frame` shape in the affected `button` group.
2. Set Stroke to **No Color** and Stroke Width to **0px**.
3. If Photoshop continues to retain the dormant stroke descriptor, recreate
   the rectangle as a new shape using only the intended purple fill.
4. Keep the replacement layer named `frame`, preserve its dimensions and
   position, and retain the editable `LEARN MORE` text layer above it.
5. Reset the label's Character-panel leading to Auto or the approved explicit
   value to remove the unrelated stored `0.01` value.
6. Re-export and verify the expanded `970x546` tab-1 CTA in production.

### Planned tool behavior

- List the case in Text QA as a warning before publication.
- Identify the artboard and full CTA/frame layer path.
- Show the disabled stored stroke width and the expected positional risk.
- Promote confidence when live output contains a matching non-zero CSS border.
- Offer Photoshop repair guidance; do not rewrite the PSD automatically.

### Validation fixture

Use the supplied `design.psd` as the failing fixture. Its companion
`design.psd.zip` was zero bytes when inspected and cannot serve as an export
fixture. Add a repaired export with the `frame` stroke fully cleared; expected
results are no CSS border from the dormant stroke and a centered production CTA
label.

## 5. Case TR-003 — Soft returns receive paragraph spacing, then text fitting shifts the block upward

**Status:** Production failure reproduced; shared conversion fix and QA checks proposed, not implemented.  
**Verified:** 2026-09-11  
**Preview source:** `turbo_preview_artifact_7_7_0.html`  
**Campaign/state:** La Roche-Posay Mela Q3 2026, `160x600 > tab3 > rmGallery > slide4`  
**Production:** https://showcase.vdx.tv/ccpreview/14126630#29f08b47-6418-4748-8c29-49b909e72034/4

### Symptom and correction to the earlier diagnosis

The black results copy beginning “• 97% showed” overlaps the purple heading.
The problem is in the body text's paragraph spacing and subsequent positioning.
The earlier attribution to the purple heading's transformed leading was not
verified and does not explain the reproduced body-copy failure.

The supplied `production_v1/design.psd.zip` changed during investigation. Its
current results layer is `232395`, parent `226426`, and matches the layer tag in
the current production DOM. Earlier notes referring to `226425` describe a
different revision and must not be treated as the current fixture.

### Confirmed source and production evidence

The current export contains:

- No `textKey.transform` on body layer `232395`.
- All character ranges have raw and implied font size and leading equal to
  `11.34768009185791`; `autoLeading` is false.
- Six U+0003 soft returns and two CR paragraph returns, forming nine authored
  lines across three bullet paragraphs.
- Nine exported paragraph-style ranges, each carrying `spaceAfter` and
  `impliedSpaceAfter` of `5.673840045928955`. Range boundaries alone therefore
  cannot be used to infer semantic paragraph boundaries.
- Tight body bounds of `96 × 111 px`, local artboard top `274 px`.

Production DOM for `data-tags` containing `layer:232395` has nine `<p>` elements:

- Font size `11.35px`, unitless line-height `1`: the leading itself is correct.
- First paragraph margin `0px`; every subsequent paragraph has
  `margin: 5.67384px 0px 0px`, including continuations after soft returns.
- Every paragraph has `position: relative; top: -18.6406px` after PSD sync.
- Measured first paragraph top `255.359375`, last paragraph bottom `404.3984375`,
  versus wrapper top `274`, bottom `385`. Paragraph boxes span approximately
  `149.04px` within a `111px` wrapper and extend above and below it.

Those coordinates are in the creative frame's coordinate system. Paragraph box
height and glyph-ink height are distinct; do not present these as ink bounds.
The production overlap was also verified visually.

### Cause and why local preview looks fine

Production applies paragraph spacing at all eight line transitions. Six of
those are soft line breaks within a bullet and should not introduce new
paragraph spacing. The resulting added spacing is `8 × 5.67384 = 45.39px`;
spacing at the two actual bullet boundaries would be approximately `11.35px`.
The excess attributable to soft returns is approximately `34.04px`.

The recovered runtime `production-file/vdx-container-turbo.js`,
`syncTextWithPsd()`, centres measured glyph bounds in the authored wrapper using
`(wrapperHeight - measuredGlyphHeight) / 2` as part of its top offset. When the
content is too tall, this term is negative. Production's observed `-18.6406px`
offset is consistent with this mechanism and visibly moves the first bullet
into the heading. Width searching cannot eliminate explicit line breaks or
their extra paragraph margins.

The preview has a different conversion path:

- `normalizeTextNewlines()` replaces both CR and U+0003 with LF.
- `populatePsdParagraphs()` creates a new `<p>` for every LF.
- `applyPsdParagraphStyle()` sets every paragraph's margin to zero and does not
  consume `spaceAfter`/`impliedSpaceAfter` or per-paragraph spacing ranges.

Thus preview suppresses all paragraph spacing, including legitimate spacing
between bullets. It can look acceptable while failing to reproduce production
or the complete PSD typography. A local sync success cannot certify production
parity. Scaling correction is not the explanation for this current layer.

The output-level fault is confirmed. The production export-to-HTML converter's
source is not in this workspace; its exact faulty function cannot yet be named.

### Scalable engineering solution

1. Use one versioned PSD-text conversion module in preview and publishing.
   Preserve CR paragraph ends separately from U+0003 soft returns before
   normalizing text. Preserve source offsets so mixed-font and superscript
   ranges remain attached to the correct characters.
2. Represent this layer as three semantic paragraphs with internal soft breaks,
   or equivalent line records carrying an explicit break kind. Map soft breaks
   to `<br>` or line records without paragraph margins. Apply paragraph spacing
   only at real paragraph boundaries. Specify margin-collapse behavior so
   browser defaults cannot change the result.
3. Resolve each character and paragraph style, including inheritance, explicit
   versus automatic leading, and raw versus implied dimensions. Prefer valid
   exported implied metrics; apply a transform fallback only when required and
   supported. Do not infer this case from nonidentity transforms alone.
4. Validate overflow before applying glyph alignment. If content exceeds the
   authored bounds after correct typography and font loading, surface a layout
   failure. Do not silently centre an oversized block into neighbouring copy
   or shrink approved typography to conceal it.
5. Run the same production renderer in the prepublish check, after fonts load,
   for each size/tab/slide. Compare paragraph spacing, line count, glyph bounds,
   and actual text collisions. Include renderer version and layer IDs in the
   diagnostic report.

### Detection and false-positive exclusions

Static signal: text has a soft return and nonzero paragraph spacing. Report
this as a structural risk, not a PSD design error. Confirm an error when a
soft-break continuation receives paragraph margin in generated HTML, or when
post-sync glyphs overlap another layer. Do not flag correctly handled soft
breaks, legitimate spacing at hard returns, deliberate empty paragraphs, or
ordinary small negative font-alignment offsets without overflow evidence.

TR-005 now applies this evidence-based rule: U+0003 by itself is not a defect;
warn only when nonzero paragraph spacing follows the break. The production
DOM for the current Ipsen reference layer shows the correctly handled case.

Suggested message: “Paragraph spacing is being applied between lines inside a
bullet. Production then moves the oversized text block upward. This requires a
text-export correction; recreating the layer does not guarantee prevention.”

### PSD handling and regression fixture

Preserve the original editable layer as a regression fixture. Rebuilding layers
or rasterizing text is not the scalable remedy. Setting paragraph Space After
to zero may avoid this trigger but also removes intentional paragraph spacing;
it is only a design-reviewed workaround, not the conversion fix.

Use current layer `232395` and its production DOM as the failing fixture. A
minimal fixture should contain three bullets, nine lines, six soft returns,
two paragraph returns, explicit leading, nonzero paragraph spacing, mixed
Locator Black/Light, and superscript markers. Tests should require exactly two
paragraph-spacing transitions, retained internal breaks and styles, unchanged
approved copy, no overlap after synchronization, and identical preview and
published conversion. Include zero-spacing, hard-return-only, blank-paragraph,
automatic-leading, and transformed variants. A corrected publication has not
yet been tested.

## 6. Case TR-004 — Paragraph-text CTA label disappears in production

**Status:** Production symptom confirmed; broad warning replaced in 7.8.16 with a scoped informational review. Original omission cause remains unconfirmed; later ignored-image case is documented separately. Patch 7.8.17 adds finding-to-preview layer highlighting; 7.8.19 presents that action as a compact play icon.

**Investigation update (2026-10-10):** See
`16-CTA-Warning-Investigation.md`. The original Tryptry export and the later
`label-notVisible.zip` have different children in the affected button. The
later ZIP contains no live text label and its `copy_new` PNG has no lettering.
Do not combine these revisions or treat paragraph text / missing transforms
as a proven cause of omission.

**Affected output:** Showcase production creative `14179060`, mobile Instream, tab 1

**Evidence package:** `tryptryDTC.psd.zip`

**Affected layer:** `mobile-instream > tabComponent > tab1 > CanvasDesign > button1 > DISCOVER THE DIFFERENCE` (layer `188168`)

### Symptom

The CTA frame is visible in the published mobile Instream creative, but its
`DISCOVER THE DIFFERENCE` label is absent. Turbo Preview displays the label.

### PSD evidence

The affected label is visible, contains the approved copy, uses available
`OpenSans-SemiBold`, and is a direct child of the correctly named `button1`
group. Its distinguishing descriptor is paragraph text:

```text
textKey.textShape[0].char._value = box
textKey.transform = absent
```

Comparable CTA labels in the same artboard and the same tab-1 label in other
artboards are point text (`char._value = paint`). The source includes the
Open Sans SemiBold webfont, and working CTA labels use the same font, excluding
the package font warning as the cause of this isolated omission.

### Root cause

The initial investigation associated the omission with paragraph/box text.
Working Ipsen box-text CTA labels contradict using that condition alone as a
predictor. The supplied browser runtime consumes already converted objects
and contains no Photoshop text-shape or transform eligibility check. The
stage that omitted the original Tryptry label has not been traced. A causal
claim about PSD text mode is therefore unconfirmed.

### Implemented detection

In 7.8.19, `rendering.cta-mobile-label-review` is informational, with medium
confidence, and applies only to direct box-text labels in Mobile Instream
CTA groups (`buttonN`, with the evidenced legacy `button` alias). It does not
assert disappearance, does not treat missing transforms as causal, and does
not flag working Ipsen 160×600 labels. Excluded subtrees, map buttons, JumpTo
buttons and logo actions do not inherit the CTA profile.

`structure.cta-ignored-image` separately warns about unsupported direct image
or Smart Object role names. This catches `copy_new` in the later ZIP using
the export guide's CTA contract, allowing documented background generator
and retina names. Valid image-based labels do not imply missing text.

### Designer-facing message

> **Verify this button label in Mobile Instream.**
>
> Check that the label is visible in the published unit. This text setup
> matched a previous label omission; the check cannot confirm whether yours
> is affected. If it is missing, convert it to point text in Photoshop,
> preserve the approved copy and styling, then re-export and verify production.

### Photoshop repair

1. Select the affected CTA label with the Type tool.
2. Convert it to point text, or recreate it as a fresh point-text layer at the
   approved final typography.
3. Keep the original copy and layer name, retain it directly inside `button1`,
   and centre it over `frame`.
4. Re-export and verify the affected state in the production Showcase.

### Validation fixture

The supplied `tryptryDTC.psd.zip` is the failing fixture. A repaired export
should change layer `188168` from `box` to `paint` and produce no
`rendering.cta-paragraph-text` finding for that CTA. Published visual parity
must still be checked after the repaired creative is uploaded.

## 7. Case TR-005 — Shift+Enter paragraph spacing differs in production

**Status:** Production paragraph mapping confirmed for Ipsen 300×250; static warning narrowed in 7.8.15

**Source signal:** U+0003 in raw `textKey.textKey` (Photoshop Shift+Enter)

### Confirmed production behavior

The current production package `design.psd.zip` contains layer `221946` at
`300x250 > tabComponent > tab3 > rmGallery > slide3`. Its raw text includes
U+0003 immediately before `2. European Association...`; the paragraph-style
ranges before and after that character both specify zero `spaceAfter` and
`impliedSpaceAfter`. The production DOM shared for this same layer contains
two `<p>` elements with lexical `<span>`s, matching the intended line layout.
The production `syncTextWithPsd()` source measures and adjusts existing `p`
and `span` elements; it does not perform the raw-text-to-HTML conversion.

This proves that U+0003 alone is not a defect. Keep it intact in source text,
and render it using the paragraph structure observed in production. Do not
rewrite the raw character as CR/LF, because raw export data must remain
available to diagnostics.

### Detection and designer action

Do not flag every U+0003. Emit `rendering.shift-enter-soft-return` as a warning
only when the paragraph style following a soft return has nonzero
`spaceAfter`/`impliedSpaceAfter`, since production may apply that spacing to the
following paragraph and create an unintended gap. Include artboard, tab, slide,
layer ID, and the affected copy. A zero-spacing soft return is not a finding.

Suggested action: “Check Space After in Photoshop. If the gap is unintended,
adjust it, re-export, and compare with production.” Do not recommend replacing
Shift+Enter with Enter for a correctly rendered soft return.

## 8. Case TR-006 — Responsive leaf anchoring moves an accent shape over copy

**Status:** Preview failure reproduced; responsive cluster fix implemented in development build 7.8.4

**Evidence package:** `production_v3/design.psb.zip`, exported 2026-09-22

**Affected state:** `428x622 > tab2 > rmGallery > slide2` in the default 375px view

### Symptom

The purple accent bar covers the first characters of the body copy beginning
“Helps target discoloration…”. The same bar and copy are separated correctly
in the exported 428px source geometry.

### Confirmed source geometry

The artboard begins at document `x = 4721`. The two direct children of
`slide2` are:

| Layer | ID | Source bounds | Artboard-local bounds | Paint order |
|---|---:|---:|---:|---:|
| `Rectangle 16` | `244256` | `x 4844..4857` | `x 123..136` | `1605` |
| `Left Headline copy 3` | `217233` | `x 4873..5065` | `x 152..344` | `1604` |

The source therefore has a 16px gap: `152 - 136 = 16`. The text is paragraph
text with an identity text-shape transform and a separate layer transform of
approximately `0.491735`; neither descriptor places it under the bar in the
exported source bounds.

### Root cause

The responsive preview reduces this artboard from 428px to 375px, a 53px
difference. `mobileExpandableResponsiveFrame()` tries to choose one shared
ancestor frame, but the structural `tabComponent`, `tab2`, `rmGallery`, and
`slide2` groups all expose document-wide `bounds` (`0..5149`) and are rejected
as implausible artboard frames. The function then falls back independently to
each leaf's own rectangle:

- `Rectangle 16` lies wholly left of the 214px source centre, so it receives
  no horizontal offset and remains at `x 123..136`.
- The text rectangle `x 152..344` crosses the source centre, so it receives
  the centred offset `-53 / 2 = -26.5px` and becomes `x 125.5..317.5`.

This creates a 10.5px overlap (`136 - 125.5`). Because the shape's source paint
order is one level above the text, the new overlap visibly occludes the first
letters. Retained stacking is behaving consistently; inconsistent responsive
anchoring of sibling leaves creates the collision.

### Detection and repair direction

After applying responsive transforms, test foreground opaque shape rectangles
against live-text ink/tight bounds within the same active state. Emit an error
when a higher-painted shape newly intersects text that did not intersect in
source geometry. Report both layer IDs, source and rendered intersections, and
the responsive width.

Exclude intentional text backgrounds and owners such as CTA frames, full-size
backgrounds, masks, underlines, and shapes painted behind text. A generic source
overlap without a measured rendered mismatch is not automatically an error.

### Implemented correction

When no plausible ancestor frame exists, the renderer now finds a nearby
text-plus-narrow-shape sibling cluster using exported layer kinds, overlapping
vertical bounds, and a maximum 32px horizontal gap. Both leaves use the union
of that cluster as their responsive pinning frame. For this fixture, both move
by `-26.5px`, preserving the source 16px separation. This is descriptor-based;
it does not special-case layer IDs or names. Broad shapes, `frame` layers and
unrelated leaves keep the existing behavior.

The regression fixture asserts the preserved 16px gap at both 428px and 375px,
plus unchanged independent pinning for an unrelated text leaf. Established
low-to-high source paint order remains unchanged.

## 9. Case TR-007 — Photoshop native capitalization is lost in live text

**Status:** Preview failure reproduced; renderer support implemented in development build 7.8.4

**Evidence package:** `production_v3/design.psb.zip`, exported 2026-09-22

**Affected state:** `300x250 > tab2 > slide1`, layer `219710` (`Left Headline copy 3`)

### Symptom and confirmed cause

Photoshop and production display the complete phrase beginning “HIGHEST
CONCENTRATION…” in uppercase, while Turbo QA previously displayed the raw
lowercase characters beginning at `target`. The exported copy is intentionally
mixed case and its complete character-style range records
`fontCaps._value = allCaps`. Turbo QA retained font family, weight, style and
colour but discarded `fontCaps`, so the browser rendered the underlying copy
instead of Photoshop's native capitalization style.

### Implemented correction

Character ranges now retain `fontCaps` as part of their style identity.
`allCaps` maps to `text-transform: uppercase`; `smallCaps` maps to
`font-variant-caps: small-caps`; normal text explicitly clears both. The raw
copy is not rewritten. The styles apply to body text and synthesized tab labels
and participate in the existing transformed-glyph measurement path. This is a
preview capability, not a creative warning. Unsupported future `fontCaps`
values may be reported, but correctly supported native capitalization should
not create a finding.

## 10. Case TR-008 — Photoshop paragraph indents are omitted

**Status:** Descriptor gap confirmed; renderer support implemented in development build 7.8.4

**Evidence package:** `production_v3/design.psb.zip`, exported 2026-09-22

### Symptom and confirmed cause

Multiple live-text layers carry non-zero `impliedStartIndent` values (including
approximately `3.7pt` headline and label indents), but Turbo QA previously
applied no paragraph indentation. The text synchronizer already inspected CSS
padding and `text-indent`, yet the descriptor parser never populated those
styles. This could shift copy and change wrapping relative to Photoshop and
production.

### Implemented correction

Paragraph-style ranges now map independently to rendered paragraphs:

- `impliedStartIndent` (or corrected `startIndent`) to logical start padding;
- `impliedEndIndent` (or corrected `endIndent`) to logical end padding;
- `impliedFirstLineIndent` (or corrected `firstLineIndent`) to `text-indent`;
- paragraph direction to logical LTR/RTL layout; and
- paragraph alignment to the matching paragraph rather than only the first
  style range.

The measurement model now includes left and right padding plus the strongest
first-line or hanging indent when scoring synchronized widths. The regression
fixture covers implied values, corrected raw values, hanging indents,
per-paragraph ranges and RTL logical mapping. Valid indents are rendering input,
not warnings.

## 11. Case TR-003 — Superscript character range mistaken for copy mismatch

**Status:** Implemented and regression-verified in patch build
**Affected build:** `turbo-preview-7.8.4` patch build
**Evidence package:** Latest supplied `design.psd.zip` for Vonjo Production_v2
**Affected layers:** Six Vonjo text layers in `rawLayers`

### Symptom

Production comparison or extracted text reports `109/L`, while the approved
visual typography is `10⁹/L`. The source string is intentionally plain `109/L`;
the `9` is formatted by a Photoshop character-style range.

### PSD evidence

The six matching layers all contain:

- source text: `Patients With Platelets <50 x 109/L Achieving ≥35% SVR From Baseline to Week 24`;
- `textStyleRange` `[32, 33)` containing the character `9`; and
- `baseline._value: "superScript"` on that range.

The source copy must remain unchanged. Range offsets are Photoshop string
offsets and must be applied before any display-only normalization.

### Root cause

The renderer had superscript support, but separate live-text paths constructed
their run elements independently. That made superscript behavior dependent on
which path rendered the layer. Plain-text extraction also cannot distinguish
normal `9` from a visually superscript `9`.

### Implemented correction

All live-text paths now use one shared run-element constructor. It preserves the
source text, applies the run's superscript/subscript metrics and baseline, and
adds a machine-readable rendered-baseline marker for QA. This is a general
text-range correction, not a Vonjo-specific string replacement.

### Detection and live confirmation

The regression verifies that the source character at `[32,33)` is `9`, that its
run is superscript, and that the source copy remains `109/L`. Live confirmation
should inspect the rendered run's computed font size, vertical alignment,
baseline marker, and glyph bounds. Plain `textContent` is not a valid visual
comparison oracle.

### False-positive exclusions

Do not report a copy mismatch merely because an extracted string contains
`109/L`. Report a typography mismatch only when the style range is missing,
not covered, rendered at body size, or positioned on the normal baseline.

### Designer-facing message

> The approved copy is `109/L`, with the 9 formatted as superscript. The text
> source is correct; compare the rendered typography rather than the extracted
> characters.

### Validation fixture

The exact Vonjo copy and ranges `[0,32)`, `[32,33)`, `[33,46)`, `[46,47)`, and
`[47,80)` are covered by `tests/structure/vonjo-superscript.test.mjs`.

## 12. Case TR-004 — Paragraph text laid out from tight ink bounds

**Status:** Disconfirmed for Vonjo desktop expandable after live-production verification
**Affected build:** `turbo-preview-7.8.5` current patch line
**Evidence package:** Latest supplied Vonjo `design.psd.zip`
**Affected state:** `970x546 > tab3 > slide1`
**Affected copy:** `At Week 24, 29% of patients receiving VONJO 200 mg twice daily achieved ≥35% SVR, compared with 3% on BAT.`

### Symptom

The selected paragraph remains visually different from the production 970×546
output even though its copy and line breaks are correct. The mismatch is most
visible in the paragraph's vertical placement and line-box geometry.

### PSD evidence

The matching 970×546 layer has:

- tight layer bounds: `356 × 50px`;
- paragraph text-shape bounds: `358.8036 × 60px`;
- paragraph text mode: `box`;
- three style ranges: `[0,72)`, `[72,73)` for the Arial `≥` glyph, and
  `[73,107)`; and
- automatic leading at 16px type.

The 60px text-shape rectangle is the authored paragraph box. The 50px layer
bound is the tight visible/ink bound and is not a safe substitute for the
paragraph's layout height.

### Initial hypothesis — disconfirmed

The local rendered-state diagnostic reports a 356×50px host for three 19.2px
lines and a `-3.5px` paragraph offset. That initially appeared to identify a
wrong layout rectangle. However, the live production DOM for the same layer
(`layer 189093`) uses the identical values:

- host: `left: 86px; top: 103px; width: 356px; height: 50px`;
- paragraph offset: `top: -3.5px`; and
- font: `Acumin Pro Medium`, 16px, 19.2px line-height.

The local and production runtime therefore agree on this geometry. The local
rendered-state diagnostic remains useful evidence of an overflow condition,
but it is not by itself proof of a production mismatch.

The local diagnostic reports:

- authored host: `356 × 50px`;
- measured glyph bounds: approximately `358.086 × 57.391px`;
- measured height delta: `+1px` after synchronization;
- live visible height: `57.391px`;
- bottom overflow: `true`; and
- vertical correction: `top = -3.5px`.

The separate Arial range for `≥` is valid and does not explain a confirmed
production mismatch. A new comparison must first ensure that the same
production timeline/tab/slide state is active; the live URL initially shows
the video/ISI state while the supplied screenshot shows the Efficacy content
state.

### Detection proposal

For paragraph text (`textShape.char = "box"`), retain both geometry sources:

- tight ink bounds for visual glyph/clip diagnostics; and
- text-shape bounds for the authored layout box.

Raise a diagnostic when the live glyph height exceeds the tight layer height
but fits within the text-shape height. This distinguishes a wrong renderer
rectangle from genuine clipping or an incorrectly authored Photoshop layer.

### Live confirmation

Compare the rendered text against the paragraph-box rectangle, not only the
tight layer bounds. Confirm that the text remains inside the authored
text-shape height and that no compensating negative paragraph offset is
required. The production screenshot supplied for this case shows the expected
three-line paragraph without the preview's tight-box overflow correction.

### Scalable correction direction if a future A/B comparison proves a mismatch

Introduce explicit `layoutBounds` and `inkBounds` in the render model only if
the production A/B evidence shows that production and preview choose different
rectangles. Do not change the current geometry based on this Vonjo case alone.

Do not fix this by adding a Vonjo-specific offset or by changing the copy.

### Validation fixture

Use the six matching Vonjo paragraph instances in `export.json`, especially the
970×546 layer with `356×50` tight bounds and `358.8036×60` text-shape bounds.
The regression should assert that the same production timeline/tab/slide is
active before comparing geometry, then compare the host rectangle, paragraph
offset, font metrics, run boundaries, line breaks, and screenshot output.

## 13. Case TR-005 — Auto-leading and deterministic superscript metrics diverge from production

**Status:** Root cause confirmed; renderer correction pending
**Affected build:** `turbo-preview-7.8.5` current patch line
**Evidence package:** Latest supplied Vonjo `design.psd.zip`
**Affected state:** `970x546 > tab3 > slide1`
**Affected layer:** `189094` — `Patients With Platelets <50 x 109/L Achieving ≥35% SVR From Baseline to Week 24`

### Symptom

The local and production DOMs contain the same source string and the same
superscript range, but the headline is laid out differently. The local block
uses a 27px line box and an approximately `-11.34px` paragraph correction;
production uses a 19.2px line box and approximately `-3.36px`.

### Confirmed evidence

The PSD source has a 16px style with `leading: 27` and `autoLeading: true`.
The production DOM resolves that combination to `line-height: 1.2` (19.2px),
so the authored leading value is not being used as a fixed CSS line height.
The local renderer currently prefers the raw leading value before applying the
automatic-leading fallback. This creates a three-line pre-sync measurement,
then a two-line post-sync result with `data-wrap-unresolved="true"` and an
incorrect vertical correction.

The exact superscript treatment also differs:

- production: `font-size: 9.6px`, `line-height: 0`, `vertical-align: 5.28px`;
- local: `font-size: 9.28px`, `line-height: 0`, `vertical-align: super`.

The local paragraph also emits `font-weight: 700`, while production inherits
`font-weight: normal` from the static Bold font family. This is a secondary
font-selection risk, but not the primary wrap failure.

### Root cause

The renderer conflates Photoshop's stored leading value with CSS fixed
line-height even when Photoshop marks the style as automatic leading. It also
uses browser-dependent `super` positioning and a 58% superscript scale rather
than the production renderer's deterministic size and baseline offset.

### Historical build check

This logic is not new to 7.8.4. The same leading selection and superscript
mapping are present in `turbo-preview-7.7.0`, `7.7.1`, `7.8.0`, `7.8.1`,
`7.8.2`, and `7.8.3`:

- raw `style.leading` is preferred over automatic-leading semantics;
- superscripts use `0.58 × font size` and CSS `vertical-align: super`; and
- paragraph line-height is derived from the resulting leading value.

Build 7.8.4 added font-cap handling, paragraph-style/indent handling, unified
run-element construction, and more glyph measurement/synchronization. It did
not introduce the underlying leading or superscript formulas, but its new
measurement and wrap-resolution path makes their effect visible as the
`candidate-search-did-not-converge` state. Build 7.8.5 retained those formulas;
7.8.6 applies the shared semantic correction described below.

### Scalable correction direction

Resolve leading through an explicit typography policy: automatic leading must
follow the production auto-leading rule, while explicit leading must remain
fixed. Do not apply `1.2` globally. Cross-showcase production checks found
ratios including `1.2`, `1.21`, `1.13`, `1.05`, `1.38`, `1.83`, `0.76`, `0.79`,
`0.87`, `1.09`, and `1.18` across Evenity, La Roche-Posay, and Tryngolza.

The superscript rule is more consistent across the checked units: production
uses approximately `60%` of the base font size, `line-height: 0`, and an
explicit baseline offset of approximately `33%` of the base font size. Use
deterministic run metrics rather than the browser's `super` keyword. Preserve
the font family/style contract so a family whose name already identifies Bold
is not additionally synthesized through a numeric weight unless the font map
requires it.

### Cross-showcase verification

Live production DOM checks were completed for the desktop expandable entry in
all eight supplied showcases: Vonjo, Xdemvy, Evenity, La Roche-Posay, Pure
Encapsulation, Tryngolza, Children's Tylenol, and TRYPTYR. Each selected the
desktop expandable source and produced a visible `970x546` creative frame.

Vonjo confirmed the target `19.2px` line-height and `9.6px / 5.28px`
superscript metrics. Xdemvy, Evenity, La Roche-Posay, Pure Encapsulation, and
Children's Tylenol confirmed the same approximately `60%` superscript size and
`33%` baseline offset. Line-height varied by creative, including explicit
ratios such as `1.09`, `1.15`, `1.21`, `1.32`, `1.35`, `1.38`, `1.83`, and
`2.2`; therefore the renderer must not impose a universal `1.2` value.

### Validation fixture

Compare local and production DOM snapshots for layer `189094` and assert the
resolved line height, paragraph offset, run boundaries, superscript size and
baseline, font family/weight, line count, and absence of unresolved wrapping.
The source string must remain `109/L`; only the rendered `9` is superscript.

## 14. Case TR-009 — Paragraph-frame substitution causes widespread text overlaps

**Status:** Initial geometry hypothesis rejected; regression reverted in corrected 7.9.8. Original Tryngolza appearance explained by TR-010's shape mismatch.

**Affected build:** Initial 7.9.8
**Evidence:** Tryngolza export and user-supplied SPIRIVA, COSENTYX DTC and Ipsen render screenshots

### Symptom and confirmed evidence

The initial 7.9.8 change caused headings and body text to overlap across
multiple artboards. User screenshots confirm visible regressions. The earlier
Tryngolza report concerned paragraph overflow inside the 300×600 circle.

Tryngolza layer 243085 has tight bounds of 192×109px, an authored frame of
196×120px, and a transformed text shape of approximately 195.58×120.33px.
These descriptor values are confirmed. The prior claim that this proves
production uses the larger frame was unsupported and is withdrawn.

### Confirmed regression cause

The frame-substitution guard accepted most paragraph text in the audited
packages. Replacing host position, width and height changes line wrapping and
alignment. Production's synchronizer also vertically centers measured glyphs
within the host height; a larger design-time frame can therefore shift visible
copy into neighboring text even when the same fitting algorithm is used.

The production container source consumes existing inline CSS; it does not
specify how export geometry becomes that CSS. Catalog section 12 supplies
contrary live evidence: production uses tight bounds for a paragraph whose
design-time frame is larger. Agreement between exported frame descriptors
is insufficient evidence for replacing the production host.

### Detection and false-positive exclusions

Compare the affected layer's actual production host CSS, computed typography,
paragraph/run topology and synchronized output with the same local state.
Neither `textShape.char = box` nor a matching `boundingBox` establishes a
renderer defect. Do not raise a designer warning or prescribe a Photoshop
repair from those descriptors alone.

### Designer-facing explanation and Photoshop repair

> The preview introduced a text-layout regression. Restore the renderer's
> production host geometry before changing approved copy or Photoshop layers.

The original apparent overflow is a renderer shape error (TR-010); no Photoshop repair is recommended.

### Tool behavior and validation limits

Corrected 7.9.8 restores 7.9.7 exactly apart from the build identifier.
`tests/structure/paragraph-text-bounds.test.mjs` verifies tight hosts and exact
source restoration. A separate package audit evaluates those helpers across
all text layers in Tryngolza, SPIRIVA, COSENTYX DTC and Ipsen; this is a
geometry-equivalence check, not rendered validation.

The initial tests asserted the proposed behavior and passed despite the
visual regressions. The browser tool rejects local `file://` pages, so local
visual comparison was not performed and must not be reported as complete.

## 15. Case TR-010 — Rounded rectangle painted as a circle appears to leak text

**Status:** Root cause confirmed against live production; shape correction implemented in 7.9.9; user visually accepted the local result on 2026-10-14. Reported issue closed.

**Affected builds:** Through corrected 7.9.8.

**Evidence:** latest Tryngolza ZIP; [live production showcase](https://showcase.vdx.tv/cc/n/0/#FgjxqA/10); original local screenshot.

**Matched state:** Desktop Inframe, 300×600, Why Lower?, slide 2.

### Symptom

Copy appears to escape the pale circular panel in the local preview. Production
contains the same paragraph within a pale rounded rectangle. The mismatched
shape reduces the available background area near its lower and side edges.

### Confirmed evidence

The matching panel layer 243083 exports origin type 2, dimensions 217×218px
and four 14px corner radii. Production's DOM uses those dimensions and
`border-radius: 14px`; the paused production screenshot shows the rounded
rectangle. The local ordinary-shape collector used a 9999px radius for origin
types 2 and 5, overriding the authored radii and turning this nearly square
panel into an ellipse.

Production text layer 243085 uses a synchronized 194.625px width and 109px
host height, 13px Poppins type, 1.2 line-height and paragraph offsets of
-0.25px/0px. Its seven line breaks match the original screenshot. The earlier
120px paragraph-frame substitution hypothesis is rejected.

### Root cause and correction

The ordinary shape path bypassed `getShapeBorderRadius()`, although the
existing helper already maps all four Photoshop corner radii for other paths.
Build 7.9.9 wires this helper into ordinary shape collection. Paint-time radius
scaling remains shared. All text behavior remains identical to corrected 7.9.8.

### Detection signals and false-positive exclusions

Compare the background's exported corner radii and actual production silhouette
before attributing apparent containment failure to text wrapping. A rounded
shape origin type alone does not mean a circle or pill. Preserve distinct
corners and zero values. True ellipse fallback, plain rectangles and shapes
without complete exported radii retain the existing helper behavior.

Do not raise a designer text warning when the preview alone has narrowed the
background silhouette. Do not resize text or alter approved copy to compensate
for a shape reconstruction error.

### Designer-facing explanation and Photoshop repair

> The preview painted your rounded rectangle as a circle. Restoring its
> exported 14px corners restores the background area around the text.

No Photoshop or copy repair is required for this confirmed case.

### Validation and limits

`tests/fixtures/tryngolza-panel-production.json` records the observed production
dimensions and text metrics. `tests/structure/ordinary-shape-radii.test.mjs`
evaluates the full engine through collection and CSS painting, including
asymmetric/zero corners, scaling and ellipse fallback. A source comparison
asserts that 7.9.9 changes only the ordinary-shape radius line and build label.

The repeatable audit in `scripts/verify-shape-radius-parity.mjs` traverses 229
states across Tryngolza, SPIRIVA, COSENTYX DTC and Ipsen. Only 30 shape layers'
radii change; all 852 collected text instances and other model properties
remain unchanged. This is model/CSS validation. Production was inspected
visually; automated local browser pixel comparison remains unavailable because
the browser tool blocks `file://` pages.

## 16. Case TR-011 — Responsive vertical remapping causes cross-layer text collisions

**Status:** Root cause confirmed; global branch-level correction implemented and live-verified in 7.9.11.
**Affected builds:** 7.9.9 and earlier per-leaf implementations caused collisions; 7.9.10 removed those collisions but left a blank band below shortened full-width video.
**Evidence packages:** Tryngolza, Ipsen, TRYPTYR, Alprolix, SPIRIVA and COSENTYX DTC.
**Affected artboard:** focused `428x622` rendered through the 375×622 responsive host.

### Symptom

Headings, body copy, footnotes and CTA text overlap in multiple unrelated creatives at 375×622 even though their Photoshop layers do not overlap. The issue can appear below responsive video and can vary by slide.

### PSD evidence and root cause

The affected leaves retain distinct authored y coordinates and belong to one state timeline. The preview shortened a 428px-wide video for the 375px host, then independently moved any leaf whose top crossed the shortened video's bottom. Siblings on opposite sides of that computed threshold received different offsets, collapsing their authored vertical gaps. This is a preview layout defect, not bad copy or a Photoshop collision.

The same audit found two adjacent global causes that can resemble content defects: a centered 428px ISI frame was cropped by the 375px host, and Preview controls exposed tabs/slides that did not exist on the selected artboard. Build 7.9.10 corrected those cases and removed the per-leaf boundary shift, but preserving every authored y-position left the following sibling branch at its original top after the video became approximately 30px shorter. Production instead applies that video-height delta once to each direct sibling branch. Build 7.9.11 implements that structural rule while retaining the other 7.9.10 corrections.

### Detection and false-positive exclusions

Compare rendered sibling y deltas with their exported bounds before reporting a content overlap. Flag the renderer when independently remapped leaves reduce a nonnegative authored gap below zero. Exclude intentional Photoshop overlap, timeline/stack states that are deliberately clipped, and text whose actual measured glyph bounds already exceed its authored host without any responsive offset.

### Designer-facing explanation and Photoshop repair

> The mobile preview moved related layers by different amounts after resizing the video, which created an overlap that is not present in the source design.

No Photoshop or copy repair is required. Preserve the source layers and correct the preview mapping.

### Tool behavior and validation fixture

The preview should not raise a designer-facing text defect for this renderer-created collision or for the temporary blank band introduced by preserving all y-positions. Regression coverage must assert that a qualifying full-width video's rounded height delta is applied once to its direct sibling branch, descendants keep their local spacing, and contained video or unrelated structures do not move. It must also retain responsive ISI, left/center/right circular controls, and state-control scoping coverage. Live 375×622 measurements in 7.9.11 closed the seam to `-0.156px` in Tryngolza, Ipsen and TRYPTYR; Alprolix correctly retained its authored approximately `16.8px` internal spacing because it lacks the qualifying sibling relationship.

## 17. New-case template

Copy this section for each future case.

### Case TR-XXX — Short descriptive name

**Status:** Observed / Reproduced / Detection proposed / Implemented / Verified  
**Affected builds:**  
**Evidence packages:**  
**Affected artboards and layers:**

#### Symptom

Describe what the designer sees and what was expected.

#### PSD evidence

Record the relevant `export.json` descriptors, geometry, typography, layer
structure, and any meaningful old/new comparison.

#### Root cause

Separate confirmed facts from inference. State whether the issue originates in
the PSD, exporter, preview renderer, browser layout engine, or an interaction
between them.

#### Detection proposal

Define the smallest general rule that detects the risky structure. Include
confidence signals and false-positive exclusions.

#### Live confirmation

Describe any DOM or canvas measurement required before escalating severity.

#### Designer-facing message

Write a short explanation without implementation jargon.

#### Photoshop repair

Provide numbered, reversible steps that preserve editable live text.

#### Tool behavior

Specify where the finding appears, its default severity, and whether any safe
automatic action is possible.

#### Validation fixture

Record the before/after packages or minimal fixture needed for regression tests.

## 18. Text QA capture workflow

Baseline Optical-kerning and genuine rendered-state measurement failures are
discoverable without a query parameter. To capture a comprehensive diagnostic
case, open the preview with `?textQA=1`, load the latest package, and allow the complete
text audit to finish. Each diagnostic row provides a **Copy case** action that
copies a catalog-ready Markdown draft containing:

- the preview build and loaded package;
- artboard, tab, and slide context;
- the affected layer name and finding category;
- the diagnostic detail and stable QA key when available; and
- the measured Text QA metrics when available.

Paste the draft into this catalog, replace `TR-XXX`, and complete the root-cause,
detection, Photoshop repair, and validation sections. The copied draft is
evidence scaffolding, not a confirmed diagnosis; verify it before saving it as a
catalog case.
