# 03 — UI/UX Guidelines — Turbo Export Preview

**Doc version:** 1.5.0
**Reflects build:** `turbo_preview_artifact_7_7_0.html` @ **v7.7.0** (historical baseline). `index.html`/`preview.js` (Standalone, v1.0.0) has a much plainer, unthemed UI — differences called out inline where relevant.
**Last updated:** 2026-09-13
**Status:** ⚠️ Reconstructed baseline — see `04-Decisions-Log.md` § D000.

**Current screenshot release:** `preview/turbo-preview-7.8.0.html`. The main sections below preserve the 7.7.0 baseline; the screenshot addendum and `08-Screenshot-Capture-Tool.md` describe 7.8.0.

---

## 1. Design tokens (Turbo Preview Artifact — `:root` / `[data-theme]`)

```css
/* Dark (default) */
--table:         #0c0d10   /* page background */
--table-line:    #252830   /* section rule lines */
--surface:       #14161b   /* cards, top bar, control panel */
--surface-raised:#1b1e25   /* popovers, active segmented-button fill (new in v7.6.0) */
--ink:           #f7f7f8   /* primary text */
--ink-soft:      #a9adb7   /* secondary text */
--ink-faint:     #737986   /* tertiary / eyebrow labels */
--line:          #2a2e37   /* borders */
--accent:        #4f6cf7   /* primary action / active state */
--accent-hover:  #657ef8
--accent-soft:   rgba(79,108,247,.16)   /* selection highlight, checked-chip dot bg */
--shadow-lg:     0 24px 70px rgba(0,0,0,.34)   /* popovers, drop-card, artboard cards (new in v7.6.0) */

/* Light (html[data-theme="light"] override) */
--table:          #f2f3f5
--table-line:     #dddfe4
--surface:        #ffffff
--surface-raised: #ffffff
--ink:            #17191e
--ink-soft:       #666b76
--ink-faint:      #9297a1
--line:           #e3e5e9
--accent-soft:    rgba(79,108,247,.10)
--shadow-lg:      0 24px 70px rgba(29,35,48,.13)
```

Dark is the default on load (`setTheme("dark")` runs unconditionally at startup — there is no persisted preference across sessions, and no localStorage is used).

## 2. Typography

| Role | Stack | Used for |
|---|---|---|
| Display | `"Space Grotesk", -apple-system, "Segoe UI", sans-serif` (500/600/700) | Package name in top bar, drop-zone title |
| Body | `"Inter", -apple-system, "Segoe UI", sans-serif` (400/500/600) | Everything else UI-chrome |
| Mono | `"IBM Plex Mono", "SF Mono", Menlo, Consolas, monospace` (400/500) | Eyebrow labels, control-row labels, error banner, package meta, build tag, kerning-panel rows. |

Loaded via Google Fonts `<link>` with `preconnect` hints. **Note:** this is the tool's own *UI chrome* font — unrelated to the creative's own authored fonts, which come from the package's `export.json` `fonts` array and are injected separately (see Tech Spec §4.2, D009/D010).

## 3. Signature visual motif: registration marks

Corner "printer's registration mark" brackets (`.reg-corner.tl/tr/bl/br`, 9×9px, 1.5px border) decorate the drop-zone card and each artboard card in Compare view — a deliberate nod to the print/production-QC domain. **Do not** apply this to arbitrary UI chrome; it's reserved for content-bearing cards (the drop-zone and artboard cards), not buttons or panels.

## 4. Core layout regions

