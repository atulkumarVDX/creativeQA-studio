# 05 — Docs Maintenance — Turbo Export Preview

**Doc version:** 1.4.0
**Reflects build:** `turbo_preview_artifact_7_7_0.html` @ **v7.7.0** (current source)
**Last updated:** 2026-09-09
**Status:** ⚠️ Reconstructed baseline — see `04-Decisions-Log.md` § D000. This doc defines the maintenance process going forward; it did not exist previously in a recoverable form.

---

## 1. Purpose

This is the process doc. It defines:
1. How versioning/build tags work for both product lines, going forward.
2. Which of `01-PRD.md` / `02-Technical-Spec.md` / `03-UI-UX-Guidelines.md` / `04-Decisions-Log.md` must be touched for a given change, so docs don't drift from code the way they had (silently, with no doc trail at all) before this reconstruction.
3. The drift-check procedure to run **before** making any change to the tool.

## 2. Versioning policy (Semantic Versioning)

Each product line (`02-Technical-Spec.md` §2) is versioned **independently** using `MAJOR.MINOR.PATCH`:

- **MAJOR** — breaking change to the input format expected (e.g. a new required `export.json` shape), removal of a previously-supported artboard/tab/gallery convention, or a rewrite of the rendering pipeline that changes visual output for existing packages in a way QA must re-baseline against.
- **MINOR** — new capability, backward compatible (e.g. ISI panel rendering, vertical nav support, Compare mode, the v7.6.0 kerning QC layer and control-panel redesign). Every "new capability" row in the Tech Spec §5 matrix is a MINOR bump at minimum.
- **PATCH** — bug fix with no new capability (e.g. D005's float-color fix, D006's single-line heuristic fix, D020–D022's layout fixes).

When one release bundles more than one change type, use the highest required increment: a backward-compatible capability plus bug fixes is a **MINOR** release, not a PATCH release.

**Note on v7.6.0:** this build was initially drafted and tagged as a MAJOR jump (`8.0.0`), on the reasoning that it combined a new QC subsystem with a full UI redesign. On review against the MAJOR criteria above, neither qualified — the kerning QC layer is new tooling around the existing, unchanged D031 text-sync algorithm, and the UI redesign is chrome-only; the per-artboard creative-rendering engine (`parseExport` / `collectRenderablesWithSelection` / `paintArtboard`) is untouched. The file was renamed and re-tagged to `7.6.0` (MINOR) before this update. See `04-Decisions-Log.md` D037/D038.

### 2.1 The `PREVIEW_BUILD` constant

`PREVIEW_BUILD` in the code **must always equal the current semver of that file**, e.g. `"7.7.0"`. No date-stamps, no free-text suffixes (the pre-baseline tags `2026.08.14-nav-label-fix.3` and `2026.08.15-text-render-fix.4` are the pattern being retired — see D001). If you need to record *what* a build fixed and *when*, that's what the Decisions Log is for — don't encode it into the version string.

- `index.html` also references `preview.js?v=<tag>` as a cache-buster query param — keep this equal to the current semver too when it's next touched, so the two can't silently drift from each other again.

### 2.2 Current versions (as of this baseline)

| File | Line | Version | Notes |
|---|---|---|---|
| `index.html` + `preview.js` | Standalone | **1.0.0** | First formally tracked version (baseline) |
| `turbo_preview_artifact_5.html` | Turbo Preview Artifact | **superseded / deprecated** | Do not assign a fabricated precise predecessor number — see D001 |
| `turbo_preview_artifact_7_7_0.html` | Turbo Preview Artifact | **7.7.0** | Current source. Reconciles always-on text disclosure and registration marks, and formally releases the mobile-instream Fit/1× capability (D040–D044; D045 withheld pending evidence). |
| `turbo_preview_artifact_7_6_2.html` | Turbo Preview Artifact | **7.6.2 baseline** | Preserved review input. Its unlogged changes are not retroactively assigned to 7.6.1 or reconstructed without evidence. |
| `turbo_preview_artifact_7_6_1.html` | Turbo Preview Artifact | **7.6.1 baseline** | Preserved source only; its release contents and rationale are unrecoverable and must not be fabricated (same evidence rule as D001). |
| `turbo_preview_artifact_7_6_0.html` | Turbo Preview Artifact | **7.6.0 baseline** | Preserved kerning-QC and control-panel/compare-layout baseline (D037, D038). |
| `turbo_preview_artifact_7_5_6.html` | Turbo Preview Artifact | **7.5.6 baseline** | Preserved blank-paragraph-preservation baseline (D036). |
| `turbo_preview_artifact_7_5_5.html` | Turbo Preview Artifact | **7.5.5 baseline** | Preserved all-sizes-toggle baseline (D035). |
| `turbo_preview_artifact_7_5_4.html` | Turbo Preview Artifact | **7.5.4 baseline** | Preserved mute-control baseline (D034). |
| `turbo_preview_artifact_7_5_3.html` | Turbo Preview Artifact | **7.5.3 baseline** | Preserved SVG progress-control baseline (D033). |
| `turbo_preview_artifact_7_5_2.html` | Turbo Preview Artifact | **7.5.2 baseline** | Preserved circular-control baseline (D032). |
| `turbo_preview_artifact_7_5_1.html` | Turbo Preview Artifact | **7.5.1 baseline** | Preserved text-parity baseline (D031). |
| `turbo_preview_artifact_7_5_0_8.html` | Turbo Preview Artifact | **7.5.0 baseline** | Preserved pre-fix baseline with a non-canonical filename; do not treat it as the current release. |

### 2.3 This doc set's own version

The five docs are versioned together as a bundle, independent of the code's version: currently **1.4.0**. Bump the bundle's `Doc version` header on every doc that changes in a given update, even if only one doc's content actually changed — keeps all five headers auditable against the same timeline.

## 3. Change-type → doc-update table

Run this **every time** before merging a change to `preview.js` / any `index.html` or `turbo_preview_artifact_*.html`:

| Change type | 04 Decisions Log | 01 PRD | 02 Technical Spec | 03 UI/UX Guidelines |
|---|:---:|:---:|:---:|:---:|
| Bug fix (no behavior/capability change visible to the user) | **Always** — new `D0XX` entry with rationale + evidence | No | Update §5 matrix if it closes a "known gap" cell; update §8 open issues | No |
| New feature / capability | **Always** | Yes — update §6 parity table, and §3/§4 if it changes a product line's description | Yes — new §4.x subsection if it's pipeline-level, update §5 matrix, update §6 constants if new ones introduced | Yes — new state/control needs a §4–§6 entry |
| Visual/UI-only change (styling, layout, copy) | **Always** (short entry acceptable) | No, unless it changes a stated requirement (e.g. touching the "nothing is uploaded" copy) | No, unless it's structural (e.g. D020/D021-style layout/stacking fixes belong here) | **Always** |
| Version/build tag correction only (like D001) | **Always** | No | Update §2 current-versions table | No |
| New engine-shared-vs-duplicated architecture decision | **Always** | Update §4/§6 if it changes which line has which capability | **Always** — this is what §7 is for | No |
| Docs-only correction (typo, drift found during a check) | Optional (only if it reveals a real prior gap) | Update the header `Reflects build:` line | Update the header `Reflects build:` line | Update the header `Reflects build:` line |

**Rule of thumb:** if you're not sure, update the Decisions Log — it's cheap, append-only, and it's what makes the next drift-check possible. The PRD/Spec/Guidelines only need touching when the change actually alters user-facing capability, architecture, or design system, not for every fix.

## 4. Drift-check procedure (run before starting any new change)

1. **Compare build tags.** For each file you're about to touch, `grep PREVIEW_BUILD` (and `preview.js?v=` in `index.html`) and compare against this doc set's §2.2 table and each doc's `Reflects build:` header. If they don't match, something changed without a doc update since the header was last written — stop and reconcile before proceeding (update the Decisions Log with what you find, per §3's "docs-only correction" row).
2. **Spot-check structural drift.** Grep for the feature markers in `02-Technical-Spec.md` §5/§6 (e.g. `rgbChannels`, `isVerticalNav`, `cp-isi`, `scaleTextStyle`, `ResizeObserver`, `scanPackageKerningRisks`) against the actual file. If a marker's presence/absence doesn't match the matrix, the Tech Spec is stale — fix the matrix as part of your change, not as a separate cleanup later.
3. **Only then** make the code change.
4. **Before merging**, apply the §3 table for what you just did.

## 5. Known standing debt (tracked here so it isn't lost again)

- Engine duplication across three files with no shared-module mechanism (Tech Spec §7) — the actual reason drift like D005/D014/D015/D020-22 exists between files today. Any doc-maintenance process is a mitigation, not a fix, for this; the real fix is the refactor described in Tech Spec §7.
- No test coverage found in any of the three files (Tech Spec §8, item 4) — drift-checks in §4 above are manual because there's nothing automated to run instead.
