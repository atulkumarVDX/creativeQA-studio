# 04 — Decisions Log — Turbo Export Preview

> **Current release: 7.12.0** — `preview/turbo-preview-7.12.0.html`. Adds host-level first-view candidate filtering and budget review; renderer behavior is inherited from 7.11.16. See [First-view validation](20-First-View-Validation.md). Historical baseline descriptions below are retained.

**Doc version:** 1.7.8
**Reflects build:** `preview/turbo-preview-7.12.0.html` @ **v7.12.0** (current); historical baselines are described below.
**Last updated:** 2026-10-14
**Status:** ⚠️ Reconstructed from source-code comments and diffing three source files. No prior doc set was found in this workspace or project folder. This is a new baseline, not a recovered history — see the note at the bottom.

**Current screenshot release:** `preview/turbo-preview-7.9.11.html`. The main sections below preserve the 7.7.0 baseline; current capture decisions are recorded below and in `08-Screenshot-Capture-Tool.md`.

---

## How to read this log

Entries are grouped by the file(s) they apply to. Each entry is a real, code-confirmed decision extracted from an inline comment in the source (the codebase already documents its own "confirmed against real data" rationale unusually well — this log is that rationale pulled into one place, going forward it should be updated *at the time of the change*, not reconstructed after the fact).

Format: **[Component] Decision — Rationale — Evidence**

---

## D000 — Documentation baseline reconstructed (2026-08-26)

No `01-PRD.md` / `02-Technical-Spec.md` / `03-UI-UX-Guidelines.md` / `04-Decisions-Log.md` / `05-Docs-Maintenance.md` existed in `/mnt/project` or anywhere else in the environment. All five docs were reconstructed from the current state of `index.html`, `preview.js`, `turbo_preview_artifact_5.html`, and `turbo_preview_artifact_7_4_1.html`, including their inline comments. Historical decisions made *between* artifact_5 and artifact_7_4_1 that aren't evident from a code diff (e.g. exact dates, who/why beyond what's commented) are **not recoverable** and are not fabricated here.

## D001 — Version/build tag drift found and normalized (2026-08-26)

- `turbo_preview_artifact_7_4_1.html`'s filename encodes **v7.4.1**, but its own `PREVIEW_BUILD` constant read `"1.0.1"` — inconsistent with the filename and with no semver relationship to `turbo_preview_artifact_5.html`'s date-based tag (`2026.08.15-text-render-fix.4`).
- `index.html` and `preview.js` use a matching date-based tag (`2026.08.14-nav-label-fix.3`) and are internally consistent with each other, but use a different scheme than the artifact line.
- **Decision:** adopt filename-driven semver as ground truth for the Turbo Preview Artifact line going forward. `turbo_preview_artifact_7_4_1.html` is now the canonical **v7.4.1**; its internal `PREVIEW_BUILD` should be corrected to `"7.4.1"` to match (flagged as an open fix — see 02-Technical-Spec.md open issues). `turbo_preview_artifact_5.html` is retroactively labeled **superseded / pre-7.x** — we do **not** assign it a fabricated precise predecessor number (e.g. "7.3.0") without evidence; treat it as deprecated.
- The Standalone line (`index.html` + `preview.js`) is versioned independently as **v1.0.0**, this being its first formally-tracked version.
- See `05-Docs-Maintenance.md` for the semver policy going forward.

## D002 — [Text bounds] Use tight `bounds`, not authored `boundingBox`, for wrap width (artifact_5 → 7.4.1)

Photoshop's `bounds` is the layer's actual rendered/wrapped box; `boundingBox` is the authored design-time frame and can be legitimately wider. Since the browser re-wraps text itself, only `bounds` is guaranteed to reproduce Photoshop's own line breaks. Confirmed against a real package: a 300×250 paragraph's production CSS width (223px) matched `bounds` almost exactly, not `boundingBox` (233px).
**Superseded index.html behavior:** used a mixed tight/frame heuristic keyed off paired-underline detection and multi-line content — replaced by the simpler, more accurate `bounds`-only approach in later builds.

## D003 — [Text bounds] Add a fixed 6px kerning buffer to text width (artifact_5)

`bounds.width` is a zero-slack measurement matching Photoshop's own widest rendered line exactly. But multi-run text (bold lead-ins, superscript footnotes, mixed weights) is reconstructed here as sibling `<span>`/`<sup>` elements, and browsers don't kern across inline-element boundaries the way Photoshop's single continuous run does. Confirmed directly across multiple packages that this under-measures by several px (worst case so far: 6px, on a 5-run headline), causing unwanted extra wraps. A fixed `TEXT_WIDTH_KERNING_BUFFER_PX = 6` absorbs the worst confirmed case without being large enough to admit a whole extra word (verified against the paragraph that originally established `bounds` as correct).

## D004 — [Shape bounds] Use precise vector bbox (`keyOriginShapeBBox`), not raster `bounds`, for shapes (artifact_5)

Photoshop's `bounds` for a vector shape is pixel-snapped outward for rasterization and is consistently ~1.5–2px wider/taller than the true vector geometry on rounded shapes (confirmed: one CTA pill measured 112×29 in `bounds` vs. 110.45×28.02 actual). Production renders from the vector path directly. `preciseShapeBoundsOf()` reads `keyOriginType[].keyOriginShapeBBox` when present, falling back to `bounds` for straight-edged shapes (e.g. underlines) where the two already agree.

## D005 — [Color parsing] Handle float-channel RGB descriptors, not just int (7.4.1)

Some text/stroke styles carry `redFloat`/`greenFloat`/`blueFloat` (0–1) instead of the usual int `red`/`grain`/`blue` (0–255) keys. Reading only the int keys on a float-shaped descriptor silently returns 0 for every channel — solid black — which caused a cyan stat number and its label to render fully invisible against a dark hero image with no error signal. `rgbChannels()` detects which shape is present and clamps to 0–255 (float channels have been observed drifting slightly negative or over 1.0 from color-space conversion).
**Note:** `turbo_preview_artifact_5.html` still has the old int-only reader — this is a known, unfixed regression risk in that file (see 02-Technical-Spec.md open issues).

## D006 — [Layout] `isSingleLineText` reference height: prefer font size over leading (7.4.1)

Leading controls inter-line gap in wrapped paragraphs and has no fixed relationship to a single line's own ink height. Large display numerals are sometimes authored with leading deliberately tighter than font size (confirmed: 55pt "73%" with ~21px implied leading). Using leading as the single-line-detection yardstick misclassified such text as wrapped, feeding the too-small leading into the renderer's line-height and pulling the glyph up over content above it. Swapped priority to `sizePx || lineHeightPx`.
**Note:** `turbo_preview_artifact_5.html` still uses the old `lineHeightPx || sizePx` priority.

## D007 — [Layout] Underline vertical epsilon reduced 4px → 2px (artifact_5 → 7.4.1)

Small fixed clearance absorbing the sub-pixel gap between Photoshop's text rasterization and browser font rendering at compressed line-height. Value tuned down between artifact_5 and 7.4.1; both versions apply it only to authored `Underline*` shapes, never runtime-measured (a prior runtime-measurement approach compounded errors from text that had already fallen back to frame origin).

## D008 — [Line breaks] Photoshop `\r` line breaks must be normalized to `\n` (all versions)

Photoshop's `textKey` content uses `\r`/`\r\n` for in-layer line breaks (e.g. `"Prescribing Information\rClinical Trial Info\r"` is one layer meant to render as two lines). CSS `white-space: pre-wrap` only treats `\n` as a forced break — a lone `\r` renders as nothing, silently collapsing lines together. This was the actual root cause of early "duplicate/overlapping copy" QC reports, not a duplicate layer. `normalizeTextNewlines()` / `normalizeTextContent()` fix this in all three files.

## D009 — [Fonts] `@font-face` injection required before measuring text (all versions)

A fallback font's different metrics can force extra line-wraps the design's text boxes weren't sized for, cascading into visible text-over-text overlap. Confirmed as the actual root cause of widespread "text overlapping" reports, not isolated per-layer bounds bugs. `buildFontFaceCSS()` generates `@font-face` rules from `export.json`'s `fonts` array before the stage is first painted.

