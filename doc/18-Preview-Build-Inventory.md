# Preview Build Inventory

**Current QA Studio release:** `preview/turbo-preview-7.15.5.html` (based on 7.15.4; creative-wide video/package limits and AdEx escalation guidance)
**Runtime pointer:** `preview/current-preview.ts`
**Inventory date:** 2026-11-03

The current CTV/OTT design and technical contract is [CTV/OTT Consolidated Spec](CTV-OTT-Consolidated-Spec.md). Version numbers below identify both the embedded HTML and companion renderer; an HTML-only comparison cannot establish motion parity.

## Runtime and archive policy

QA Studio imports only the source named by `preview/current-preview.ts`. The current HTML is directly under `preview/`. Older 7.11.2–7.11.15 HTML files are **also still present directly under `preview/`** as retained history, although they are not runtime imports; 7.11.0-feedback and 7.11.1 are archived. Do not describe the intended archive policy as already completed, or delete/move retained builds without approval. Regression tests may read historical files directly; app code must not import the archive.

“Unique” below means the complete HTML has a content hash not shared by another inventoried build after normalizing only the `const PREVIEW_BUILD = "…"` declaration. It is a byte-level implementation distinction, not a claim that every difference is behaviorally meaningful.

## Current release and retained CTV/OTT patch series