1. **Drop-zone** (pre-load state) — centered card, brand mark, icon, title, sub-copy, primary button, and a hint line explicitly reassuring "Processed locally in your browser. Nothing is uploaded." **This privacy copy is a product requirement (see PRD §5.7), not optional boilerplate** — keep it if this screen is ever redesigned. As of v7.6.0 the hint line leads with a small green "privacy dot" indicator rather than being plain text — the requirement is the message, not this specific visual treatment.
2. **Loading state** — spinner + a single dynamic label (`"Unzipping X…"` → `"Reading export.json…"` → `"Preparing N asset file(s)…"` → `"Parsing artboards…"`). Always communicate *which step* is running, not a generic "Loading…" — packages can be large and users need to know it hasn't hung.
3. **Error banner** — soft red (`#FBEAE8` bg / `#8A2E22` text), shown inline above the drop-zone on failure, not a modal/alert(). Always includes the actual error message (e.g. "No export.json found inside this zip.").
4. **Top bar** — sticky, `z-index: 20`. As of v7.6.0: brand mark + name/kicker, a divider, package name (truncated with ellipsis, max-width 340px) + asset-count meta, a subdued build badge, theme toggle, and "Open package" reset. Actions remain pinned right via `.top-actions`; the build badge remains visible for QA traceability (D039).
5. **Control panel** — sticky (`z-index: 19`, positioned below top bar via a CSS custom property `--top-bar-height` kept live by a `ResizeObserver`, D022). As of v7.6.0 this is redesigned from three always-visible rows into a single `.workspace-nav` row — see §5 for the new controls, replacing the previous chip-row / segmented-button-row / segmented-button-row structure.
6. **Stage** — the artboard cards themselves, each individually horizontally scrollable (D020) so an oversized artboard never grows the whole document past the viewport. As of v7.6.0, Compare mode arranges cards into a fixed hero/wide/banner/tall/square "bento" layout rather than a flat wrapping grid — see §5.

### 4.1 Build tag visibility

The build tag (`#buildVersionTag`, e.g. "build 7.7.0") is always visible as a subdued mono badge so QA screenshots and defect reports retain build traceability. It is populated from `PREVIEW_BUILD`; do not hard-code its text separately.

## 5. Controls (redesigned in v7.6.0)