## D010 — [Fonts] `document.fonts.ready` does not trigger a fetch — must call `.load()` explicitly (artifact_5 → 7.4.1)

`document.fonts.ready` only resolves once fonts that have *already started* loading finish; injecting `@font-face` rules alone doesn't start a fetch until something renders with that family. Confirmed directly: every font's `.status` was still `"unloaded"` even after awaiting `document.fonts.ready` in this flow. Result: the stage was measured/painted against fallback-font metrics, and any snapshot taken before the later background reflow froze the wrong, over-wrapped layout. Fix: explicitly call `document.fonts.load(...)` per declared family and await those promises (backstopped by `document.fonts.ready`) before `buildSizePicker`/`renderStage` ever measures text. **Not present in `index.html`/`preview.js`** — that file awaits `document.fonts.ready` only, so it may be subject to this same bug; flagged as an open issue for the Standalone line.

## D011 — [Nav] Per-size `tabButtons` layer has no PNG; nav is reconstructed from master (all versions)

The per-size `tabButtons` smart-object placeholder is confirmed to have zero rasterized files under any layer ID. The real content (per-tab title text, active/normal pill backgrounds, bottom border) lives once in the master artboard's own `tabButtons` folder. All three files reconstruct the nav bar at render time by remapping master's geometry onto each artboard's own placeholder region rather than attempting to load an image.

## D012 — [Nav] Master lookup must not depend on an artboard literally named "master" (7.4.1)

Some packages omit or rename the master artboard. Since a per-size placeholder has no children but the real nav folder always owns a `frame` child, `buildMasterNav()` falls back to scanning all raw layers for any `tabButtons` folder containing a `frame` child, rather than requiring a `master`-named artboard. **Not present in `index.html`/`preview.js` or `artifact_5`** — both require an artboard named `master`.

## D013 — [Nav] Tab label styling borrowed by state, but label text fixed by tab number (all versions)

Master often authors only one state variant per tab number (e.g. `title1_active` + `title2_normal` + `title3_normal`, no `title1_normal`). Position and label *text* always come from that tab number's own layer (labels genuinely differ per tab). Visual *style* (fill, text color/weight, pill shape) for active/normal is borrowed from whichever template of the right state exists anywhere in the folder, independent of which tab number authored it.

## D014 — [Nav] Borrowed style templates carry the wrong glyphs in `runs` — must drop to plain content (7.4.1)

When a title's visual style is borrowed from another tab's template (D013), that template's `getTextStyle()` result still carries its own `runs` (e.g. tab 3's "Coverage" glyphs). The renderer paints from `runs` when present and **ignores** `content` in that case — so a content-only label fix silently no-ops on screen. Fix: when the label is overridden by the fixed per-tab text, also null out `runs` so the plain-content path is used. Tab titles are always single-uniform-style with no bold/italic/superscript mixing, so this loses nothing.
**Not present in `turbo_preview_artifact_5.html`** — that file has the D013 borrowing logic but not this `runs`-nulling fix, meaning it can display the wrong label text if a template is borrowed cross-tab. Flagged as an open issue for that file.

## D015 — [Nav] Duplicate same-named `slideN` siblings must be caught by name, not just layerId (7.4.1)

A real `export.json` has shipped with two sibling groups both literally named `slide4` under the same gallery. Building the slide map by name only registers one; the orphaned duplicate has no known `layerId` in the slides map and inherits its own `visible:true`, rendering on every slide instead of none. Fix: check the layer's own name against the slide pattern (`isSlideSibling`) in addition to `layerId` map membership. **Not present in `turbo_preview_artifact_5.html`.**

## D016 — [ISI/Disclaimer] Reconstruct the ISI panel from the package's own `disclaimer.html` (7.4.1, new capability)

The `isi` marker layer is a plain shape with no rasterized PNG (its live copy is runtime-injected by a separate widget in production). `parseDisclaimerHtml()` extracts the package's own `<style>` rules, Google Fonts link, title text (from `#titleHtml`/`.title`, re-rendered as our own title bar rather than trusting its inline `display:none`), and body content, then renders it scoped to each artboard's `isi` placeholder bounds with a `.notice.size_XXX` class matched against what the package's own CSS actually defines (falling back to `.notice.mainunit`).
- Background is supplied by the tool's own CSS (`#fff`), not by `disclaimer.html`, because the package's CSS only colors `.title`, never the content/notice background, and the PSD's own `isi` fill is a non-visual placeholder — without an opaque background, dark disclaimer text was unreadable over dark hero imagery on compact sizes.
- The tool's global `* { margin:0; padding:0 }` reset strips UA default paragraph margins that `disclaimer.html`'s own negative-margin rules (e.g. `margin-bottom: -10px !important`) are authored against, pulling lines up over each other. Fixed by reverting to `margin/padding: revert` scoped to `.cp-isi.notice .content *` only.

## D017 — [Nav] Vertical/rotated sidebar nav for narrow-tall artboards, e.g. 160×600 (7.4.1, new capability)

Confirmed against real data (a 160×600 SPIRIVA package): the `tabButtons` placeholder can be **taller than wide** (26w × 290h), sitting flush against the artboard's right edge. Master only ever authors the horizontal pill bar — this is the same geometry and styling rotated 90°, not a separately authored design. `naturalBox()` computes the pre-rotation box such that rotating it -90° about its own center lands it in the correct final position (solved algebraically from the desired final center, not approximated). The PSD's own Free Transform on this sidebar was confirmed at exactly **-90.00°** (CCW) — using +90° mirrored every pill/label end-to-end.

## D018 — [Nav] Tab label font must scale with pill width, or it overflows into neighboring tabs (7.4.1)

Tab label font size is authored to just fit its pill at 1:1 scale (zero slack, see D003). If the pill's box shrinks (`scaleX < 1`) while the font stays at master's raw point size, glyphs bleed into the neighboring tab. Confirmed as the actual cause of real label-overlap reports across every affected size, including 970×546 where the scale factor is close to but still under 1. `scaleTextStyle()` scales font size (and, via existing sizePt-derived fields, line-height/tracking) by the same factor applied to the box.

## D019 — [CTA] "Learn More" button label must be centered in its authored button frame, not its own text bounds (7.4.1)

Button label text layers are detected by name (`/^learn\s+more$/i`) and, when a sibling shape literally named `frame` exists in the same parent, the label is positioned/sized to that frame's precise vector bounds instead of its own tight text bounds — so the label centers correctly inside the actual button shape.

## D020 — [Layout, mobile] Per-card horizontal scroll instead of unbounded document growth (7.4.1)

`.cp-stage` is sized to the artboard's true pixel width via inline style (e.g. 970px), which on a narrow viewport is wider than its card. Without a scroll boundary, that overflow still contributes to every ancestor's scrollable area up to `<body>`, silently growing the whole document past the viewport width. Confirmed directly: a single 970px artboard on a 390px mobile viewport pushed `document.body.scrollWidth` to 986px, which broke the sticky control panel's positioning (the actual cause of "artboard bleeding over the header," not a z-index/sticky bug on its own). Fix: `overflow-x: auto` scoped to each `.cp-artboard-card`, keeping the document itself exactly viewport-width. **Not present in `turbo_preview_artifact_5.html`.**

## D021 — [Layout] `.cp-stage` needs an explicit stacking context (7.4.1)

`position: relative` alone (with `z-index: auto`) does not establish a stacking context — it only does so once both `position` and an explicit `z-index` are set. Without this, a layer's `z-index` (sourced directly from the PSD's `itemIndex`, confirmed to run into the 900s+ in real packages) escaped its own card and competed in the ancestor stacking context containing the sticky `#topBar`/`#controlPanel` (z-index 19/20) — any artboard layer with itemIndex > ~20 painted on top of the sticky panel once scrolled. Fix: `z-index: 0` on `.cp-stage` (the exact value doesn't matter, only that it's an integer). **Not present in `turbo_preview_artifact_5.html`.**

## D022 — [Layout] Sticky offset must be watched continuously, not measured once (7.4.1)