| Filename | Bytes | Declared build | Location | Role |
|---|---:|---:|---|---|
| `turbo-preview-7.15.4.html` | 681,401 | 7.15.4 | `preview/` | Current patch. Inherits 7.15.3 renderer; Teasers follow Main Unit artboard order in a responsive bento layout. |
| `turbo-preview-7.15.3.html` | 681,401 | 7.15.3 | `preview/` | Current patch. Promotes creative destinations, groups review metrics, and exempts `video_ctvott.mp4` from the 2.5 MB rule (D101). |
| `turbo-preview-7.15.2.html` | 681,401 | 7.15.2 | `preview/` | Retained patch. Hides the technical workspace completion label while retaining package checks and Findings (D100). |
| `turbo-preview-7.15.1.html` | 681,401 | 7.15.1 | `preview/` | Retained patch. CTAs counts Desktop Expandable (`970x546`) CTA instances across tabs and slides; repeated groups in other sizes are excluded (D099). |
| `turbo-preview-7.15.0.html` | 681,401 | 7.15.0 | `preview/` | Retained MINOR release. Starts Main Unit in muted Compare with all sizes selected and names focused mode Single view (D098). |
| `turbo-preview-7.14.3.html` | 681,424 | 7.14.3 | `preview/` | Retained predecessor. Keeps Compare mute at workspace scope so Main Unit packages load normally (D097). |
| `turbo-preview-7.14.2.html` | 681,424 | 7.14.2 | `preview/` | Retained predecessor. Forces Compare-mode videos to mute while preserving the reviewer’s focused-Preview audio preference (D096). |
| `turbo-preview-7.14.1.html` | 680,777 | 7.14.1 | `preview/` | Retained predecessor. Keeps Teasers and CTV/OTT as distinct overview routes, makes Package Size open Assets, and validates documented CTV/OTT videos (D095). |
| `turbo-preview-7.14.0.html` | 680,779 | 7.14.0 | `preview/` | Retained predecessor. Based on confirmed 7.13.12; embedded renderer behavior is unchanged (D094). |
| `turbo-preview-7.13.12.html` | 680,780 | 7.13.12 | `preview/` | Retained previous release. Automatically selects feedback evidence, downloads the bundle locally, and links to manual Box upload; embedded renderer differs from 7.13.11 only by build identity (D093). |
| `turbo-preview-7.13.11.html` | 680,780 | 7.13.11 | `preview/` | Retained prior release. Adds progressive package-evidence levels in the QA Studio feedback host; embedded renderer differs from 7.13.10 only by build identity (D092). |
| `turbo-preview-7.13.10.html` | 679,914 | 7.13.10 | `preview/` | Retained prior release. Honors numbered `buttonN` CTA groups with one direct frame and documented `button-clientLogo` groups; generic decorative logos and map image buttons remain static (D091). |
| `turbo-preview-7.13.9.html` | 678,828 | 7.13.9 | `preview/` | Retained prior release. Centered playback glyphs, video-duration circular progress and 3-second default image autoplay (D090). |
| `turbo-preview-7.13.8.html` | 670,940 | 7.13.8 | `preview/` | Retained unchanged. Circular video play/pause, bottom-right sound overlay and sound retention on gallery wrap (D089). |
| `turbo-preview-7.13.7.html` | 665,498 | 7.13.7 | `preview/` | Retained unchanged. One authored circular progress glyph per selected content/component, preventing overlapping play/audio templates (D088). Inherits media lifecycle D087. |
| `turbo-preview-7.13.6.html` | 663,549 | 7.13.6 | `preview/` | Retained unchanged. Includes explicit progress visibility, authored circular control geometry and media lifecycle work (D083–D087). |
| `turbo-preview-7.13.5.html` | 644,031 | 7.13.5 | `preview/` | Previous release retained. CategoryGallery opens on its authored home cover and normalizes controller/render state to hide home tiles when a category slide is selected (D082). |
| `turbo-preview-7.13.4.html` | 642,319 | 7.13.4 | `preview/` | Retained predecessor. CategoryGallery uses separate category and nested slide navigation (D081); retains export-derived gallery dot radii. |
| `turbo-preview-7.13.3.html` | 632,725 | 7.13.3 | `preview/` | Retained predecessor. Dot radii derive from exported path bounds and corner radii, including the active 50% circle geometry (D080); retains QA-only CTA click behavior. |
| `turbo-preview-7.13.2.html` | 631,615 | 7.13.2 | `preview/` | Retained predecessor. Uses export-driven active/normal shapes and sizes; superseded for circle geometry by 7.13.3 (D079). |
| `turbo-preview-7.13.1.html` | 631,875 | 7.13.1 | `preview/` | Retained patch. Added CSS circle overrides for active/normal indicators; superseded by export-driven geometry in 7.13.2. |
| `turbo-preview-7.13.0.html` | 631,536 | 7.13.0 | `preview/` | Retained predecessor. Adds QA-only click/Enter behavior on recognized text CTAs; no package mutation or tracking (D077). |
| `turbo-preview-7.12.6.html` | 629,844 | 7.12.6 | `preview/` | Retained predecessor source for 7.13.0, including component-support updates. |
| `turbo-preview-7.12.5.html` | 620,409 | 7.12.5 | `preview/` | Retained prior build. Adds manual previous/next gallery arrow controls and directional slide-in transitions; no autoplay or circular progress interaction. |
| `turbo-preview-7.12.4.html` | 611,740 | 7.12.4 | `preview/` | Retained prior build and local-service health baseline. Production-aligned Leaflet/Mapbox location-map rendering is provided by the QA Studio host. |
| `turbo-preview-7.12.3.html` | 611,740 | 7.12.3 | `preview/` | Retained prior build. Direct Box feedback submission is provided by the QA Studio host and service. |
| `turbo-preview-7.11.2.html` through `turbo-preview-7.11.15.html` | Varies | Matching filename/build | `preview/` | Retained patch history, not app imports. The companion renderer changed across patches; do not infer behavior from HTML hashes alone. |

## Historical inventory snapshot (originally recorded through 7.11.2)

