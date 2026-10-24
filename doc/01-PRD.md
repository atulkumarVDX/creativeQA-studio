# 01 — Product Requirements Document — Turbo Export Preview

> **Current release: 7.12.5** — `preview/turbo-preview-7.12.5.html`. Adds manual gallery arrow navigation and directional slide transitions; map and feedback behavior inherit 7.12.4 and 7.12.3 respectively.

**Doc version:** 1.8.0
**Reflects build:** `preview/turbo-preview-7.12.5.html` @ **v7.12.5** (current); historical baselines are described below.
**Last updated:** 2026-10-23
**Status:** ⚠️ Reconstructed baseline — see `04-Decisions-Log.md` § D000. Product goals/personas below are inferred from code behavior and comments (e.g. references to "Creative State Manager", "PSD_Design_Guidelines.docx", QC framing), not from an original PRD.

**Current screenshot release:** `preview/turbo-preview-7.9.11.html`. The main sections below preserve the 7.7.0 baseline; the screenshot addenda and `08-Screenshot-Capture-Tool.md` describe the current capture line.

---

## 1. Problem statement

Photoshop-authored, multi-size display/video ad creative ("VDX Turbo" packages) is exported by a separate pipeline into `export.json` (a serialized layer manifest) plus rasterized PNGs, fonts, and video. Before a package ships, someone needs to verify — per size, per tab, per gallery slide — that the export actually matches what was authored in the PSD: correct text, correct wrapping, correct nav labels, correct ISI/legal copy, no missing assets, no overlapping layers. Doing this by opening Photoshop or waiting on the real ad-serving pipeline is slow and doesn't scale across dozens of size/tab/slide combinations per package.

## 2. Product goal

A **zero-install, offline, in-browser QC preview** that reconstructs the exported creative at true 1:1 pixel scale directly from `export.json` + its asset files — accurate enough to catch real production bugs (wrong colors, wrong wraps, overlapping text, missing nav labels) before the package ships, without needing Photoshop, a build step, or a server.

## 3. Primary users