- **View mode** (`.view-mode`): a segmented pair of buttons, **Compare** and **Preview**, replacing the pre-7.6.0 single stateful "Compare: Off" / "Compare: On" toggle. Each button is one-directional (click Compare to enter Compare mode, click Preview to leave it); `aria-pressed` is kept in sync on both. Functionally equivalent to the old toggle, but is now two controls rather than one — update any future accessibility audit accordingly (see §7's existing chip-keyboard-operability gap, which the segmented buttons do not share, but which is worth re-verifying given the structural change).
- **Size selector** (`.selector-trigger` / `.size-popover`): size selection moved from an always-visible chip row into a dropdown popover, opened via a trigger button showing a live summary (`"Choose size"` / a single size name in Preview mode / an `N sizes` count in Compare mode). Inside the popover: **Preview mode** — radio-style single-select chips, selecting one closes the popover and re-renders immediately. **Compare mode** — checkbox-style multi-select chips (same `.chip`/`.chip-dot` visual language as before, D-series unchanged), plus an **"All sizes" / "Clear all"** segmented button at the bottom of the popover (this is the same reversible action described for the pre-7.6.0 "all sizes toggle" — see the note below).
- **All sizes toggle**: an `aria-pressed` segmented button, not passive status text. Selecting all sizes from a partial state, or clearing to none from a fully-selected state, remains the two supported actions; selecting all from Preview mode switches into Compare mode and includes every available size. Its container is inside the size popover.
- **Content nav** (`.content-nav`): tab buttons (`#tabButtons`) and slide buttons (`#slideButtons`) remain segmented-button rows, now grouped together with a **next-tab arrow control** (`#nextTabBtn`) that cycles to the following tab without opening any menu — new in v7.6.0, hidden automatically when fewer than two tabs exist.
- **Kerning/text-sync review** (`#kerningRow` / `#kerningDetailsBtn` / `#kerningPanel`): an always-available baseline disclosure, shown whenever the package has at least one Optical-kerning risk or the rendered state has a genuine measurement failure. The visible "Review text (N)" count includes both categories and opens a labeled region listing them. `?textQA=1` adds the separately labeled full every-state audit; it is not required for the baseline control, panel, or in-canvas markers (D042).
- **Mobile-instream scale** (v7.7.0): focused Preview mode adds a Fit/1× segmented pair inside the `mobile-instream` card label. Fit is the default and shows the full-resolution 970×546 source through a production-matched 485×273 presentation viewport; 1× removes that presentation scale. The control never appears in Compare mode (D043).
- **Segmented buttons** (view mode, tab/slide/theme, all-sizes): flat rectangular buttons, `--surface-raised` fill + shadow when active (previously flat `--accent` fill) — reused identically across every control row; keep this one component rather than inventing new button styles per control.

## 6. States that must always be handled explicitly

| State | Treatment |
|---|---|
| No sizes selected | `#emptyState`: centered, muted "No sizes selected." — never an empty blank stage |
| Tab/slide combination not available for the current artboard | `.cp-unavailable` diagonal-stripe overlay + "Not available for this size" — a legitimate, informative result, not an error (see `index.html` comment: switching to a tab/slide unlisted for a given size is intentionally shown, not hidden) |
| Missing image asset | Diagonal red-stripe placeholder + dashed red outline + `title` tooltip naming every filename actually tried (including the `-2x` retry) |
| Missing video asset | Same red-stripe treatment, applied to the `<video>` element itself via `onerror` |
| No `disclaimer.html` in package (Artifact line only) | `.cp-isi-unavailable`: soft-red diagonal stripe, "No disclaimer.html found in package" — same visual family as the missing-asset state, so users learn one pattern for "something's missing" |
| Production text geometry cannot be measured | Leave the text visible and mark the layer with an always-on dashed red outline plus a production-reference tooltip; never crop or silently replace it. A `csm:text-measured` event refreshes the rendered-state panel entry from `data-text-qa-failure="true"`. Candidate non-convergence alone is a full-audit calibration note, not a red defect marker. |
| Photoshop Optical-kerning text | Not an error state — the tool cannot reproduce Photoshop's optical-kerning shaping at all (hard platform ceiling, no CSS/canvas equivalent). Always flagged via a dotted amber outline on the layer itself (`data-kerning-risk="layout-risk"|"cosmetic"`) and listed package-wide in the review panel. Do not visually conflate this with the red "something's missing/broken" family above — it is an inherent tool limitation being disclosed, not a package defect. |
| ISI title placement | `970x546` and `mobile-instream` place the title above content; other named sizes, including `970x250`, place it below. This documents current behavior, not a fully production-verified universal policy; see Tech Spec §4.4/§8. |

Gallery dots, arrows, and progress controls inherit their visibility from the selected PSD layer tree. A visible `circularBar` uses the PSD's authored green frame plus a source-bounds white SVG indicator, centered production SVG play glyph, and static muted-state SVG when a `muteIcon` is authored; a hidden `dots`, `arrows`, `progressBar`, or parent `slideProgress` must leave no preview-only substitute behind.

An explicit blank PSD paragraph must remain visible as exactly one authored line-height. Do not simulate it with a global paragraph margin: that would alter normal paragraph spacing and production text geometry (D036).

**Design principle:** every one of these is deliberately *visible and labeled* in-canvas where applicable, and text findings are cross-referenced in the review panel; never leave a silent gap or console-only warning. If you add a new failure mode, follow this pattern — don't introduce a new visual language for "missing."

## 7. Accessibility notes (current state, not fully audited)

- `:focus-visible` gets a 2px `--accent` outline globally — preserve this if restyling any interactive element.
- The baseline text-review button includes the current finding count in both visible text and its accessible label. Full-audit progress/status replaces the count while an opt-in scan is running.
- The mobile-instream Fit/1× pair uses `aria-pressed` and an explicit group label; it is absent from Compare mode rather than disabled there.
- View-mode segmented buttons (Compare/Preview) use `aria-pressed`, kept in sync on both buttons.
- **Gap:** chip checkboxes are visually hidden (`.chip input { display: none }`) with a custom dot indicator — verify this remains keyboard-operable and has an accessible name before shipping further changes here; not verified as part of this reconstruction.
- **Gap, new in v7.6.0:** the size selector is now a popover triggered by a button with `aria-expanded`/`aria-controls`; keyboard operability of opening the popover, moving focus into it, and closing it on Escape or outside-click has code present (`document.addEventListener("keydown", ...)` closes on Escape) but has not been independently verified as part of this reconstruction.
- **Gap:** no skip-link, no explicit heading hierarchy (`h1`–`h6`) found in any of the three files — flagged, not fixed, by this reconstruction.

## 8. Responsive behavior (mobile ≤720px, with v7.6.0 refinements down to ≤620px)

- Top bar / control panel / stage padding reduced (28px → 16px horizontal) at ≤720px, tightening further at ≤620px (brand copy and theme toggle hidden, reset button collapses to an icon-only "Open" affordance).
- Size chip group and artboard cards switch to `flex-direction: column`; artboard cards go full-width (`width: 100% !important`).
- At ≤900px, the content-nav (tab/slide controls) wraps to its own full-width row below the size/view-mode controls rather than staying inline.
- Per-card `overflow-x: auto` (D020) is what actually prevents document-level horizontal bleed at these breakpoints — this is load-bearing, not cosmetic; don't remove it when touching mobile styles.
- The mobile-instream Fit viewport is content-specific, not CSS-breakpoint-driven: it remains 485×273 at every browser width and relies on the card's existing per-card horizontal overflow behavior when necessary. The 1× option similarly remains explicit rather than changing automatically at a breakpoint.

## 9. What NOT to change without checking the Decisions Log first

A few pixel-level values look arbitrary but encode confirmed production measurements — don't "clean them up":

- `TAB_BUTTON_HEIGHT = 28`, `TAB_BUTTON_VISIBLE_TOP = 5` — authored pill dimensions.
- `UNDERLINE_EPSILON_PX` (2 in v7.4.1+) — sub-pixel rasterization correction (D007).
- `PSD_SYNC_MAX_CANDIDATES = 5` and `PSD_SYNC_MAX_WIDTH_STEP_PX = 10` — recovered production limits; do not tune them without new production evidence (D031).
- The circular-control indicator is a 1px source-bounds SVG stroke and its play glyph is centered at 30% of the PSD control wrapper — do not turn either into an unverified generic icon or animation (D033).
- Superscript/subscript `0.58` size multiplier — standard typographic approximation, not arbitrary.
- The 24px nav-label gap / 20px shape-overhang constants in the horizontal/vertical nav track math — production-matched values (D017/D018 area).
- `WIDE_BENTO_MIN_WIDTH = 1988` (v7.6.0) — the single source that selects `wide-bento` versus `compact-bento`; CSS styles those classes without duplicating the numeric breakpoint.

If a real production package ever needs a different value here, that's a new Decisions Log entry with evidence, not a silent constant tweak.


## Screenshot capture addendum — 7.8.0

The preview toolbar offers output resolution (default 2×) and Screenshots. Screenshots opens a native modal with size scope, missing-asset policy, and planned frame count. All package sizes and capture-with-warnings are the defaults. Capture ZIP shows a polite live progress region and Cancel capture. Package replacement is disabled during preparation, capture, and ZIP generation.

The result shows explicit captured/incomplete/failed/not-captured counts, an expandable Capture report, Download ZIP, and Retry affected frames when applicable. Cancelled archives require an explicit download. Retry outputs are separate subset archives. Full user journeys, accessibility behavior, and result semantics are documented in [08 — Screenshot Capture Tool](08-Screenshot-Capture-Tool.md).