| Filename | Bytes | Declared build | Location | Unique implementation | Tests / scripts / documentation references |
|---|---:|---:|---|---|---|
| `turbo-preview-7.11.2.html` | 609,425 | 7.11.2 | `preview/` | Same embedded preview as 7.11.1 after normalizing build identity; historical CTV/OTT companion renderer | Historical build, no longer the current pointer |
| `turbo-preview-7.11.1.html` | 609,425 | 7.11.1 | `preview/archive/` | Same embedded preview as 7.11.0-feedback after normalizing build identity; prior CTV renderer baseline | Historical build |
| `turbo-preview-7.11.0-feedback.html` | 609,434 | 7.11.0-feedback | `preview/archive/` | Same renderer implementation as 7.11.1 after normalizing build identity; feedback capability is provided by QA Studio host | Historical feedback release; doc 19 |
| `turbo-preview-7.7.0.html` | 312,353 | 7.7.0 | `preview/archive/` | Yes | Historical 7.7.0 baseline described by core docs; no direct path reader |
| `turbo-preview-7.7.1.html` | 319,627 | 7.7.1 | `preview/archive/` | Yes | Preserved release; no direct path reader |
| `turbo-preview-7_7_1_3.html` | 350,344 | 7.7.1 | `preview/archive/` | Yes | `doc/02-Technical-Spec.md`, `04-Decisions-Log.md`, `05-Docs-Maintenance.md`, `08-Screenshot-Capture-Tool.md`, `09-Screenshot-Capture-Analysis.md` |
| `turbo-preview-7.8.0.html` | 457,044 | 7.8.0 | `preview/archive/` | Yes | Docs 02, 07, 09, 10, 11; `scripts/structure/embed*.mjs`; render-tree and validator tests |
| `turbo-preview-7.8.1.html` | 463,693 | 7.8.1 | `preview/archive/` | No; same as 7.8.2 except `PREVIEW_BUILD` | Docs 11, 12; `scripts/structure/smoke-render-fix.mjs`; `tests/structure/render-tree-fix.test.mjs` |
| `turbo-preview-7.8.2.html` | 463,693 | 7.8.2 | `preview/archive/` | No; same as 7.8.1 except `PREVIEW_BUILD` | `doc/04-Decisions-Log.md` |
| `turbo-preview-7.8.3.html` | 480,931 | 7.8.3 | `preview/archive/` | Yes | `doc/04-Decisions-Log.md`, `doc/08-Screenshot-Capture-Tool.md` |
| `turbo-preview-7.8.4.html` | 494,921 | 7.8.4 | `preview/archive/` | No; same as 7.8.5 except `PREVIEW_BUILD` | Docs 04, 05, 08, 14 |
| `turbo-preview-7.8.5.html` | 494,921 | 7.8.5 | `preview/archive/` | No; same as 7.8.4 except `PREVIEW_BUILD` | No direct references |
| `turbo-preview-7.8.6.html` | 495,701 | 7.8.6 | `preview/archive/` | Yes | `tests/structure/render-tree-fix.test.mjs` |
| `turbo-preview-7.8.14.html` | 501,992 | 7.8.14 | `preview/archive/` | Yes | No direct filename/path reference |
| `turbo-preview-7.8.15.html` | 501,880 | 7.8.15 | `preview/archive/` | No; same as 7.8.16 except `PREVIEW_BUILD` | `doc/04-Decisions-Log.md`, `doc/16-CTA-Warning-Investigation.md` |
| `turbo-preview-7.8.16.html` | 501,880 | 7.8.16 | `preview/archive/` | No; same as 7.8.15 except `PREVIEW_BUILD` | `doc/17-CTA-QA-Correction-Plan.md` |
| `turbo-preview-7.8.17.html` | 503,845 | 7.8.17 | `preview/archive/` | No; same as 7.8.18 except `PREVIEW_BUILD` | No direct filename/path reference |
| `turbo-preview-7.8.18.html` | 503,845 | 7.8.18 | `preview/archive/` | No; same as 7.8.17 except `PREVIEW_BUILD` | No direct references |
| `turbo-preview-7.8.19.html` | 507,066 | 7.8.19 | `preview/archive/` | Yes | Doc 17; `tests/screenshot/*`; render-tree-fix and superscript tests |
| `turbo-preview-7.9.0.html` | 584,202 | 7.9.0 | `preview/archive/` | Yes | Preserved release; no direct references |
| `turbo-preview-7.9.1.html` | 599,842 | 7.9.1 | `preview/archive/` | Yes | Preserved release; no direct references |
| `turbo-preview-7.9.2.html` | 600,672 | 7.9.1 | `preview/archive/` | Yes | Preserved filename/tag mismatch; no direct references |
| `turbo-preview-7.9.3.html` | 600,691 | 7.9.1 | `preview/archive/` | Yes | Preserved filename/tag mismatch; no direct references |
| `turbo-preview-7.9.4.html` | 605,698 | 7.9.1 | `preview/archive/` | Yes | Preserved filename/tag mismatch; no direct references |
| `turbo-preview-7.9.5.html` | 607,239 | 7.9.1 | `preview/archive/` | Yes | Preserved filename/tag mismatch; no direct references |
| `turbo-preview-7.9.6.html` | 607,268 | 7.9.1 | `preview/archive/` | Yes | `tests/layout/layout-audit.test.mjs`; preserved filename/tag mismatch |
| `turbo-preview-7.9.7.html` | 607,576 | 7.9.7 | `preview/archive/` | No; same as 7.9.8 except `PREVIEW_BUILD` | Paragraph-bounds and render-tree-fix tests |
| `turbo-preview-7.9.8.html` | 607,576 | 7.9.8 | `preview/archive/` | No; same as 7.9.7 except `PREVIEW_BUILD` | Paragraph-bounds and ordinary-radius tests |
| `turbo-preview-7.9.9.html` | 607,566 | 7.9.9 | `preview/archive/` | Yes | `doc/05-Docs-Maintenance.md`, ordinary-radius test, `scripts/verify-shape-radius-parity.mjs` |
| `turbo-preview-7.9.10.html` | 607,596 | 7.9.10 | `preview/archive/` | Yes | `doc/05-Docs-Maintenance.md` |
| `turbo-preview-7.9.11.html` | 608,896 | 7.9.11 | `preview/` | Yes | `preview/current-preview.ts`; core docs; fixed-viewport, responsive and text-presentation tests |