Creative QA / production coordinators reviewing an export package across:
- Multiple **artboard sizes** (e.g. 970×546, 300×250, 728×90, 160×600, mobile-instream)
- Multiple **tabs** within a size (product/navigation tabs authored per PSD's `tabComponent`/`tab{N}` convention)
- Multiple **gallery slides** within a tab (rotating merchandising/hotspot/color-picker galleries)

## 4. Two products, one problem

| | Standalone Preview | Turbo Preview Artifact |
|---|---|---|
| **Form factor** | `index.html` + `preview.js`, opened via `file://` next to the unzipped export folder | Single self-contained `.html` file (works as a Claude artifact or any static host) |
| **Input** | Pick `export.json`; PNGs/fonts/video must already sit alongside it on disk | Drop/pick a `.zip` of the whole package; unzipped and resolved to blob URLs entirely in-browser |
| **Best for** | Local, filesystem-based QC workflows | Sharing a preview without asking someone to unzip anything locally; artifact/chat-embedded workflows |
| **Current version** | v1.0.0 | v7.9.11 (current source: `preview/turbo-preview-7.9.11.html`) |

Both exist because they serve different delivery contexts, not because one is meant to replace the other — but see `02-Technical-Spec.md` §7: they currently share **duplicated**, not shared, engine code, and have drifted in capability (§6 below).

## 5. Core requirements (what "accurate" means here)

1. **Every exported size renders with true 1:1 source geometry** — no general auto-fit/shrink, since the point is verifying real size (see Decisions Log D028). The sole presentation exception is `mobile-instream` in focused Preview mode: it defaults to a production-matched 0.5× Fit viewport and offers a reviewer-controlled 1× view; Compare mode remains 1:1 (D043).
2. **Tab and slide switching is interactive and instant** — selecting a tab/slide re-derives visibility from the layer tree live, rather than only showing whatever was active when the package was exported.
3. **Text is real, live HTML text** — never a rasterized image — matching the PSD guideline that text layers must never be flattened, and enabling accurate on-screen wrapping checks.
4. **Real custom fonts load and are measured before layout**, not just rendered — a wrong metric here silently produces wrong wraps and false-positive overlap bugs (D009, D010).
5. **Missing assets are visibly flagged** in the preview itself (diagonal red-stripe placeholder + tooltip with the filename(s) tried), not silently blank.
6. **Nav bar (tabs) is reconstructed from the master artboard's authored templates**, since the per-size nav placeholder itself has no rasterized image (D011).
7. **Nothing is uploaded anywhere** — the Turbo Preview Artifact explicitly advertises this in its own drop-zone copy ("Processed locally in your browser. Nothing is uploaded," as of v7.6.0's drop-zone copy revision); this is a stated privacy/trust requirement, not an implementation detail, and must be preserved verbatim in intent through any future drop-zone redesign.
8. **Authored blank paragraphs are preserved** — an explicit empty paragraph in PSD copy must retain one line of vertical space instead of collapsing in the HTML preview (D036).
9. **Known text-fidelity limitations are disclosed, not hidden** (Artifact line) — Optical-kerning risks receive a dotted amber in-canvas marker and package-wide panel entry; genuine measurement failures receive a dashed red in-canvas marker and a panel entry for the rendered state. This baseline disclosure is always on. `?textQA=1` additionally runs the eager audit across every valid artboard × tab × slide and enables catalog-oriented diagnostics; it is not required to discover ordinary findings. See `02-Technical-Spec.md` §4.5 (D037, D042).
10. **Mobile-expandable responsive flow is structural, not campaign-specific** (Artifact line) — in the 375×622 view, qualifying full-width video is resized proportionally and its rounded height delta is applied once to each direct sibling branch. Descendants preserve local spacing, while contained video and unrelated structures remain unchanged (D067/D068).

## 6. Feature parity gaps (current state, not aspirational)

The two products — and the several generations within the Artifact line — are **not** at feature parity today. See `02-Technical-Spec.md` §5 for the full matrix. Highlights a PM should know:

- Only the Artifact line renders the **ISI/legal disclaimer panel** from the package's own `disclaimer.html` (introduced v7.4.1). Neither the Standalone tool nor the deprecated `artifact_5` render it at all — QC done in those two will silently miss ISI content entirely.
- Only the Artifact line (from v7.4.1 onward) supports **rotated/vertical sidebar nav** (needed for narrow-tall sizes like 160×600), **float-channel color descriptors** (needed to avoid invisible text — a real, previously-shipped bug, D005), the recovered production-compatible PSD text geometry path (D031), and production-derived SVG geometry for circular gallery progress and mute controls (D034).
- **Artifact line only:** package-wide optical-kerning scanning plus visible text-synchronization-failure disclosure is surfaced in a dedicated review panel (D037/D042). Baseline markers and findings are always available; the full every-state audit remains an opt-in developer/QA mode. Not present in the Standalone line or `artifact_5`.
- **Newly formalized in v7.7.0, Artifact line only:** focused `mobile-instream` Preview offers Fit (production-matched 0.5× presentation) and 1× controls. This is a scoped presentation exception; Compare mode remains true-size (D043).
- **Artifact line only in v7.9.11:** focused mobile-expandable Preview models the 375×622 production host, responsive ISI, anchored controls and branch-level vertical reflow after qualifying full-width video (D067/D068).
- **v7.6.0, Artifact line only:** the control panel and Compare-mode artboard layout were redesigned (D038) — chrome-only, no effect on rendering fidelity or the parity gaps above.
- The Standalone tool has not received most fixes made in the Artifact line since it forked (D012, D014, D015, D022, and others), nor the v7.6.0 QC tooling.

**Product decision needed (not yet made):** either (a) formally deprecate the Standalone line and the old artifact_5 in favor of a single actively-maintained engine (see Tech Spec §7 recommendation), or (b) commit to porting fixes to all active lines going forward and track that explicitly per release. This PRD does not decide this — it's flagged for a product/eng call.

## 7. Explicit non-goals

- Not a replacement for viewing the real served ad in a browser/ad-server sandbox — it's a pre-ship QC approximation.
- Not a replacement for a served-ad comparison: the recovered production text-geometry algorithm (D031) and static circular-control geometry (D032–D034) narrow the gap, but final visual approval still requires the target browser, package fonts, and a production reference together.
- Not a design/editing tool — read-only preview of an already-exported package.
- No accounts, no server-side storage, no analytics observed in any of the three files.
- The kerning/text-sync review surface is a **detection and disclosure aid**, not a fix — it does not and cannot make browser-rendered text match Photoshop's Optical-kerning shaping; it exists so a reviewer knows where to expect a discrepancy, not to eliminate it.

## 8. Versioning

See `05-Docs-Maintenance.md` for the semver policy. Summary: the Standalone line and the Artifact line are versioned **independently**; each ships its own `PREVIEW_BUILD` tag which must equal its semver. The current Artifact release is the 7.9.11 patch. v7.7.0 remains the historical MINOR release that formally introduced the mobile-instream Fit/1× capability alongside PATCH-level disclosure and registration-mark corrections.

## 9. Release invariants

- A package with an Optical-kerning risk or a genuine text measurement failure must expose a visible **Review text (N)** control without requiring a query parameter.
- The relevant in-canvas marker must remain visible when the panel is closed: dotted amber for Optical-kerning risk, dashed red for measurement failure.
- `?textQA=1` may add an eager every-state audit and catalog export, but must never be the only disclosure path.
- The current artifact filename, `PREVIEW_BUILD`, build badge, and all five core-doc `Reflects build` headers must agree.


## Screenshot capture addendum — 7.8.0

The Preview tool must export individual PNGs for every available size/tab/gallery-slide state into one ad-size ZIP. All sizes is the default; selected preview sizes is an alternative scope. Output defaults to 2× and supports explicit 1×, 2×, and 3× resolution at authored canvas geometry. Every planned state must have an outcome, and incomplete images must be distinguished from failed capture.

The release adds tolerant/complete-asset policies, cancellation, affected-state retry, an explicit retained download, and a coverage manifest. QA Studio embeds this source and prevents package replacement during a run. Capture is a preview-renderer output; production pixel parity is a separate acceptance requirement. Requirements SC-01–SC-22, boundaries, and the proposed production service are documented in [08 — Screenshot Capture Tool](08-Screenshot-Capture-Tool.md).

## CSM review package addendum — 7.8.4

The screenshot flow must optionally create a 16:9 landscape review PDF in the same run as the structured PNG ZIP. Its section names, sequence, gray title bar, direct creative placement, and page density follow the supplied `USA-938-80400.pdf` reference: video, desktop in-frame, desktop expandable teaser and engaged endpoints, desktop instream, mobile instream, mobile in-frame, mobile expandable teaser and engaged endpoints, OTT, and full ISI. Sections are included only when the package provides corresponding evidence.

Device, browser, player, and OTT frames are review-document approximations around captured package evidence. They must not be described as captured production chrome. The VPM hover transition remains unavailable because the preview has no transition state; teaser and engaged endpoints are presented separately. The complete requirement and capability matrix is in [14 — CSM Review PDF](14-CSM-Review-PDF.md).
# Feedback/debug bundle addendum — 7.11.0-feedback

QA users can open **Report feedback** from the app menu and submit a structured debug bundle directly to the configured Box folder. A valid CCRV or Showcase URL is mandatory only for a visual mismatch, where a production comparison target is essential; it is optional but validated when supplied for other feedback types. Description and reproduction steps remain optional, and Actual/Expected fields appear only for visual mismatches. The ZIP is assembled in memory and uploaded only after the explicit **Submit Feedback** action. The complete contract is defined in `19-Feedback-Debug-Bundle.md`.
