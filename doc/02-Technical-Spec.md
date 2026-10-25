# 02 — Technical Specification — Turbo Export Preview

> **Current release: 7.13.0** — `preview/turbo-preview-7.13.0.html`. Adds a QA-only outbound click test for recognized text CTAs; clicking opens the default VDX destination in a new tab. The package and `export.json` are not modified.

> **Current CTV/OTT exception (7.11.16):** This reconstructed core spec primarily describes the banner/main-unit preview line and its historical baseline. The separate local FFmpeg CTV/OTT renderer, including package media rules, animation, glass, QR grouping, service API and output profile, is specified in [CTV/OTT Consolidated Spec](CTV-OTT-Consolidated-Spec.md). Excluding CTV/OTT artboards from the in-page banner renderer does not mean they are unavailable in QA Studio.

**Doc version:** 1.8.1
**Reflects build:** `preview/turbo-preview-7.13.0.html` @ **v7.13.0** (current); historical baselines are described below.
**Last updated:** 2026-10-25
**Status:** ⚠️ Reconstructed baseline — see `04-Decisions-Log.md` § D000.

**Current screenshot release:** `preview/turbo-preview-7.9.11.html`. The main sections below preserve the 7.7.0 baseline; the screenshot addenda and `08-Screenshot-Capture-Tool.md` describe the current capture line.

---

## 1. What this tool is

An offline, in-browser QC preview renderer for **VDX Turbo export packages**: a PSD-derived `export.json` layer manifest plus rasterized layer PNGs (and optionally video/font/disclaimer assets). It reconstructs, at true 1:1 pixel scale, what a Photoshop-authored multi-size, multi-tab, multi-slide ad will look like in production — **without** running Photoshop, without a build step, and without a server.

Two independent distribution lines currently exist (see §2), which is itself the top architectural finding of this reconstruction (§7).

## 2. Distribution lines

### 2.1 Standalone Preview — `index.html` + `preview.js` — v1.0.0

- Opened directly via `file://` — no bundler, no server.
- Loads a single `export.json` via `<input type="file">`; PNG/font/video assets are resolved as relative URLs against `document.baseURI`, i.e. **the files must sit next to `preview.js`/`index.html` on disk**.
- Single-select size picker (checkboxes), tab/slide segmented controls, no theming, no compare mode.
- Simplest, oldest lineage; does not yet include most of the fixes and features in the artifact line (see §5 matrix).

### 2.2 Turbo Preview Artifact — self-contained single-file HTML — **v7.9.11 current source**

- Built to run as a Claude artifact / any static host: everything (engine, UI, styling) is inlined in one `.html` file plus a CDN `<script>` for JSZip.
- Ingests a **`.zip`** of the whole export package (via drag-drop or file picker), unzips in-browser with JSZip, and resolves every asset filename to an in-memory `Blob` URL through `CSM_PREVIEW.setAssetResolver()` — nothing is uploaded anywhere.
- Dark/light theme toggle, sticky size/tab/slide control panel, Compare mode (all available sizes), Compare-card registration marks, always-on text-risk disclosure (§4.5), and a focused mobile-instream Fit/1× control (§4.7).
- `preview/turbo-preview-7.9.11.html` is the **current source** and declares `PREVIEW_BUILD = "7.9.11"`. v7.9.10 is preserved as the previous patch build; v7.7.0 remains the reconciled historical baseline.
- QA Studio imports only `preview/current-preview.ts`. That pointer statically imports the confirmed current HTML and owns its version/path metadata. Historical builds live under `preview/archive/` and are available to regression tests without entering the application module graph. See `18-Preview-Build-Inventory.md` for the version-to-path register.
- v7.7.0 combines PATCH-level regression corrections (D041/D042) with the backward-compatible mobile-instream scale capability (D043), so the release uses a MINOR increment per `05-Docs-Maintenance.md` §2.

## 3. Data model

`CSM_PREVIEW.parseExport(data)` turns raw `export.json` into:

```
{
  artboards: [
    {
      model: {
        name, width, height, originTop, originLeft, rootLayerId,
        tabs: { tab1: { layerId, gallery: { layerId, componentName, componentFamily, slides: {slide1:{layerId}, ...}, slideOrder:[...] } | null }, ... },
        tabOrder: [...],
        tabButtonsPlaceholder: { top, left, width, height, itemIndex } | null,
        navigationBottomBorder: { top, left, width, height, itemIndex } | null,
        isiPlaceholder: { top, left, width, height, itemIndex } | null,   // Artifact line only
        tabButtons: { placement, style } | undefined                      // derived per-tab nav styling
      },
      byId, childrenOf, assetMap, fontLookup, masterNav, videoPlaylist
    }, ...
  ],
  fonts, assetMap, fontLookup, masterNav, videoPlaylist
}
```

Key derived structures:
- **`byId` / `childrenOf`** — flat layer lookup and parent→children adjacency built once from `data.rawLayers`.
- **`masterNav`** — the master artboard's `tabButtons/frame` folder, reconstructed once and reused across all per-size artboards (see §4.3).
- **`videoPlaylist`** — master's `videoPlaylist` folder, mapping `videoId → {fileName, posterSecondOffset}`.
- **`assetMap`** — `data.customAssets` mapped by `layerID → fileName`, for layers whose rasterized filename doesn't follow the default `{name}-{layerID}.png` convention.

## 4. Rendering pipeline

1. **`parseExport(data)`** — one-time structural parse (§3).
2. **`collectRenderablesWithSelection(model, ..., activeTab, activeSlide, ...)`** — re-walks the layer tree on *every* tab/slide selection change, overriding ancestor visibility for the selected tab/slide rather than trusting `export.json`'s snapshot `visible` flags (which reflect whatever was active at export time, not the user's current UI selection). Produces a flat list of renderable items tagged `isShape` / `isText` / `isVideo` / `isIsi` (7.4.1) / plain-image.
3. Also synthesizes, appended to that list:
   - The nav bar (tab pills + labels + bottom border), remapped from `masterNav` onto this artboard's `tabButtonsPlaceholder` — horizontal or vertical orientation (7.4.1) depending on placeholder aspect ratio (D017).
   - The ISI/disclaimer panel (Artifact line only), from `isiPlaceholder` + the package's own `disclaimer.html` (D016).
4. **`paintArtboard(entry, activeTab, activeSlide)`** — clears previous `.cp-layer` DOM nodes from the stage and creates new absolutely-positioned `div`/`img`/`video` elements from the renderable list, at scale `1` (D028).

### 4.1 Layer classification (in walk order)

| Check | Result |
|---|---|
| Name starts with `.` | Skipped entirely (D023) |
| Name matches never-rasterized patterns | Skipped (D026), except `playIcon`, `muteIcon`, or `unmuteIcon` within a visible `circularBar`, reconstructed from recovered production SVG paths (D034) |
| Is a group layer (`layerSection === layerSectionStart`) | Recursed into, not rendered itself |
| Name matches `video [id, ...]` and resolves via `videoPlaylist` | Rendered as `<video>` (D027) |
| `layerKind === 4` (shape) | Rendered as a filled/bordered/shadowed `<div>` using exported per-corner radii through `getShapeBorderRadius()` (D066), or skipped if no fill data; a fill-less `circularBar/indicator` is rendered as a source-bounds SVG circle with its exported 1px colour stroke (D033) |
| Has a `textKey` descriptor | Rendered as live HTML text, never an image (per PSD guidelines §7.4 — confirmed no PNG ever exists for text layers) |
| Otherwise | Rendered as `<img>` against `{name}-{layerID}.png` or a custom asset name, with one `-2x.png` retry on 404 (D024) |

### 4.2 Text rendering specifics