## Exact `PREVIEW_BUILD`-only duplicate groups

- `7.8.1` and `7.8.2`
- `7.8.4` and `7.8.5`
- `7.8.15` and `7.8.16`
- `7.8.17` and `7.8.18`
- `7.9.7` and `7.9.8`
- `7.11.0-feedback` and `7.11.1`
- `7.11.1` and `7.11.2` (embedded HTML only; FFmpeg renderer differs)

The groups above were compared across the full file after normalizing only the build declaration.

## Cleanup disposition

- **Current/runtime-retained:** `preview/turbo-preview-7.11.16.html`, `preview/current-preview.ts`, and the 7.11.16 renderer.
- **Older 7.11 patch files:** 7.11.2–7.11.15 remain under `preview/` and are not runtime imports. Archival cleanup has not been performed.
- **Archived:** historical releases, including the preserved 7.11.1 baseline.
- **Removed:** none.
- **Retained duplicate baselines:** 7.8.1/7.8.2, 7.8.15/7.8.16, and 7.9.7/7.9.8 remain because documentation or regression tests distinguish their release identities.
- **Deletion candidates requiring explicit approval:** `preview/archive/turbo-preview-7.8.5.html` and `preview/archive/turbo-preview-7.8.18.html`. Each has no direct reference and duplicates the preceding build except for `PREVIEW_BUILD`. They remain archived until approval is granted.

## Historical production bundle comparison (7.9.11 pointer change)

| Artifact | Before eager-glob cleanup | After explicit pointer | Reduction |
|---|---:|---:|---:|
| Main JavaScript (minified) | 15,016.96 kB | 1,002.60 kB | 14,014.36 kB (93.32%) |
| Main JavaScript (Vite gzip report) | 4,015.68 kB | 282.16 kB | 3,733.52 kB (92.97%) |

The post-change JavaScript contains one `preview.js loaded:` renderer marker. It contains 7.9.11 and none of the sampled historical identifiers 7.7.0, 7.8.0, 7.8.19, or 7.9.10.

## Historical validation record (7.9.11 pointer change)