A single `syncStickyOffset()` call after load is insufficient: the tool's own UI font (Space Grotesk/Inter) swaps in asynchronously via Google Fonts and can change how `#topBar` wraps/sizes relative to its fallback-font layout. If that swap happens after the one-time measurement, `--top-bar-height` goes stale and the sticky panel misplaces. Fixed with a `ResizeObserver` on `#topBar` instead of event-driven re-measurement. **Not present in `turbo_preview_artifact_5.html`** (which only re-syncs on window `resize`).

## D023 — [Export scope] Dot-prefixed layers are never rasterized (all versions)

`NO_EXPORT_PREFIX = "."` — dot-prefixed layer names are skipped entirely during tree walks. Long-standing convention referenced by ID (`D023`) directly in code comments, predating this reconstruction.

## D024 — [Rasterization] Some layers export as `-2x` with no signal in `export.json` (all versions)

Confirmed against a real package: a layer with a plain name, `visible:true`, and no distinguishing flag was nonetheless exported as a `-2x`-suffixed file. The exporter decides this at rasterize time on a signal not present in `export.json`. Rather than guess which layers get this treatment, the image renderer retries once with a `-2x.png` variant on load failure before marking the asset missing.

## D025 — [Shapes] Fill color is data-driven (`fillEnabled` + adjustment color), never name-based (all versions)

Explicitly tried excluding shapes by name (e.g. "frame", "isi") twice; both times a real counter-example turned up — an "isi" instance with genuine fill data, and separately a "frame" whose fill was the actual intended white background behind "No design available" copy. The data itself is more reliable than guessing intent from a name. Trade-off accepted: structural marker layers that happen to carry leftover fill data will render as a plain color swatch rather than nothing — considered acceptable for a QC tool (an approximate colored box beats invisibility).

## D026 — [UI-chrome layers] Exclusion by name/role, not by layer type (all versions)

`NEVER_RASTERIZED_NAME_PATTERNS` (`tabbuttons`, `navigation_bottom_border`, `navigation_preview*`, `button-jump*`, `playicon`, and `isi` as of 7.4.1) are interactive UI-chrome components that stay live/clickable in the real exported ad rather than being flattened to an image — confirmed against a real package that no PNG exists for these under any layer ID. These are legitimate smart objects (layerKind 5), so the exclusion must be by name, unlike the layerKind===4 shape skip.

## D027 — [Video] Video source resolved via master's `videoPlaylist` folder naming convention (all versions)

Each `videoPlaylist` entry is a layer literally named `"{videoId} : {videoFileName} [{posterSecondOffset}]"` (confirmed real example: `"v1 : video1.mp4 [0]"`). A `video [v1]` (or `video [v1, v2]`) marker layer resolves its first videoId against this map rather than guessing a filename from its own name.

## D028 — [Rendering philosophy] Always render at true 1:1 pixel scale (all versions)

`computeScale()` always returns `1`. The page scrolls if artboards don't fit the viewport rather than auto-fitting/shrinking — the point of a QC preview tool is seeing true size, not a scaled approximation.

**Scoped exception (D043, v7.7.0):** `mobile-instream` in focused Preview mode may present the full-resolution stage through a production-matched 0.5× viewport, with an explicit 1× reviewer toggle. This does not alter source geometry or apply in Compare mode.

## D029 — [Underline pairing] Scope underline detection per-instance, not per-group (all versions)

A naive "this group contains an Underline-named shape somewhere" check wrongly forces every text layer in that group onto tight bounds, even headline/body copy sharing a parent with an unrelated footer-link underline (confirmed in real packages). `findPairedUnderlines()` requires the candidate to sit just below (or within, for multi-line) the specific text layer's own tight bounds **and** overlap it horizontally — falling back from direct siblings to "avuncular" (parent's-siblings) layers when one real package nests footer-link text an extra grouping level deeper than its underlines.

## D030 — [Text parity] v7.5.0 introduced an interim adaptive resolver without a corresponding documentation update

`turbo_preview_artifact_7_5_0_8.html` declares `PREVIEW_BUILD = "7.5.0"` and replaces the prior fixed kerning-buffer path with an adaptive post-font width resolver. It infers a Photoshop target line count, searches widths, excludes explicit-break text, and may compress line height to fit an authored frame. This source revision was not reflected in any project document, and the file name's fourth numeric component is not a valid SemVer form.

**Decision:** treat v7.5.0 as the reconciled baseline, not as the verified production-parity implementation. Direct production source and a COSENTYX layer-185637 input/output capture have now shown that production uses glyph geometry, paragraph/span DOM, a five-candidate width search, and alignment offsets instead. The next PATCH release must replace this interim path and normalize the artifact filename; its evidence and final behavior are recorded in the follow-up decision.

## D031 — [Text parity] Port recovered production PSD text synchronization (v7.5.1)

Recovered `vdx-container-turbo.js` exposes production's `syncTextWithPsd()` implementation, and the COSENTYX layer-185637 capture supplies an input/output reference: a fixed 260px × 88px wrapper becomes 260.711px wide and its three paragraphs receive `top: -3px` / `left: -0.210938px`. Production creates paragraph/lexical-span DOM, measures the clone's canvas/DOM glyph bounds, only searches when rounded glyph dimensions exceed the authored wrapper, evaluates the native width plus at most five candidates using `min(10, minSpanWidth)`, selects by total error (then height, width, delta), and applies paragraph offsets. It does this for every `adjustAsPsd` text layer; explicit returns, single-line text, and CTA labels are not exceptions.

**Decision:** `turbo_preview_artifact_7_5_1.html` replaces the v7.5.0 line-count resolver, height compression, explicit-break exclusion, intrinsic single-line widening, and CTA-frame substitution with a modular port of that production algorithm. It preserves the text layer's fixed PSD bounds, production font-family identity (including `Flama-Medium`), lexical paragraph/span topology, candidate limits, and final paragraph offsets. Syntax checks passed, and the parser successfully loaded all supplied COSENTYX DTC/HCP, SPIRIVA, Natrelle, and Ipsen packages. A rendered visual diff against the live production URL remains the final release-approval check because this environment blocks local `file://` browser rendering.

---

## D032 — [Gallery controls] Preserve PSD visibility and render circular progress geometry (v7.5.2)

The renderer already walks `dots`, `arrows`, `slideProgress`, `progressBar`, and `circularBar` through the selected PSD tree, so their group and ancestor `visible:false` flags are the authoritative static visibility source. The supplied exports show that this is not a global rule: COSENTYX/SPIRIVA commonly author arrows and `circularBar` visible while dots/progressBar are hidden, while Ipsen has both visible and hidden arrow/progress instances. In particular, SPIRIVA 728×90's supplied `export.json` marks `arrows: true`, `slideProgress: true`, `progressBar: false`, and `circularBar: true`; a contrary PSD/production capture must be treated as newer evidence, not generalized into a global arrow-hide heuristic.

The generic renderer lost two visible elements inside `circularBar`: `indicator` is a fill-less vector with a white authored colour, and `playIcon` is a non-rasterized smart object. Recovered production component CSS confirms that the real control uses a circular progress stroke and play glyph. **Decision:** v7.5.2 keeps all control visibility data-driven, renders only `circularBar/indicator` as a 1px colour-derived ring, and recreates only the `circularBar/playIcon` bounds as a white CSS triangle. It leaves dynamic progress timing, hover/disabled behavior, and any production-only visibility policy out of scope until package-specific production configuration is captured. Syntax validation passed; all five supplied packages contain the expected circular indicator/play pair where authored.

---

## D033 — [Gallery controls] Use recovered SVG geometry for circular progress primitives (v7.5.3)

The refreshed SPIRIVA package is valid and changes every `arrows` group to `visible:false`, resolving the prior stale-export conflict without any renderer override. Its visible `circularBar` contains a 21px filled green `frame`, a 17px fill-less white vector `indicator`, and a 20×22 non-rasterized `playIcon` smart-object wrapper. The v7.5.2 CSS triangle mistakenly filled the wrapper, making the play glyph much too large.