- Content newlines normalized from Photoshop's `\r`/`\r\n` to `\n` (D008); trailing paragraph return stripped.
- An explicit empty paragraph created by adjacent normalized separators receives a `<br>` line box. This preserves one authored line-height without adding visible glyph content or changing production glyph measurements (D036).
- Per-character-range style runs (`textStyleRange`) preserved individually — this is what carries superscript/subscript, underline/strikethrough, and mid-string bold/size changes. Adjacent runs with identical computed style are merged.
- Superscript/subscript approximated at ~58% font size (Photoshop doesn't expose this as a literal size reduction in the descriptor).
- Per-run baseline shift applied as a *delta* from the layer's own base shift, since layer bounds already account for the first run's shift.
- Transformed text leading is corrected onto the same implied-size basis as font size: `sizeCorrection = impliedFontSize / raw size`, then raw character- or paragraph-style leading is multiplied by that ratio (D040). In TR-001, `26.9647 × (30 / 26.0949) ≈ 31`, matching the exported `impliedLeading`.
- Corrected build 7.9.8 restores D002/D031's tight `bounds` host for all live text, with `boundingBox` used only if `bounds` is absent. The initial 7.9.8 paragraph-frame substitution was withdrawn after visible cross-package regressions. Agreement between `boundingBox` and transformed `textShape.bounds` does not establish the production host geometry (D065/TR-009).
- v7.5.1 builds production-style `<p>` elements containing lexical `<span>` runs, then runs `syncTextWithProductionPsd()` after the node connects and package fonts settle. It clones the fixed PSD wrapper, measures DOM/canvas glyph bounds, conditionally scores the native width plus up to five bounded width candidates, applies the selected width, and sets each paragraph's `top`/`left` offset. The path applies to single-line, wrapped, explicit-break, and CTA text alike; it deliberately has no preview-only line-count search, height compression, or CTA-frame substitution (D031). **Unchanged in v7.6.0** — see §4.5 for the new reporting layer built on top of this same function.
- Single-line detection (`isSingleLineText`) compares box height against a reference line height — **priority differs between files**, see D006.
- Text color: `rgbChannels()` (7.4.1 only) handles both int (`red`/`grain`/`blue`) and float (`redFloat`/`greenFloat`/`blueFloat`) descriptor shapes (D005). `artifact_5` and `index.html`/`preview.js` read int channels only.

### 4.3 Nav bar reconstruction

The complete production behavior is documented in [`11-Tab-Navigation-Production-Spec.md`](11-Tab-Navigation-Production-Spec.md). The key invariant is that the horizontal wrapper is centered inside each per-size menu frame; it must not be globally right-aligned or assigned a universal campaign width. The two-tab, three-tab, 300×250, 300×600, vertical, and no-tab cases all follow the rules in that specification.

Master's `tabButtons/frame` folder is parsed once (`buildMasterNav`) into per-child geometry *relative to the frame's own origin*, so it can be remapped onto any differently-positioned/sized per-size placeholder. Per size:

- **Horizontal** (default): pill positions computed from a production-accurate flex-style title track (24px gap, 20px shape overhang per side), centered on the placeholder. The wrapper is 22px high with 18px horizontal content-box padding and visible overflow; its natural width is allowed to overhang the frame symmetrically. Active tab's pill/shadow is painted last so it visually overlaps neighbors.
- **Vertical / rotated** (7.4.1 only, triggered when `placeholder.height > placeholder.width`, e.g. 160×600): same geometry, computed pre-rotation via `naturalBox()` then rotated `-90deg` via CSS `transform` (D017).
- Label text is always sourced by tab number (D013); visual style (fill/color/shape) is borrowed from whichever active/normal template exists anywhere in the folder, with `runs` explicitly nulled when the label is overridden so the wrong borrowed glyphs don't leak through (D014, 7.4.1 only — **known gap in artifact_5**).
- Tab label font size scales with the pill's own scale factor in 7.4.1 (`scaleTextStyle`, D018) — **known gap in artifact_5**, where labels can overflow into neighboring tabs at scale < 1.
- When a nav shape's `keyOriginType[]` reports `keyShapeInvalidated: true` and exported path points are absent, `getShapeClipPath()` reconstructs the confirmed production 106×28 pill silhouette. Its curved shoulders retain their source dimensions while the flat center stretches to the rendered label width; other shapes fall back to their ordinary rectangular/rounded rendering (D044).

### 4.4 ISI / disclaimer panel (7.4.1 only)

`parseDisclaimerHtml()` extracts `<style>` rules, a Google Fonts `<link>` if present, title text, and body content from the package's own `disclaimer.html`. Rendered scoped to the artboard's `isi` marker bounds, matched against whichever `.notice.size_XXX` class the package's own CSS actually defines, falling back to `.notice.mainunit`. See D016 for the background-color and margin-reset rationale.

The renderer currently places the ISI title above the content only for `970x546` and `mobile-instream`; other named sizes, including `970x250`, use bottom placement. The set and the `970x250` exclusion are code-confirmed, but a production-reference capture proving this complete per-size policy was not available in this pass, so it remains an evidence gap rather than a new decision (see §8).

### 4.5 Kerning / text-sync QC layer (Artifact line only — D037/D042)

This is a reporting layer built entirely on top of the existing, unchanged §4.2 rendering pipeline — it does not alter what gets painted on any artboard.

- **Package-wide static scan.** `scanPackageKerningRisks(parsedArtboards)` walks every artboard's full layer tree once at load time (independent of the current tab/slide selection — this is the same "comprehensive, selection-independent scan" pattern as `collectRenderables`, not `collectRenderablesWithSelection`), and for every text layer calls `classifyKerningRisk(layer, style)`. A layer is flagged only if its resolved `kerningMode` (per-run, from `getKerningMode()`) is `optical` or `mixed` — Photoshop's Optical-kerning algorithm has no CSS/canvas equivalent, so these layers can render with different letter-spacing than production regardless of anything else the tool does. Severity:
  - `layout-risk` — the text is not single-line (`isSingleLineText` false). A kerning-mode difference here can change the actual line count, which cascades into any layer positioned below it.
  - `cosmetic` — the text is single-line. A kerning-mode difference here is a few px of letter-spacing only; it never re-wraps.
- **Always-on visible-state failure disclosure.** `syncTextWithProductionPsd()` writes `data-text-qa-metrics` and `data-text-qa-failure` after each visible text node is measured, then dispatches `csm:text-measured`. The stage listener rebuilds the current rendered-state result list directly from connected nodes; no `MutationObserver` is used. Only `measurement-failed` receives the dashed red in-canvas marker and baseline panel entry. Candidate non-convergence (`unresolved`), line correction, and edge-crop observations are calibration data reserved for the full audit rather than design-defect markers.
- **Always-on UI surface.** Without any query parameter, a "Review text (N)" control appears whenever the package-wide static scan finds Optical kerning or the current rendered state reports a genuine measurement failure. The panel lists both categories. `[data-kerning-risk="layout-risk"|"cosmetic"]` receives a dotted amber outline; `[data-text-qa-failure="true"]` receives a dashed red outline. These styles are not gated by `body.text-qa-mode` (D042).
- **Opt-in full audit.** `?textQA=1` adds `body.text-qa-mode`, shows the "Full Text QA audit" badge, and enables `runTextQaAudit()`. That routine eagerly builds and measures every valid artboard × tab × slide state in an off-stage scan host. It reports render failures, non-converged candidate searches, line-count corrections, and stage-edge crop observations, and exposes **Copy case** Markdown scaffolding for `06-Text-Render-Issue-Catalog.md`. The query flag gates only this comprehensive developer/QA audit, never baseline disclosure.

### 4.6 Control panel & compare-layout redesign (Artifact line only, v7.6.0 — D038)

Chrome-only change; no effect on §3/§4.1–§4.4. See `03-UI-UX-Guidelines.md` §4–§5 for the full description of the new controls. Summary of what changed structurally:
- Size selection moved from an always-visible chip row to a dropdown popover, single-select (radio) in Preview mode and multi-select (checkbox) in Compare mode.
- The single stateful "Compare: Off/On" toggle (pre-7.6.0) is replaced by two mutually-exclusive segmented buttons, Compare and Preview.
- Compare mode selects all available sizes and changes the artboard layout from a flat wrapping grid to a fixed hero/wide/banner/tall/square "bento" arrangement, with a wide (two-column) variant at viewport ≥1988px (`WIDE_BENTO_MIN_WIDTH` is the single breakpoint source; CSS responds to the class selected by JS).
- Package load now defaults to exactly one size selected (`preferredEntries(1)`), rather than the prior default.

### 4.7 Mobile-instream presentation scale (Artifact line only, v7.7.0 — D043)

`computeScale()` remains `1` for source geometry. In focused Preview mode only, a `mobile-instream` card defaults to `MOBILE_INSTREAM_DISPLAY_SCALE = 0.5`: the 970×546 stage is placed inside a 485×273 `.cp-stage-viewport-mobile-instream` and visually transformed from the top-left. The card label exposes a Fit/1× segmented control. Selecting 1× removes the presentation viewport/transform; entering Compare mode removes the control and renders the artboard at 1:1 with every other size. Text synchronization continues against the full-resolution stage in both presentations.

### 4.8 Mobile-expandable 375×622 responsive rendering (Artifact line only, v7.9.11 — D067/D068)

Focused Preview renders the authored `428x622` mobile-expandable stage through a `375×622` clipped host. Ordinary design leaves remain center-pinned and shift by half the 53px width delta. Circular controls select a left, center or right anchor from their authored position, so a centered indicator stays aligned with a centered contained video while edge controls retain their authored edge gaps. Full-width video contracts proportionally to 375px; contained video keeps its authored size and remains center-pinned.

The ISI frame is a responsive exception: it fills the 375px host at x=0 and its inner content retains vertical scrolling. Full-width video also changes the vertical flow of its owning production tab. After the video is resized, the renderer computes `round(responsiveVideoHeight - authoredVideoHeight)` and applies that delta once to every direct sibling branch of the video. Descendants retain their coordinates relative to the shifted branch, so copy, CTA, disclosure, background and control clusters move together. The video branch itself and unrelated structures are not shifted. The renderer must never select individual leaves by comparing their tops with the shortened video boundary.

Preview-mode tab and slide controls are derived only from the selected artboard, preventing controls for unavailable states. Compare mode deliberately aggregates the included artboards. Text synchronization matches the supplied production `vdx-container-turbo.js` 3.13.8-0 candidate basis: paragraph padding-left plus text-indent, with the most-negative text-indent retained; padding-right is not included in candidate width scoring.

### 4.9 QA-only outbound CTA click test (Artifact line, v7.13.0 — D077)

After each artboard render, the host marks renderer-recognized text CTA groups (`.cp-cta`) as keyboard-focusable links. A delegated stage handler opens the fixed `https://www.vdx.tv/` destination in a new tab on click or Enter. This is a default interaction target for preview QA, not an inferred campaign URL. It does not change `export.json`, package files, production actions, or tracking configuration. Reconstructed canvas tabs, gallery arrows, map Smart Object buttons, and layout-audit selection retain their existing behavior.

## 5. Feature / fix matrix across the three files

| Capability | `index.html`+`preview.js` (v1.0.0) | `artifact_5` (deprecated) | `preview/turbo-preview-7.9.11.html` (v7.9.11, current source) |
|---|:---:|:---:|:---:|
| Package input | Single `export.json`, same-folder assets | `.zip` via JSZip, blob URLs | `.zip` via bundled JSZip, blob URLs |
| Theming | None | Dark/Light | Dark/Light |
| Compare mode | No | Yes (max 4) | Yes (all available sizes; redesigned layout, D038/D039) |
| Precise vector shape bounds | No | Yes (D004) | Yes |
| Post-font PSD text synchronization | No (different heuristic) | Fixed 6px buffer (D003) | **Yes — recovered production glyph-geometry algorithm (D031), unchanged since 7.5.1** |
| Transformed-text leading correction (`sizeCorrection`) | No | No | **Yes (D040); tight text-host geometry restored per D002/D065** |
| Authored blank PSD paragraphs (`\u0003\u0003`) | No | No | **Yes — explicit blank line box retained without changing glyph metrics (D036)** |
| Static circular gallery progress/control glyphs | No | No | **Yes — PSD visibility plus recovered SVG ring/play/mute geometry (D034)** |
| Float-channel RGB color parsing | No | No | **Yes (D005)** |
| `isSingleLineText` sizePx priority fix | No | No | **Yes (D006)** |
| Master lookup without `master`-named artboard | No | No | **Yes (D012)** |
| Nav label `runs` nulling fix | No | No | **Yes (D014)** |
| Duplicate `slideN`-by-name detection | No | No | **Yes (D015)** |
| ISI / disclaimer.html rendering | No | No | **Yes (D016)** |
| Vertical/rotated sidebar nav | No | No | **Yes (D017)** |
| Tab label scaling with pill width | No | No | **Yes (D018)** |
| CTA "Learn More" button-frame centering | No | No | **Yes (D019)** |
| Per-card overflow scroll (mobile fix) | No | No | **Yes (D020)** |
| `.cp-stage` explicit stacking context | No | No | **Yes (D021)** |
| Sticky offset via `ResizeObserver` | N/A (no sticky panel) | No (resize-event only) | **Yes (D022)** |
| Explicit `document.fonts.load()` | No | Yes (D010) | Yes |
| `\r`→`\n` text normalization | Yes | Yes | Yes |
| 1:1 source geometry | Yes | Yes | **Yes; mobile-instream focused Preview has a 0.5× presentation viewport with a 1× toggle (D043)** |
| Package-wide optical-kerning QC scan | No | No | **Yes (D037)** |
| Always-on kerning/failure markers + review panel | No | No | **Yes (D042)** |
| Full every-state Text QA audit (`?textQA=1`) | No | No | **Yes; opt-in (D042)** |
| Nav compound-path pill fallback | No | No | **Yes — `keyShapeInvalidated` signal + 106×28 production path (D044)** |
| Per-size ISI title placement | No | No | **Implemented; production evidence for the complete size set remains open** |
| Mobile-instream Fit/1× control | No | No | **Yes; Preview-only (D043)** |
| Dropdown size-popover / segmented Compare-Preview mode | No | No | **Yes (D038)** |
| Bento-style Compare layout (hero/wide/banner/tall/square) | No | No | **Yes (D038)** |
| Mobile-expandable responsive ISI, anchored controls, scoped state controls, video sibling-flow delta | No | No | **Yes (D067/D068, v7.9.11)** |
| CTA text metadata alignment validation | No | No | **Validation required: flag measured CTA-label shifts and provide the Photoshop text round-trip repair (TR-012)** |
| QA-only outbound click test for text CTA groups | No | No | **Yes — opens `https://www.vdx.tv/` in a new tab; no package mutation or tracking event (D077, v7.13.0)** |

## 6. Engine constants (stable across all files unless noted)

```js
TAB_LAYER_REGEX          = /^tab\d+$/i
TAB_BUTTON_HEIGHT        = 28
TAB_BUTTON_VISIBLE_TOP   = 5
SLIDE_LAYER_REGEX        = /^slide(\d+)/i
TAB_COMPONENT_PREFIX     = "tabcomponent"
GALLERY_FAMILY_SUBSTRINGS = [rmgallery, colorpickergallery, hotspotgallery, staticproductgallery]
GALLERY_ARROW_COMPONENTS = {rmgallery, colorpickergallery, hotspotgallery, staticproductgallery}
IGNORED_ARTBOARD_PATTERN = /^(master|ctv|ott|ctvott)/i
NO_EXPORT_PREFIX         = "."
NEVER_RASTERIZED_NAME_PATTERNS = [tabbuttons, navigation_bottom_border,
                                   navigation_preview*, button-jump*, playicon,
                                   muteicon, unmuteicon
                                   (+ isi — 7.4.1 only)]
PSD_SYNC_MAX_CANDIDATES   = 5     // recovered production limit (D031)
PSD_SYNC_MAX_WIDTH_STEP_PX = 10   // recovered production cap (D031)
// circularBar indicator is an SVG 1px source-bounds stroke (D033)
UNDERLINE_EPSILON_PX     = 4 (index.html) / 2 (artifact_5 and current Artifact source)
WIDE_BENTO_MIN_WIDTH     = 1988   // v7.6.0, single compare-layout breakpoint source (D038/D039)
MOBILE_INSTREAM_DISPLAY_SCALE = 0.5 // v7.7.0, focused Preview presentation only (D043)
TEXT_QA_ENABLED          = (?textQA=1) // gates full audit/badge, not baseline markers or panel (D042)
```

Current Artifact QA/UI markers: `scanPackageKerningRisks` supplies the package-wide static list; `data-kerning-risk` drives dotted amber in-canvas disclosure; `data-text-qa-failure` drives dashed red failure disclosure; `text-qa-mode` identifies the opt-in full audit; `sizeCorrection` keeps transformed leading on the implied-size basis; and `.reg-corner` nodes are created only for Compare cards.

## 7. Architecture finding: engine duplication across three files

**This is the single most important structural issue in the codebase.** The parsing/rendering engine (`parseExport`, `collectRenderablesWithSelection`, `paintArtboard`, and every helper) is not a shared module — it is copy-pasted inline into `preview.js` (loaded by `index.html`) **and separately** into `turbo_preview_artifact_5.html` **and separately again** into `turbo_preview_artifact_7_7_0.html`. The three copies have organically diverged (§5 matrix), meaning bug fixes made in one file are **not automatically present** in the others, and there is currently no mechanism to keep them in sync.

**Recommendation (not yet actioned):** extract the shared engine into a single source file and have both distribution lines consume it — the Standalone line via `<script src>` (as `index.html` already does today), the Artifact line via a build step that inlines it into the single-file `.html` output. Until that refactor happens, any engine-level fix must be manually ported to all three files, and this doc's §5 matrix must be updated to reflect which files received it.

## 8. Open issues

1. `turbo_preview_artifact_7_4_1.html`'s `PREVIEW_BUILD` says `"1.0.1"`; should read `"7.4.1"` (D001).
2. Engine duplication across three files with no sync mechanism (§7).
3. `index.html`/`preview.js` and `turbo_preview_artifact_5.html` are missing the fixes listed in §5's "known gap" cells — most notably D005 (invisible text on float-color descriptors) and D010/D022 (stale-layout-on-font-swap class of bugs), which are silent-failure-mode bugs, not cosmetic ones.
4. No automated test coverage of any kind was found for any of the three files.
5. The ISI `titleAtTop` set (`970x546`, `mobile-instream`; explicitly excluding `970x250`) is code-confirmed and consistent with available package structures, but this pass did not locate a served-production capture proving the complete per-size placement rule. Do not broaden the set or log it as fully evidence-confirmed until that reference exists.


## Screenshot capture addendum — 7.8.0

The delivered standalone source is `preview/archive/turbo-preview-7.8.0.html`; the confirmed input is preserved as `preview/archive/turbo-preview-7_7_1_3.html` (internal tag 7.7.1). The baseline feature matrix above has not been asserted to describe every intervening, undocumented source change. D046 records that drift explicitly.

Capture reuses `auditStatesForEntry`, creates unique planned paths, embeds package font CSS once, builds temporary original-size stages, settles PNG retries/fonts/text measurements, converts through embedded html-to-image 1.11.13, verifies PNG dimensions, and packages through embedded JSZip 3.10.1. Nested package assets and disclaimer images resolve through the package map. Unknown raster references use local missing-data markers rather than filesystem-relative fallback.

`_capture-manifest.json` always records job outcomes. Ordinary job errors continue; cancellation, conversion timeout, setup failure, and PNG memory limits stop scheduling with explicit remaining-job accounting. `csm:capture-state` and `data-capture-busy` coordinate the parent QA Studio replacement control. Limits and schema are specified in [08 — Screenshot Capture Tool](08-Screenshot-Capture-Tool.md); code-level evidence and remaining fidelity gaps are recorded in [09 — Screenshot Capture Analysis](09-Screenshot-Capture-Analysis.md). No Playwright capture backend is implemented by this change.

## CSM review PDF addendum — 7.8.4

The capture orchestrator retains successful PNG blobs as review inputs while adding them to JSZip. It builds 1600×900 white canvas pages with a light-gray section bar, places creative directly using reference-specific grids, converts each page to JPEG, and writes a self-contained PDF 1.7 byte stream with an image XObject and content stream per page. The PDF page box remains 960×540 points. The generated PDF is added to the ZIP and retained behind a separate **Review PDF** download button. `_capture-manifest.json.reviewPdf` records status, filename, page count, included sections, limitations, nonfatal review warnings, and template identifier `USA-938-80400-style-v1`.

The package video is decoded at 5, 12, and 15 seconds, clamped inside shorter videos. Starting at 5 seconds avoids an empty intro sample and follows the requested screenshot policy. `video1.mp4` is preferred; the first package MP4 is the fallback. Matching `preQual_<size>.png` files supply teaser evidence. Main-unit pages are created only from successful preview captures. Size-specific grids reproduce the reference density; phone, player, browser, and OTT shells are drawn as document presentation around source evidence. Full ISI is dynamically typeset into one dense page from the parsed disclaimer; it is not a screenshot of a production scroll container. PDF creation is optional and a PDF-specific failure does not discard valid PNGs or prevent the diagnostic ZIP.
# Feedback/debug bundle addendum — 7.11.0-feedback

QA Studio uses its existing same-origin iframe bridge to request one active-stage PNG and structured preview state. The host conditionally validates a `showcase.vdx.tv` CCRV/Showcase URL, combines `feedback.json`, screenshot evidence, the optional in-memory source ZIP, and user attachments with `fflate`, then posts the ZIP to the loopback `/api/ctv-ott/feedback/upload` endpoint. The local service authenticates to Box with Client Credentials Grant and uploads to `BOX_FEEDBACK_FOLDER_ID`; credentials never enter browser code. The endpoint rejects non-local browser origins and fails closed when configuration is absent. See `19-Feedback-Debug-Bundle.md` for the schema and boundaries.