- Live QA Studio iframe: `preview.js loaded: 7.9.11`; visible `#buildVersionTag`: `build 7.9.11`; bridge state: `ready`.
- Automated tests: 118 passed, 0 failed.
- TypeScript: passed.
- Lint: 0 errors, 11 warnings (existing image-optimization and unused-function findings; no new loader error).
- Production build: passed. Vite retained its standard chunk-size warning because the current 7.9.11 single-file renderer is still embedded.
- Runtime isolation: application code has no `import.meta.glob` and no `preview/archive` import.
- Current renderer integrity: `preview/turbo-preview-7.9.11.html` was not edited; SHA-256 after validation is `b49541bfc3c8beb0ae6f0dca438128453d3e3da63c90be543438f3a5292b0c3c`.

## Maintenance checklist

1. Ask the user to confirm the latest source; never infer it from filenames or an open browser.
2. Place the confirmed HTML directly in `preview/` and keep its declared build identity aligned.
3. Update `preview/current-preview.ts` and, for CTV/OTT patches, renderer health/version and structural tests.
4. Retain previous builds. Archive or delete only after the specific cleanup is approved; update direct historical readers and this inventory if locations change.
5. Verify pointer version, HTML `PREVIEW_BUILD`, QA Studio badge, renderer health build, tests, production build, and bundle size. Update the [consolidated CTV/OTT spec](CTV-OTT-Consolidated-Spec.md) when rendering behavior changes.

## 7.12.2

The 7.12.2 preview keeps reconstructed canvas tabs interactive and exposes the pointer cursor on the full tab target. Renderer behavior otherwise inherits 7.12.1. It is the user-confirmed source for 7.12.3.

## 7.12.3

Current QA Studio pointer and companion local service use 7.12.3. The embedded preview differs from 7.12.2 only by `PREVIEW_BUILD`. The host action now reads **Submit Feedback** and sends the in-memory debug ZIP to the local service, which performs authenticated upload to the configured Box folder. Prior builds are retained pending user review.


## 7.12.4

Current QA Studio pointer and companion local service use 7.12.4. The embedded preview inherits 7.12.3; the host map adapter uses Mapbox.js 3.3.1 (Leaflet), Mapbox Streets v11 512px raster tiles with `zoomOffset: -1` at map zoom 12 (tile URL zoom 11), production-sized popup geometry and popup-pane stacking above markers. The requested visible popup pointer attaches flush to the bottom-left corner and aligns above the pin using its rendered height. Previous builds are retained.

## 7.12.5

Adds manual gallery navigation through authored left/right or previous/next arrow groups within the selected tab gallery. Arrow activation changes the selected slide across included artboards, wraps at either end, and animates the incoming slide with a brief directional offset. The transition respects reduced-motion preferences. Autoplay and circular progress behavior remain outside this change. The 7.12.4 build is retained as the rollback point.

The current build's transition follow-up uses a 500ms ease-out motion to match the production gallery's short horizontal slide feel. The change remains in 7.12.5 as requested; no new build number was created.

The arrow contract is shared across the supported direct-slide gallery families (`rmGallery`, `colorPickerGallery`, `hotspotGallery`, and `staticProductGallery`). Other arrow-bearing component families remain static until their component-specific state models are verified; they are not routed through the global gallery slide state.

## 7.13.6

Current pointer: `preview/turbo-preview-7.13.6.html`. slideProgress and its progressBar/circularBar groups require explicit enabled visibility, overriding their dot marker (D083). Other controls retain existing visibility rules. 7.13.5 is retained unchanged.

7.13.6 follow-up (D084): circularBar rendering now reads authored stroke styling and no-effects icon bounds. Validated against 19 sample archives and the live loaded artboard; no creative-specific runtime overrides.

## 7.15.5

Based on 7.15.4; adds creative-wide combined video budget (500 MB), ZIP upload limit (600 MB), all-video duration validation and AdEx escalation guidance. Embedded rendering behavior is unchanged. Companion CTV/OTT renderer validation updated; its historical HTML profile is retained.