Recovered production `vdx-components-turbo.js` supplies the exact play path (`M0,0L30,20L0,40Z`) and styles its control glyph at 30% of the wrapper, centred. **Decision:** v7.5.3 uses inline SVG for both elements: an SVG circle over the indicator's precise PSD bounds with its exported 1px white stroke, and the recovered play SVG path centred at 30% of the `playIcon` wrapper. This is static QC geometry only; live progress fraction/animation remains out of scope until verified production state is supplied.

---

## D034 — [Gallery controls] Reconstruct non-rasterized mute/unmute SVG controls (v7.5.4)

In the refreshed SPIRIVA export, eight visible `circularBar` instances include `muteIcon` as a `layerKind:5` Smart Object without a matching PNG or custom asset. The generic image path therefore requested a nonexistent `muteIcon-{id}.png` and visibly exposed the missing-asset placeholder. The production `j.ad.html` corroborates that mute is supplied by separate player assets, while `vdx-components-turbo.js` supplies the exact inline SVG mute/unmute paths, default white colour, and 24×18 control geometry.

**Decision:** add `muteIcon`/`unmuteIcon` to the non-rasterized component list and reconstruct them only under a visible `circularBar`, using those production SVG paths. The static QC renderer uses the exported `muteIcon` state; it does not simulate click/video state transitions. The helper caps a mute glyph at the production 24×18 dimensions and centres it in the exported PSD wrapper, while preserving authored visibility and avoiding a replacement for controls outside `circularBar`.

---

## D035 — [Size selection] Make “All sizes” an explicit, reversible action (v7.5.5)

The Size row previously displayed “All sizes” as a passive status span even though the preview already maintained a multi-select `includedNames` set. That made clearing or restoring all sizes require individual chip clicks. **Decision:** replace the status span with an `aria-pressed` segmented button. It selects all available size entries from any partial state, clears the set when already fully selected, and turns Compare mode off before selecting all so the comparison cap cannot yield an incomplete result.

---

## D036 — [Text layout] Preserve explicit blank PSD paragraphs (v7.5.6)

The Ipsen 300×250 reference layer `221946` contains `\u0003\u0003` between the second reference and the copyright line. After normalization, that is an intentional empty third paragraph. The HTML renderer correctly created that `<p>`, but its reset `margin: 0` and lack of content produced no line box, collapsing the authored gap.

**Decision:** when a normalized paragraph separator closes a genuinely empty paragraph, place a `<br>` in that paragraph before starting the next one. The element reserves exactly one authored line-height but contributes no glyph span, so the recovered production glyph measurement and per-paragraph offsets remain unchanged. Do not add generic paragraph margins or spacing heuristics.

---

## D037 — [QC tooling] Package-wide optical-kerning scan + live sync-failure tracking (v7.6.0, new capability)

`syncTextWithProductionPsd()` itself is unchanged from D031 — this adds a reporting layer around
it, not a change to the algorithm. `scanPackageKerningRisks()` walks every artboard once at load
time and flags any text layer using Photoshop's `opticalKern` mode (undetectable by browsers,
D029/D031 area), classified by `classifyKerningRisk()` as `layout-risk` (wrapped text — kerning
mode change can shift the line count) or `cosmetic` (single-line text — kerning mode change is a
few px of letter-spacing only, never re-wraps).

Separately, a `MutationObserver` watches every rendered `.cp-text` node's `data-wrap-unresolved`
attribute live, surfacing any layer where `syncTextWithProductionPsd()` could not resolve a
candidate width — this is a genuine synchronization failure (not an optical-kerning cosmetic
note) and is deliberately kept as a separate, more severe list in the panel.

**Known limitation, not yet addressed:** `unresolvedWrapLayers` is only cleared on a fresh
package load. A layer that fails sync once and later succeeds (e.g. after a font finishes
loading on a re-visited tab) is not removed from the panel — the entry can outlive its cause
within a session. Flagged here per this reconstruction; not fixed in v7.6.0.

**Current-source note:** D042 supersedes this historical MutationObserver/session model with event-driven visible-state failure refresh plus a separately gated every-state audit.

## D038 — [UI] Control panel and comparison-layout redesign (v7.6.0)

Replaces the checkbox/segmented-button control row (03-UI-UX-Guidelines §4–§5, pre-7.6.0) with:
a dropdown size-popover (single-select radio in Preview mode, multi-select checkbox in Compare
mode), a segmented Compare/Preview view-mode switch (replacing the single stateful "Compare:
Off/On" toggle), a next-tab arrow control, and a package-load default of exactly one size
selected (`preferredEntries(1)`) rather than the previous default.

Compare mode's artboard layout is reworked from a flat wrapping grid into a fixed hero/wide/
banner/tall/square bento arrangement, with a `wide-bento` (two-column) variant active at
viewport ≥1988px and `compact-bento` (stacked) below it.

**Underlying engine unaffected** — `parseExport`, `collectRenderablesWithSelection`, and
`paintArtboard` are unchanged; this is a chrome-only revision. See 03-UI-UX-Guidelines.md for
the updated control descriptions and token values.

**Open issue flagged during this reconstruction (not yet fixed):** the file's `<style>` block
defines `:root` design tokens and several component rules (`#topBar`, `#controlPanel`, `.chip`,
`.drop-card`, etc.) **twice** — an original block matching pre-7.6.0 tokens, followed by a
"simplified UX prototype shell" block with different values that wins on cascade order alone.
This is not a styling choice, it's leftover superseded CSS that happens to still parse; see
Tech Spec §8 open issues. Do not treat the first block as intentional fallback styling in future
edits — it should be deleted, not built around.

## D039 — [Stabilization] Resolve v7.6.0 review findings before release

The v7.6.0 stabilization pass keeps the rendered workspace design while consolidating the
base and prototype CSS declarations into one canonical selector/token set. The earlier block
could not safely be deleted wholesale because the later shell was only a partial override;
the merge preserves base-only structural properties and later values where they conflicted.
Dead registration-mark and obsolete compare-limit selectors were removed.

Text-sync QC now has a real unresolved outcome for non-finite measurement or candidate-search
non-convergence. Findings use stable artboard + layer-ID keys, remain distinct when two layers
contain identical copy, and are removed when the same layer later synchronizes successfully.
Legitimate empty text is not reported as a sync failure. The visible "Review text (N)" button
now surfaces the count previously computed into a hidden summary element.

Compare mode is confirmed as all-available-sizes behavior for the redesigned bento workspace;
the stale four-size documentation applied only to the earlier Artifact UI. The 1987px CSS
mirror of `WIDE_BENTO_MIN_WIDTH = 1988` was removed: JS selects a layout class and CSS styles
that class without repeating the number. The build tag is restored as a subdued QA-traceability
badge. JSZip 3.10.1 is embedded in the artifact so ZIP loading works without the CDN.

## D040 — [Text layout] Scale leading onto transformed text's implied-size basis (reconciled in v7.7.0)

`getTextStyle()` already used `impliedFontSize` when present but raw `leading` has no guaranteed implied counterpart in the renderer path. The code computes `sizeCorrection = sizePt / rawSize` and multiplies character- or paragraph-style leading by that ratio. This behavior is present in the preserved v7.6.0 source but had no decision trail.

The original TR-001 fixture confirms the arithmetic: layer 194671 stores raw size `26.0948906`, implied size `30`, and raw leading `26.9647198`; the correction produces approximately `31`, matching the descriptor's `impliedLeading`. This resolves the leading-basis half of TR-001. It does **not** change wrapping width: `textBoundsOf()` still uses the tight `bounds` route from D002, so the `BONE-BUILDING` hyphen-break symptom is not claimed resolved. The fresh-layer comparison ZIP referenced by TR-001 was not present for an A/B render in this pass.

## D041 — [UI regression] Render registration marks only on Compare artboard cards (v7.7.0)

The v7.6.2 source created four `.reg-corner` nodes for every artboard card on every render while `.cp-artboard-card .reg-corner { display:none }` suppressed them unconditionally. This contradicted the Compare-card motif documented in UI/UX §3 and wasted per-render DOM work.

**Decision:** remove the suppressing CSS and create/add the `reg-mark` class and corner nodes only when `compareEnabled`. Focused Preview creates none; Compare creates four visible corners per card. Browser verification with a six-artboard package produced 24 visible corners in Compare and zero in Preview.

## D042 — [Text QA regression] Baseline disclosure must not depend on `?textQA=1` (v7.7.0)

In the reviewed v7.6.2 source, `TEXT_QA_ENABLED` controlled `body.text-qa-mode`, the only dashed failure-outline selector, `buildKerningQC()`'s early return, `runTextQaAudit()`, and the top-bar badge. No CSS targeted `data-kerning-risk`, so the documented amber marker never rendered. This made the D037/D039 disclosure path silent unless a reviewer knew the query parameter. The point at which that gating entered the unlogged 7.6.1/7.6.2 interval is not reconstructed.

**Decision:** baseline disclosure is always on. Optical-kerning layers use dotted amber `[data-kerning-risk]` outlines and the package-wide static findings list. Genuine visible-state `measurement-failed` results use dashed red `[data-text-qa-failure="true"]` outlines. The existing `csm:text-measured` event refreshes the current-state failure list directly from connected stage nodes, without restoring the stale `MutationObserver` design described by the old spec. `buildKerningQC()` shows **Review text (N)** whenever either baseline category exists.

`?textQA=1` remains an additional developer/QA mode: it adds `body.text-qa-mode`, shows the reworded **Full Text QA audit** badge, runs `runTextQaAudit()` across every valid artboard × tab × slide, includes calibration/edge-crop observations, and retains **Copy case** Markdown export. The query flag gates only that eager scan, never baseline markers or discovery.

## D043 — [Mobile instream] Add a focused Preview Fit/1× presentation toggle (v7.7.0, new capability)

The preserved v7.6.2 source contains a previously undocumented mobile-instream presentation path. `computeScale()` remains `1`, but focused Preview defaults the 970×546 `mobile-instream` stage to `MOBILE_INSTREAM_DISPLAY_SCALE = 0.5` inside a 485×273 viewport. A Fit/1× segmented control switches presentation without changing PSD geometry or text synchronization. Compare mode deliberately provides neither the overlay nor the 0.5× presentation.

This is the sole scoped exception to D028 and is formally released/documented as a MINOR capability in v7.7.0. Browser verification confirmed Fit at 485×273 with a 0.5 transform, 1× with no viewport transform, and no scale overlay in Compare.

## D044 — [Nav] Reconstruct missing compound-path tab-pill geometry (reconciled in v7.7.0)

`getShapeClipPath()` contains an undocumented fallback already present in the preserved v7.6.0 source. It triggers only when a shape's `keyOriginType[]` includes `keyShapeInvalidated: true` and rendered width/height are nonzero. In that descriptor state, exported path points are absent, so the renderer reconstructs the production-supplied 106×28 pill path: curved shoulders remain constant while the flat center stretches or contracts with label width.

This is confirmed against real package data: the COSENTYX DTC export marks `tab1_active`, `tab2_normal`, and `tab3_normal` with repeated `keyShapeInvalidated: true` entries and supplies no authored point list. The fallback remains signal-driven rather than name-driven; ordinary shapes still use their exported radius/rectangular treatment.

---

## D046 — Reconcile supplied capture source with the documentation baseline

The confirmed latest input is `turbo-preview-7_7_1_3.html` from Downloads. It declares `PREVIEW_BUILD = "7.7.1"`; the existing documentation described a 7.7.0 baseline. The supplied conversation describes later tolerant capture that is absent from this input. Neither the filename suffix nor conversation is sufficient to reconstruct a release history.

**Decision:** preserve the exact input at `preview/archive/turbo-preview-7_7_1_3.html`, retain existing 7.7.0/7.7.1 files, and identify the new user-facing capture capability as 7.8.0. Historical document sections remain labeled as baselines, with explicit screenshot addenda and a dedicated current specification. Do not retrospectively label all intervening changes. D045 remains unassigned.

## D047 — Harden preview screenshots and separate completeness from fidelity (7.8.0)

**Decision:** keep local capture with embedded html-to-image and JSZip; add all/selected-size planning, safe unique paths, tolerant/complete-asset policies, package resource handling, used-font/text readiness, PNG dimension checks, complete outcome manifests, memory/wait budgets, cancellation, affected-state retry, retained download, and a visible issue report. Keep live font links attached. QA Studio imports 7.8.0 and follows its capture busy state. Package buffers construct their File and input event inside the iframe, and a ping/ready handshake covers early srcdoc loading.

A missing shared disclaimer image must not erase every PNG in tolerant mode; every omission remains an incomplete capture rather than an inferred decorative exception. Conversion timeouts end scheduling because the embedded converter cannot be aborted. Video snapshots force a zero-time seek and presentation waits; transparent or unreadable decoded frames are warnings or policy failures, never unqualified success.

**Validation:** twelve production-function and iframe-bridge tests pass. Generated browser fixtures verify modeled-state coverage, original mobile-expandable dimensions, PNG retry/nested assets, tolerant and complete-asset outcomes, selected scope, subset retry, cancellation accounting, and ZIP CRC/dimension/pixel roundtrip. Broader browser/font/production parity remains a release gate, documented in `08-Screenshot-Capture-Tool.md` and `09-Screenshot-Capture-Analysis.md`. A production Playwright service is specified as proposed work and is not implemented.

---

## D048 — Correct capture diagnostics, defaults and video timing (7.8.0 follow-up)

**Evidence:** the user's manifest had 53 exported PNGs, all degraded, with zero failed jobs. Repeated template-path, inherited-font and Text QA warnings obscured actual capture coverage.

**Decision:** restore default 2×; seek videos at 5 seconds or just inside the end of short clips and record seek metadata; resolve `$LOC$assets/` against canonical export-root assets with exact/unique fallbacks; inspect fonts only on direct text nodes; keep Text QA notices separate from capture completeness. Only jobs without PNGs enter the failures file; warnings and notices use a separate file. Simplify and theme the capture dialog. Latest source remains 7.8.0, corrected in place.

**Validation:** the related SPIRIVA sample exported 52/52 states at 2× in tolerant and strict modes with zero capture failures or asset warnings, all PNG dimensions and ZIP CRCs verified; 135 Text QA notices were preserved. The supplied 53-state revision itself was not available as an exact matching ZIP.

---

## D049 — Generate an honest CSM review PDF from modeled evidence (7.8.3)

**Evidence:** the supplied 47-page CSM reference PDF combines video checkpoints, desktop and mobile main-unit states, expandable teaser/engaged examples, instream presentations, device/player casing, OTT, and full ISI. Turbo QA Studio models main-unit states and now exposes package teaser assets, but it does not model the VPM hover transition, mobile instream in every package, or presentation casing.

**Decision:** create an optional landscape review PDF in the browser from successful 2× capture PNGs, package-video checkpoints, available teaser assets, and full-ISI text. Put the PDF inside the ZIP and retain a direct PDF download. State the unsupported production layers on the cover rather than fabricating casing or transition frames. Record PDF status and coverage in the capture manifest. A PDF failure remains isolated from valid PNG output.

**Versioning:** the user explicitly requested a patch build from the confirmed latest source `preview/archive/turbo-preview-7.8.2.html`; the delivered source is `preview/archive/turbo-preview-7.8.3.html` with matching app import, bridge token, and build tag.

---

## D050 — Rebuild the review PDF against the supplied CSM reference (7.8.4)

**Evidence:** direct comparison found that the 7.8.3 output had 28 generic card-based pages, a generated cover, gray content surfaces, sparse layouts, no presentation casing, and a four-page full-ISI appendix. The 47-page `USA-938-80400.pdf` reference uses a white 16:9 page, compact gray section bar, direct creative placement, fixed section sequence, size-specific page densities, phone/player/OTT presentation frames, and one dense full-ISI page.

**Decision:** replace the generic composer with a reference-specific document template. Preserve successful 2× PNGs as evidence, group supported sizes using the reference order and density, add review-only phone/player/OTT frames, place teaser assets directly, and typeset full ISI on one page. Omit unavailable sections rather than creating false evidence. Keep the VPM hover transition explicitly unsupported and describe presentation frames as approximations. Use 5-, 12-, and 15-second video checkpoints so the first review image follows the requested 5-second policy and avoids the blank intro sample.

**Validation:** the representative eight-size package generated 41 pages with all 16 reference section categories, a 960×540-point page box, zero capture failures, and a CRC-valid ZIP. The reference has 47 pages; the remaining difference comes from package-specific state counts and unavailable production-only states rather than the page template.

**Versioning:** the user confirmed `preview/archive/turbo-preview-7.8.3.html` as the latest source. The patch is `preview/archive/turbo-preview-7.8.4.html`, with matching app import, bridge token, tests, and build tag.

---

## D051 — [Nav] Center the natural tab wrapper inside every horizontal placeholder (7.8.12)

**Evidence:** live production DOM inspection of Ipsen 300×600 showed a 300×28 outer menu with a centered, naturally sized wrapper: the wrapper's computed content width was 275.289px plus 36px horizontal padding, giving an outer width of 311.289px and an x-position of -5.640625px. The production menu uses `justify-content:center`; the local preview had been forcing `flex-end`, shifting the tab row in both Ipsen 300×250 and 300×600. The Ipsen export confirms 300px horizontal `tabButtons` placeholders at top 219 (300×250) and top 849 (300×600), each 28px high.

**Decision:** keep the per-size placeholder width as the menu frame, center the horizontal wrapper, and preserve its natural intrinsic width, 24px gaps, 18px content-box padding, 22px height, and visible overflow. Do not replace this with a universal width or right alignment. Two-tab and three-tab menus share the layout rules but retain campaign-specific font metrics and resolved widths.

**Validation:** the production specification is recorded in `doc/11-Tab-Navigation-Production-Spec.md`; the 7.8.12 patch build and test suite pass.

**Versioning:** `preview/turbo-preview-7.8.12.html` is the current patch source imported by `app/page.tsx`.

## D052 — [Nav] Exported tab title typography is authoritative (7.8.12)

**Evidence:** a Vonjo-specific `13px` title-size override had been introduced from a live DOM measurement. That made the preview correct only for one observed campaign while violating the package contract: each creative's active and normal tab title styles are authored in `export.json`, and those values must remain the source of truth.

**Decision:** remove all campaign-specific navigation font-size overrides. For every creative and every tab state, use the exported title font family, size, weight, color, tracking, and state style. Live production measurements remain validation evidence, not replacement styling data.

**Versioning:** the correction is included in `preview/turbo-preview-7.8.12.html`, which remains the current app source.

## D053 — [Nav] Per-size exported placeholder owns menu placement and frame width (7.8.12)

**Evidence:** Ipsen `export.json` defines separate `tabButtons` bounds for each artboard, including right-pinned 970×250 and 728×90 menus and full-width 300×250/300×600 menus. The renderer still contained measured Vonjo/Pure widths as campaign-specific substitutions, which could make placement diverge from a package's exported bounds.

**Decision:** use the current artboard's exported `tabButtons.left`, `top`, `width`, and `height` for the outer menu frame on every creative. Use master navigation data only for tab labels and active/normal visual styles. Do not hard-code menu widths by label sequence or campaign.

## D054 — [Nav] Derive horizontal wrapper alignment from exported anchoring (7.8.14)

**Evidence:** live Ipsen production measurement shows `970x250` uses `justify-content:flex-end` for its right-pinned 300px placeholder, while `300x250` and `300x600` use `justify-content:center` for left-pinned 300px placeholders. The same right-pinned behavior applies to the 728×90 layout. A single global alignment cannot match all sizes.

**Decision:** compute `rightPinned = (tabButtons.left + tabButtons.width) ≈ artboard.width` from `export.json`. Use `flex-end` for right-pinned horizontal menus and `center` otherwise. Keep the menu frame position and width directly sourced from the same exported placeholder.

## D056 — [Findings] Replace the broad CTA disappearance warning (7.8.16)

**Evidence:** Ipsen's two 160×600 paragraph-text CTA labels exist in production.
The original Tryptry Mobile Instream label is omitted, with a user-reported
point-text repair; the later export instead contains an unsupported `copy_new`
image. Page 6 of the export guide says other button children are ignored.

**Decision:** Remove the universal, high-confidence paragraph-text warning.
Keep an informational production review scoped to Mobile Instream, explicitly
disclosing that omission is unconfirmed for the current label. Add a documented
ignored-image finding with a Photoshop repair. Match CTA profiles and account
for background generator/retina names, excluded subtrees, and unrelated action
roles. Do not infer a missing label when valid background artwork can contain it.

**Validation:** Authentic descriptor fixtures cover both Tryptry revisions and
the working Ipsen labels. The 7.8.16 preview is byte-identical to 7.8.15 except
for its build identifier; this release changes QA classification, not rendering.
See `16-CTA-Warning-Investigation.md` and `17-CTA-QA-Correction-Plan.md`.

## D057 — [Findings] Distinguish internal spacing from line-end padding and show the affected layer (7.8.17)

**Evidence:** the Ipsen export contains seven values such as `Impact of Fatigue  ` and `PBC=primary biliary cholangitis.  \r`. The repeated whitespace is at the end of the Photoshop text value, not between visible words. The existing broad spacing check therefore reported layout padding as a copy issue.

**Decision:** keep internal repeated spacing as a Copy note. Report whitespace before a line ending as a separate low-priority informational note that explains it may be intentional padding. Add a `Show in preview` action that selects the matching artboard, tab, and slide and temporarily outlines the exported layer by its layer ID. If the layer has no renderable element, keep the location and explain that the layer can only be reviewed in Photoshop.

**Validation:** regression coverage distinguishes internal spacing from trailing line-end padding. The preview bridge accepts finding context without changing text-rendering behavior.

## D058 — [Findings] Use a compact play icon for preview pinpointing (7.8.19)

**Evidence:** the first icon-only action still sat on its own row and was larger than the compact play affordance used in the production showcase.

**Decision:** place a smaller blue play icon inline with the size/tab/slide location chips. Keep the accessible label and tooltip, and preserve the same artboard, tab, slide, and layer highlight behavior.

**Validation:** the application build and full automated suite pass with the icon-only action.

## D059 — [Findings] Mark detected whitespace in the affected copy (7.8.19)

**Evidence:** spacing findings identified the layer but left the exact extra characters implicit, making it hard to tell whether the note referred to a visible gap or exported padding.

**Decision:** show an Affected copy line for spacing findings. Render spaces as `·`, tabs as `⇥`, line endings as `↵`, and apply a yellow marker to the characters that triggered the finding.

**Validation:** QA regression tests assert the highlighted range for both internal spacing and trailing line-end padding.

## D060 — [Preview] Retire legacy Review Text and Structure QA panels (7.8.19)

**Evidence:** the Findings workspace now provides the user-facing QA results and canvas pinpointing; the preview’s older diagnostics panels duplicated that work and exposed internal calibration details.

**Decision:** hide the legacy panels, disable their eager scans, and remove their text outlines from the preview surface. Keep production text measurement active because it is part of rendering parity, and keep the Findings bridge active.

**Validation:** the full automated suite, type check, and application build pass with the panels disabled.

## D061 — [Preview] Make spacing pinpoint highlights visibly blink (7.8.19)

**Evidence:** the spacing pinpoint correctly received the existing highlight class, but the prior soft opacity/color animation was too subtle on one- or two-space spans to be perceived as an active marker.

**Decision:** keep the existing yellow highlighter and its current 3.5-second cleanup, but alternate clearly between a yellow highlight with a short glow and no highlight using a stepped animation. This keeps the marker visible without adding a rectangle outline or changing rendered copy.

**Validation:** the full automated suite, type check, application build, and whitespace pinpoint bridge remain passing.

## D062 — [Preview] Blink dotted pinpoint outlines (7.8.19)

**Evidence:** non-spacing findings use the dotted canvas outline, which remained static even after spacing highlights were made visibly animated.

**Decision:** animate the dotted outline with the same stepped on/off rhythm as the whitespace marker. The outline continues to be removed by the existing finding timeout, and the rendered copy remains unchanged.

**Validation:** regression coverage asserts the outline animation and the full suite, type check, and application build pass.

## D063 — [Preview] Keep size state consistent when opening findings (7.8.19)

**Evidence:** opening a size from a finding could retain the preview's previous comparison mode or gallery slide. The same artboard could therefore render with a different state than when the user selected that size directly.

**Decision:** finding navigation always switches to single-size mode, resolves the finding's tab and slide when supplied, and resets to the selected size's first slide when no slide is part of the finding. Direct size selection also resets the slide before rebuilding its controls.

**Validation:** the preview regression checks cover the state reset hooks; the full suite, type check, application build, and diff check pass.

## D064 — [Preview] Preserve the authored canvas origin while pinpointing (7.8.19)

**Evidence:** reproducing a 970×250 spacing finding showed the stage's hidden scroll container at `scrollTop: 19`, while direct size selection stayed at `scrollTop: 0`. `Element.scrollIntoView()` was scrolling the internal stage instead of only revealing the artboard card, which shifted the creative upward.

**Decision:** reveal the outer artboard card and reset the stage scroll offsets to zero before and after the reveal. Pinpointing can move the page to the finding without changing the authored canvas geometry.

**Validation:** the reproduction path was measured in the running app, and the full suite, type check, application build, and diff check pass.

## D065 — [Text parity] Withdraw paragraph-frame substitution and restore tight hosts (7.9.8)

**Status:** Initial implementation withdrawn after visual regressions. The original Tryngolza diagnosis is superseded by the live-production shape evidence in D066.

**Confirmed evidence:** Tryngolza layer 243085 exports tight `bounds` of 192×109px and `boundingBox` of 196×120px. The transformed `textShape.bounds` approximately matches the latter. This establishes what Photoshop's design-time frame is; it does not establish which rectangle production passes to its synchronizer. The supplied `vdx-container-turbo.js` reads existing inline CSS and contains no export-to-host conversion. Catalog section 12 already records a live production example using tight bounds despite a larger, corroborated paragraph frame.

**Rejected decision:** the initial 7.9.8 implementation replaced tight hosts with matching design-time frames. The descriptor audit accepted 311 Tryngolza, 196 SPIRIVA, and 134 COSENTYX DTC text layers. That was a broad geometry change, not a narrowly validated correction. Larger frames change wrapping, alignment and the synchronizer's vertical-centering offsets. User screenshots subsequently confirmed overlapping text in SPIRIVA, COSENTYX DTC and Ipsen.

**Correction:** restore D002/D031 and the exact 7.9.7 renderer, retaining only the 7.9.8 build identifier. Do not infer production host geometry from agreement between two Photoshop descriptors. Any future change requires the affected production element's actual input CSS and paragraph/run topology, followed by rendered comparison.

**Validation correction:** the initial cross-package checks parsed exports and counted descriptor matches; they did not render or compare screenshots. The initial passing tests encoded the proposed frame-selection policy, so they could not establish production parity. The replacement regression asserts tight-host preservation and exact source equivalence to 7.9.7. The available browser tool rejects `file://` pages, so local visual acceptance must not be claimed.

**Versioning:** corrected in the existing 7.9.8 build to remove the regression introduced by this task. Earlier builds and unrelated workspace changes are preserved.

## D066 — [Shape parity] Use authored corner radii for ordinary shape layers (7.9.9)

**Evidence:** the supplied [Tryngolza production showcase](https://showcase.vdx.tv/cc/n/0/#FgjxqA/10) was inspected in Desktop Inframe 300×600, Why Lower?, slide 2, with gallery playback paused. Production layer 243083 is 217×218px with `border-radius: 14px`. The latest ZIP independently exports shape origin type 2 and four 14px corner radii. The original local screenshot instead shows an ellipse. The ordinary shape collector used `isRoundShape(layer) ? "9999px" : null`; `isRoundShape()` includes origin type 2, so it discarded the authored rounded-rectangle radii. The existing `getShapeBorderRadius()` helper already handles those radii but was only wired into other shape paths.

The production text layer 243085 has a synchronized width of 194.625px and a 109px host height, 13px Poppins type, line-height 1.2 and paragraph offsets of -0.25px/0px. Its seven displayed lines match the original local screenshot's breaks. The visible difference explaining the apparent escape is the background silhouette. Production does not substitute the 120px design-time text-frame height.

**Decision:** ordinary shapes now call `getShapeBorderRadius(layer)`. This preserves asymmetric and zero-valued corners, reuses existing scaling at paint time and retains the existing ellipse/plain-rectangle fallback. No text geometry, font, paragraph or synchronization code is changed. The implementation delta from corrected 7.9.8 is one radius-wiring line plus the version identifier.

**Validation:** functional tests evaluate the complete engine, collect ordinary shapes and paint their CSS; they cover the live production fixture, asymmetric corners, half-scale output and ellipse/plain-rectangle behavior. `scripts/verify-shape-radius-parity.mjs` traverses all 229 selectable states across Tryngolza, SPIRIVA, COSENTYX DTC and Ipsen. It verifies 30 authored-radius corrections and no other render-model changes, including all 852 collected text instances. These are model/CSS checks, not pixel comparisons. The production screenshot and DOM were observed directly; local browser pixel validation remains blocked by the browser tool's `file://` policy.

**Versioning:** new patch build 7.9.9 from corrected 7.9.8, under the user's existing authorization for a new patch build. The app automatically selects the highest semantic preview version.

**User acceptance — 2026-10-14:** the user confirmed that the 7.9.9 fix works correctly in the local preview. This closes the reported Tryngolza rounded-panel/apparent-text-overflow issue. This confirmation applies to 7.9.9; it does not establish acceptance of subsequent builds or replace the recorded limits of automated validation.

## D067 — [Mobile expandable] Apply one global 375×622 responsive contract (7.9.10)

**Evidence:** live 375×622 testing of build 7.9.9 covered six supplied packages (Tryngolza, Ipsen, TRYPTYR, Alprolix, SPIRIVA and COSENTYX DTC) and 77 UI-exposed states. The ISI remained 428px wide at x=-26.5 and was cropped without a usable internal content width; at least 12 states contained visible text collisions; circular/video controls retained 428px coordinates and were clipped or offset by 26.5px; and the global tab/slide union exposed 33 selections unavailable on the focused artboard. The old responsive vertical helper shortened full-width video and then shifted individual leaves whose top crossed the new video bottom, splitting related copy, CTA and disclosure siblings. The supplied production container source, `vdx-container-turbo.js` 3.13.8-0, also confirmed that text width candidates use padding-left plus text-indent and retain the most-negative text-indent; padding-right is not part of that basis.

**Decision:** use one package-independent responsive policy. ISI fills the 375px host at x=0 and scrolls its content vertically. Full-width video contracts proportionally; contained video remains center-pinned; circular controls select a left, center or right anchor from their authored position. Preserve authored vertical coordinates rather than shifting individual leaves at the shortened video boundary. In Preview mode, derive tab/slide controls from the selected artboard only; Compare mode may aggregate included artboards. Align text candidate scoring with the supplied 3.13.8-0 source. No campaign, layer ID, copy string or package-name exception is introduced.

**Validation:** a live 375×622 pass over the same six packages covered all 42 valid focused states after control scoping. It found zero unavailable selections and zero detected text/content overlaps. Every checked ISI measured 375px wide at x=0 with internal vertical scrolling; centered TRYPTYR video and its circular indicator shared x-center 187.5; right-edge controls in Alprolix and SPIRIVA preserved their right gaps inside the 375px host. Structure regressions cover ISI width, full/contained video, circular left/center/right anchoring, authored vertical positions, control scoping and the production text-candidate formula.

**Versioning:** new patch build 7.9.10 from 7.9.9. Earlier builds and unrelated workspace changes remain preserved; the app selects the highest semantic preview version.

**Superseded clause:** D067's instruction to preserve every authored vertical coordinate was based on rejecting the earlier per-leaf boundary heuristic. Production inspection later established a third behavior: shift each direct sibling branch of the resized video once. D068 replaces only that vertical-flow clause; D067's ISI, horizontal pinning, control scoping and text-candidate decisions remain active.

## D068 — [Mobile expandable] Reflow direct sibling branches after responsive full-width video (7.9.11)

**Evidence:** the supplied live mobile-expandable ad (`mediaDataID=14185590`) loaded production component bundle 3.13.11-8. Its `_modifyVideoTab()` measures the active tab's resized video, computes the rounded difference between rendered and authored video height, adjusts the owning tab panel, and applies that single delta to the video's direct sibling elements. In the measured 375×622 Tryngolza state, the authored 428×241 video rendered at 375×211.16; the following `CanvasDesign` branch moved from authored y=241 to production y=211. Descendants followed through their parent branch rather than receiving independent boundary-based offsets. The separately supplied `vdx-container-turbo.js` 3.13.8-0 remains the text-conversion reference; it is not the source of this tab-flow behavior.

**Decision:** when a responsive 428×622 tab contains a left-aligned, full-width video as a direct child, compute `delta = round(authoredVideoHeight × 375 / 428 − authoredVideoHeight)`. Apply that delta once to every direct sibling branch of the video. Descendants preserve their local coordinates inside the shifted branch; the video branch receives no vertical delta. Do not shift leaves individually according to whether their top is above or below the resized video's bottom. Do not apply the rule to contained video, unrelated branches, or structures without the qualifying direct-sibling relationship. The rule is structural and package-independent; it must not depend on campaign names, layer IDs, copy strings or observed pixel values from one creative.

**Validation:** live 375×622 DOM measurements covered Tryngolza, Ipsen, TRYPTYR and Alprolix. Tryngolza, Ipsen and TRYPTYR each closed the full-width-video/content seam to `-0.156px`, the expected browser subpixel rounding overlap. Alprolix did not have the qualifying following sibling branch and retained its authored approximately `16.8px` internal content spacing, confirming the exclusion. The full automated suite passes 116/116 tests; TypeScript checks, production build and lint complete with zero errors. Regression coverage asserts one branch-level delta, unchanged descendant spacing and no movement for unrelated branches.

**Versioning:** new patch-version build 7.9.11 from 7.9.10. Earlier builds remain preserved and the app selects the highest semantic preview version.

**User acceptance — 2026-10-14:** the user confirmed the four-package test was successful and authorized rewriting the production-behavior rules around the verified sibling-flow contract.

## D069 — [Build hygiene] Use one explicit QA Studio preview pointer and archive historical HTML

**Evidence:** `app/page.tsx` used `import.meta.glob("../preview/turbo-preview-*.html", { eager: true })` and selected the highest semantic filename at runtime. Vite therefore bundled every matching historical HTML source into the production JavaScript. The pre-change production JavaScript was 15,016.96 kB (4,015.68 kB gzip). The user explicitly confirmed 7.9.11 as current; filename ordering and browser state were not used as authority.

**Decision:** QA Studio statically imports `preview/current-preview.ts`, the one documented release pointer. Only confirmed 7.9.11 remains in the runtime source directory. All 27 historical HTML files move unchanged to `preview/archive/`, and tests/scripts that intentionally use a baseline read it there. The archive is not imported by application code. No renderer source or creative-layout logic changes.

**Historical comparison:** after normalizing only `PREVIEW_BUILD`, five pairs are exact implementation duplicates: 7.8.1/7.8.2, 7.8.4/7.8.5, 7.8.15/7.8.16, 7.8.17/7.8.18, and 7.9.7/7.9.8. The complete byte-size, declared-version, reference and uniqueness register is `18-Preview-Build-Inventory.md`.

**Deletion policy:** no build is deleted in this change. Unreferenced duplicates 7.8.5 and 7.8.18 are documented as deletion candidates, but require separate explicit approval.

**Validation:** the live QA Studio iframe logged `preview.js loaded: 7.9.11`, exposed bridge state `ready`, and displayed `build 7.9.11`. All 118 automated tests and TypeScript checks passed. Lint completed with zero errors and 11 pre-existing warnings. The production build completed with the existing large-chunk warning. Main JavaScript fell from 15,016.96 kB (4,015.68 kB gzip) to 1,002.60 kB (282.16 kB gzip), a 93.32% raw and 92.97% gzip reduction. The production bundle contains one renderer marker and no sampled historical build identifiers. The current 7.9.11 HTML was not edited.

## D055 — [Text parity] Match production Shift+Enter paragraphs and narrow the finding (7.8.15)

**Evidence:** the supplied `production_v9/design.psd.zip` export has layer `221946` at `300x250 > tabComponent > tab3 > rmGallery > slide3`. Its raw `textKey` contains U+0003 between the first and second references; the two applicable paragraph-style ranges have `spaceAfter` and `impliedSpaceAfter` equal to zero. The production DOM supplied for this layer contains two paragraph elements, and the retrieved VDX Container 3.13.8-0 source confirms its text synchronization operates on existing paragraph and lexical-span DOM.

**Decision:** preserve U+0003 in raw source text while rendering it as a separate paragraph, and select its paragraph style from the source-offset range following the break. Do not treat every U+0003 as a defect. Emit a warning only when nonzero paragraph spacing follows a soft return; show the finding as a typography spacing risk with a Photoshop check.

**Validation:** regression coverage confirms zero-spacing soft returns produce no finding, nonzero spacing produces a warning, and preview paragraph structure/style selection preserves the U+0003 source character. All 86 tests pass, TypeScript checks pass, and the production build completes.

**Versioning:** `preview/archive/turbo-preview-7.8.15.html` is the current patch source imported by `app/page.tsx`; 7.8.14 remains preserved.

## Open issues carried forward (as of this reconstruction)

These are carried-forward gaps across the deprecated/baseline files, the current Artifact source, and the Standalone line:

1. **`turbo_preview_artifact_7_4_1.html`**: `PREVIEW_BUILD` constant still reads `"1.0.1"` — should be `"7.4.1"` to match filename and this doc set (D001).
2. **`index.html` / `preview.js`** (Standalone line) has not received: float-channel RGB parsing (D005), the `sizePx`-priority single-line fix (D006), master-lookup-without-a-`master`-artboard fallback (D012), the `runs`-nulling label fix (D014), duplicate-`slideN`-by-name detection (D015), ISI/disclaimer rendering (D016), vertical nav rotation (D017), tab-label scaling (D018), CTA button-frame centering (D019), per-card overflow scroll (D020), `.cp-stage` stacking context (D021), or the `ResizeObserver` sticky-offset fix (D022) — nor the explicit `document.fonts.load()` fix (D010), and its precise-shape-bounds / kerning-buffer text logic predates D002–D004 entirely.
3. **`turbo_preview_artifact_5.html`** (deprecated) is missing everything introduced in 7.4.1 (D005, D006, D012, D014–D022) but does have D002–D004, D010.
4. **ISI title placement evidence:** current code uses top placement only for `970x546` and `mobile-instream`, excluding `970x250`. Available packages confirm those sizes and current rendering, but no served-production reference captured the complete per-size policy in this pass. D045 is intentionally not assigned until that evidence exists.

See `02-Technical-Spec.md` for the full feature/fix matrix per file.
# D070 — [Feedback] Export a local, production-linked debug bundle (7.11.0-feedback)

**Evidence:** free-form bug messages do not reliably identify the affected preview state, source package, application environment, or production output. The user requires the feedback entry point in the existing app menu and requires either a CCRV URL or a Showcase URL for comparison.

**Decision:** add **Report feedback** beside report and screenshot actions. Require a valid `showcase.vdx.tv` CCRV/Showcase reference only for Visual mismatch; keep it optional but validated when supplied for every other type. Preselect a feedback type from categories covering the app's common failure areas; keep Description and reproduction steps optional; show optional Actual and Expected fields only for Visual mismatch. Description, Actual, and Expected accept clipboard images directly, show removable in-field previews, and store them in separate context folders. Default to including the active-stage screenshot and source ZIP when available; allow additional attachments; disclose the evidence before export. Generate a local ZIP only and preserve the existing “nothing is uploaded” privacy contract. The user explicitly selected the release label `7.11.0-feedback`; this is a named feature build based on confirmed source 7.10.3.

**Validation:** static regression coverage checks menu placement, URL gating, local bundle contents, privacy copy, build identity, and the current-preview pointer. TypeScript, automated tests, lint, production build, and browser interaction are the completion gates.
