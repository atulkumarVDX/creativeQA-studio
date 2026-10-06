# Screenshot Capture Tool

## Purpose and release scope

The screenshot tool turns a Turbo export package into individually reviewable PNGs for every available ad size, tab, and gallery slide, then delivers those PNGs in one ZIP. It can also create a landscape CSM review PDF from the same evidence. It removes the repetitive work of selecting a state, capturing it, naming the image, sorting it, and assembling basic review pages.

The implemented release is `preview/turbo-preview-7.8.4.html`, also embedded by QA Studio through `app/page.tsx`. The user confirmed `preview/turbo-preview-7.8.3.html` as the latest source for this patch. The earlier supplied `turbo-preview-7_7_1_3.html` remains preserved unchanged in `preview/`. This document describes current screenshot functionality; historical specifications remain historical baselines.

Two deliverable types must be distinguished. A **preview capture** records the reconstructed Turbo creative rendered by this HTML tool. A **production capture** would record the actual served ad in a controlled browser. The current release implements preview capture. It does not establish that the Photoshop document, reconstructed preview, and served ad have identical pixels.

## Requirements

### Capture coverage and image output

| ID | Requirement | Release behavior |
|---|---|---|
| SC-01 | Automatically cover all available package sizes | All package sizes is the default scope. Hidden and ignored artboards remain excluded by the existing parser. |
| SC-02 | Allow capture of selected sizes | Selected preview sizes uses the current size selection; each selected size still exports all its available states. |
| SC-03 | Capture each tab and gallery slide individually | Jobs come from the size's own tab and slide model, rather than a global Cartesian product that invents unavailable states. |
| SC-04 | Handle non-gallery and non-tab creative | A tab without a gallery produces `tab/frame.png`; a size without tabs produces `size/frame.png`. |
| SC-05 | Export authored canvas dimensions | Capture forces the original mobile-instream and mobile-expandable geometry; viewport fitting is excluded. |
| SC-06 | Support explicit output resolution | 2× is the default, with 1× and 3× available. Output width and height equal authored dimensions multiplied by the selected ratio. |
| SC-07 | Produce individual PNGs | PNG is the only output format in this release. Transparency is retained where the rendered creative is transparent. |
| SC-08 | Deliver one structured ZIP | Each run produces one archive with per-size folders and a capture manifest. A retry is a separate subset archive. |
| SC-09 | Never silently overwrite output | Path allocation handles punctuation, case, reserved filenames, and collisions. Original names remain in the manifest. |
| SC-10 | Exclude preview interface elements | Capture targets the creative stage, excluding size labels, toolbars, fitting controls, and QA outlines. |

### Reliability and recovery

| ID | Requirement | Release behavior |
|---|---|---|
| SC-11 | Wait for resources and text layout | Image loading and decoding, PNG retries, used-font loading, font readiness, and scheduled measurement callbacks precede conversion. |
| SC-12 | Distinguish incomplete images from failed captures | Tolerant mode exports incomplete frames with warnings; complete-asset mode fails affected frames. |
| SC-13 | Account for every planned job | Each manifest job ends as captured, degraded, failed, cancelled, or skipped. |
| SC-14 | Continue after ordinary frame errors | A single conversion or resource error does not stop unrelated frames. |
| SC-15 | Bound expensive capture work | Resolution, frame-count, per-operation timeout, and accumulated PNG limits constrain a run. |
| SC-16 | Allow cancellation | Cancel stops accepting new frame results and creates a ZIP containing completed images and diagnostics. It does not automatically download a cancelled run. |
| SC-17 | Retain an explicit download action | Download ZIP remains available until the next run, package replacement, reset, or page unload. |
| SC-18 | Allow retry of affected states | Retry affected frames includes degraded, failed, cancelled, and skipped jobs from the previous run. |
| SC-19 | Preserve active preview | Capture uses temporary artboards and does not switch the visible tab, slide, fitting mode, or selected sizes. |
| SC-20 | Prevent package replacement during capture | Both the standalone import path and the QA Studio replacement control respect capture's busy state. |
| SC-21 | Verify output dimensions | A nonempty PNG and its IHDR dimensions are checked before it enters the ZIP. This is structural verification, not proof of visual correctness. |
| SC-22 | Make missing asset references understandable | Package-backed assets use Blob URLs. Missing references use a local invalid-data marker, preserving their name without requesting files beside the HTML. |

### Review PDF output

| ID | Requirement | Release behavior |
|---|---|---|
| SC-23 | Create a shareable review document | A checked-by-default option creates one 16:9 landscape PDF and adds it to the ZIP. |
| SC-24 | Preserve individual source evidence | The structured 2× PNGs remain the source deliverable; the PDF uses those successful captures as contact-sheet images. |
| SC-25 | Follow the CSM reference structure | Supported evidence is ordered as video, desktop in-frame, desktop expandable, desktop instream, mobile instream, mobile in-frame, mobile expandable, OTT, and full ISI. |
| SC-26 | Include video evidence | The PDF prefers `video1.mp4`, otherwise the first package MP4, and includes checkpoints at 5, 12, and 15 seconds, clamped inside shorter clips. |
| SC-27 | Include teaser evidence | Matching package pre-qualifier images are placed in desktop and mobile expandable teaser sections. |
| SC-28 | Include full ISI | Parsed disclaimer copy is dynamically typeset into one dense full-ISI page. |
| SC-29 | Represent production presentation honestly | Phone, browser, player, and OTT frames are document approximations; VPM transition and served-ad pixel parity remain explicit boundaries in the manifest. |
| SC-30 | Isolate PDF failure | If PDF composition fails, valid PNGs and diagnostics still produce a downloadable ZIP. |

### Explicit boundaries

“All component frames” means the gallery states recognized by the existing parser: rmGallery, colorPickerGallery, hotspotGallery, and staticProductGallery families, together with tabs and base creative. It does not mean every possible interaction of an arbitrary widget. Independent component combinations, expanded hotspot states, hover states, arbitrary responsive breakpoints, and video timelines need additional state adapters.

Only sizes actually present in the package are captured. The tool does not invent a 320×50 artboard by shrinking a 970×546 design. Resolution scaling also does not improve the underlying renderer's layout accuracy.

## User experience

### Normal capture

1. Open a Turbo ZIP in QA Studio and select Preview, or open the standalone HTML and choose a ZIP.
2. Inspect the package as usual. Select Screenshots @1x, @2x, or @3x in the preview toolbar.
3. Click Screenshots. A configuration dialog shows the available size count, frame count, resolution, and deliverables.
4. Choose All package sizes or Selected preview sizes. The latter exports all tabs and slides for the selected sizes, including states that are not currently visible.
5. Choose Capture incomplete frames with warnings or Require complete assets. The default favors review coverage while clearly reporting omissions.
6. Leave **Include review PDF** checked when a CSM review document is needed, then click **Create package**. The tool displays processed-job and captured-image counts, PDF preparation, and ZIP progress. Package replacement is disabled until the run finishes.
7. On completion, the browser is asked to download the ZIP. **Download ZIP** and **Review PDF** remain available if the automatic request is blocked or the PDF is needed separately.
8. Expand Capture report to inspect incomplete or failed states, PDF status, and reasons. The archive also contains machine-readable and, where needed, text diagnostics.

An 80×60 artboard with two slides under tab1 and no gallery under tab2 produces three images. A second size with the same states produces three more images. Selecting 2× makes the 80×60 PNGs 160×120; it does not combine the three states into one image.

### Missing assets and partial results

Tolerant mode replaces known broken image sources with a transparent image while retaining their layout boxes and existing missing-asset placeholder styling. An exported PNG with such a warning is **incomplete**, even when the rest of the frame looks correct. This policy applies equally to a missing disclaimer logo and a missing background: the tool does not guess whether an asset is decorative or essential.

Complete-asset mode fails a frame when its readiness checks produce warnings. Other frames continue. This policy is useful when incomplete outputs must not be mistaken for complete assets, but it does not guarantee production pixel parity.

A common package reference such as `$LOC$assets/disclaimerLogo.svg` is reported using that original name. The tool does not guess a locale or substitute a similarly named file. A real nested reference such as `assets/logo.svg` resolves against the package, including a disclaimer's archive directory.

The completion message reports captured, incomplete, failed, and not-captured counts separately. A ZIP containing only a diagnostic manifest is possible when setup fails or every frame is blocked. The result is not presented as a complete screenshot export.

### Cancellation and retry

Cancel capture requests an orderly stop. Already completed PNGs remain available in a cancelled-run ZIP; the current job becomes cancelled where applicable, and remaining jobs become skipped. Click Download ZIP to retrieve that result. ZIP assembly itself is not cancellable in this release.

Retry affected frames runs only the affected states and creates an archive with `-retry` in its name and `retrySubset: true` in its manifest. It does not merge those PNGs into the earlier ZIP. The current resolution selector applies to the retry. Starting any new run releases the previous in-memory download, so download a result before replacing it.

Retry may recover a transient decode or conversion failure. It cannot repair an asset absent from the source package. To repair package content, finish the run, load a corrected ZIP, and start a fresh capture.

### Accessibility and feedback

The settings dialog has a heading and native form controls. The browser provides modal focus handling and Escape dismissal. Capture progress uses a polite live status region. Issues use text and explicit statuses, so understanding a partial result does not depend on warning colors. Capture-only artboards are inert and hidden from assistive technology.

The status message describes work performed; “ZIP ready” means an archive is available in this browser session. It does not assert that the user saved it successfully to disk, which the application cannot reliably confirm from an anchor download.

## Technical architecture

### Technology choice

The standalone release retains the embedded html-to-image 1.11.13 and JSZip 3.10.1 libraries. html-to-image serializes a styled DOM clone through SVG foreignObject and rasterizes it; JSZip packages the generated PNGs. The capture orchestrator, state planner, readiness checks, path allocation, and reporting are application code. These are open-source JavaScript libraries, rather than a third-party screenshot API with guaranteed results.[^1][^2]

For controlled production captures, the recommended next architecture uses Playwright with a pinned Chromium browser and the actual production renderer. Playwright supports element screenshots; it does not automatically discover application states or know when the creative is ready. Those contracts still belong to the application.[^3]

| Approach | Suitable use | Main tradeoff |
|---|---|---|
| Embedded DOM conversion | Local review and offline package workflows | Rendering passes through SVG serialization and can differ from the visible browser result. |
| Controlled Playwright worker | Production verification, complex CSS, and browser-specific captures | Requires browser execution infrastructure and an explicit rendering/readiness contract. |
| Browser screen-sharing API | User-approved recording of a visible tab/window/screen | Interactive permission and surface selection make it unsuitable as the primary unattended bulk element exporter.[^4] |

No remote screenshot service is required for the implemented release. Creative assets remain in the browser session. The preview's existing Google Fonts stylesheets can still make network requests; offline operation requires the actual creative fonts and assets to be bundled.

### Processing pipeline

```text
ZIP package
  → existing Turbo parser and package asset map
  → capture scope selection
  → ordered valid-state job plan and unique output paths
  → preflight limits
  → package font embedding once per run
  → one temporary original-size artboard per job
  → select tab/slide, settle resources and text measurement
  → convert stage to PNG
  → verify PNG signature and dimensions
  → add successful/degraded PNG to ZIP; record every outcome
  → compose optional review pages from successful PNGs and package media
  → encode review pages as JPEG and assemble a PDF 1.7 document
  → manifest and issue report
  → ZIP assembly and retained download URL
```

`auditStatesForEntry()` is shared with the existing Text QA enumeration. `planCapture()` creates output paths before capture and assigns stable IDs within that run. A size has its own tab and slide list; unavailable combinations are not generated merely because another size has them.

Each job uses a shallow entry copy. `buildArtboardEl()` writes fresh DOM and render-state fields into that copy, with both original-mobile flags enabled. Shared model and lookup data are read by the existing painter. The temporary card is removed in a job-level finally block, including failure and cancellation paths.

### Resource readiness

The painter's PNG fallback matters: an initial missing `name.png` may be followed by a successful `name-2x.png`. Capture waits for the final image state, not just the first load/error event. Successful images are decoded before conversion. Known broken sources are replaced before the library clones them, so diagnostics retain their original names rather than inspecting an already modified internal clone.

The uploader now includes nested asset files in its package map. Disclaimer image URLs are rewritten to packaged Blob URLs before disclaimer rendering. Missing image references become `data:application/x-turbo-missing,...`, allowing existing missing-image behavior without a request against the document's filesystem folder. This also avoids Downloads-specific lookup errors under file://.

Package font CSS is embedded once per run by reading its Blob-backed resources and converting them to data URLs. Live font stylesheet links remain attached. The tool loads the font shorthands used by rendered creative text, awaits the font set, then allows scheduled measurement and clipping callbacks to run. html-to-image receives `fontEmbedCSS`, so it does not repeatedly walk unrelated UI stylesheets.[^1][^5]

Fonts not bundled for export are reported when the capture checks identify a nonstandard primary family. Platform fonts can still differ between machines. The current primary-family check is intentionally limited; it is not a complete glyph-by-glyph font coverage audit. Text QA measurement and unresolved layout findings produce separate notices, without blocking capture.

CSS background images receive local-resource checks and decoding checks. These checks do not constitute a complete scanner for every CSS resource, such as arbitrary mask, border-image, or nested SVG references. Such cases require regression fixtures or the production-browser route before claiming complete support.

### Video and motion policy

Video capture selects the frame at 5 seconds. Clips of 5 seconds or less use a seek target 1 ms before their duration (clamped to zero for extremely short clips). The temporary video's autoplay and looping are disabled, playback is paused, a seek to that target is performed, and presentation callbacks are allowed to settle before drawing into a canvas. No sequence of video timestamps is exported. The existing playlist's poster-second offset is not used. Each job records `videoFrames` with requested seconds, selected seconds, duration, source and whether the clip was shorter than the requested time; these are seek positions, not a guarantee of exact frame presentation timestamps.

Unreadable, unsupported, or wholly transparent video snapshots generate a warning in tolerant mode and block the frame in complete-asset mode. A PNG is not counted as a complete video capture simply because it is structurally valid. This distinction is necessary because browser media decoding can return a transparent canvas even after readiness events.

Capture-only CSS disables transitions, CSS animations, caret painting, and QA outlines. It does not freeze arbitrary JavaScript animation state. The production screenshot service needs an application-defined timestamp/freeze adapter for any such content.

### Output organization

```text
creative-screenshots@2x.zip
├── 80x60/
│   ├── tab1/
│   │   ├── slide1.png
│   │   └── slide2.png
│   └── tab2/frame.png
├── 428x622/...
├── _capture-manifest.json
├── _capture-failures.txt       # only failed, cancelled or skipped jobs
└── _capture-warnings.txt       # resource warnings and separate Text QA notices
```

Names are Unicode-normalized, stripped of path separators and control characters, protected against Windows reserved device names, and shortened to bounded segments. Case-insensitive and sanitization collisions receive deterministic `--2`, `--3`, and later suffixes. Allocation checks suffix collisions too. The manifest preserves original ad-size, tab, and slide values independently of the sanitized path.

The manifest uses `schemaVersion: 1`. It records preview build, renderer identifier, package label, start/end time, ratio, scope, policy, video policy, limits, overall status, counts, PNG bytes, and every job. Per-job fields include ID, original state names, intended ZIP path, expected pixel dimensions, status, warnings, error, and successful-image byte size and processing time where applicable. A path on a failed/skipped record is intended output, not an assertion that a PNG exists.

| Job status | PNG present? | Meaning |
|---|---|---|
| captured | Yes | Capture checks passed without recorded warnings. |
| degraded | Yes | Image exported with explicit resource warnings. Text QA notices are recorded independently and do not change capture success. |
| failed | No | Readiness, policy, conversion, validation, or budget check blocked that job. |
| cancelled | No | The current job was interrupted or its late result discarded. |
| skipped | No | Job was planned but never attempted. |

Overall statuses are complete, partial, cancelled, timeout, memory-limit, or setup-failed. For every run, the sum of job-status counts equals total planned jobs. `captured + degraded` equals PNG count. A ZIP-generation failure is reported in the interface; it can prevent delivery of the already prepared diagnostic report.

### Limits, cancellation, and cleanup

| Limit | Current value | Interpretation |
|---|---:|---|
| Jobs | 2,000 | Maximum states per run. |
| Output side | 8,192 pixels | Maximum width or height after applying resolution ratio. |
| Output area | 16,000,000 pixels | Maximum PNG canvas area. |
| Accumulated PNG bytes | 128 MiB | Stops before adding the PNG that would exceed the archive budget. |
| Operation wait | 20 seconds | Bounds resource waits and image conversion. |
| Concurrent conversions | 1 accepted job | Sequential processing limits temporary render/canvas overlap. |

These values are application budgets, not universal browser guarantees. Assets already loaded by the preview, font embedding, canvas buffers, reports, and the final ZIP consume additional memory. JSZip's asynchronous generation retains the complete output in memory; setting STORE avoids recompressing PNGs but does not make archive generation a streaming-to-disk operation.[^2]

The capture library cannot be forcibly aborted. The orchestrator stops awaiting a cancelled conversion, discards its late result, removes the temporary stage, and stops scheduling jobs. A conversion timeout ends the run rather than continuing to schedule conversions behind a hung operation. A very expensive synchronous renderer section may still delay the interface and cancellation.

Each job cleans up temporary video sources and DOM. A new capture, reset, or package replacement releases the previous ZIP download URL. Package Blob URLs retain their existing preview lifecycle. A persistent explicit download avoids relying on a short URL-revocation timer.

### QA Studio integration

The app embeds 7.8.4 through its existing raw HTML import and srcdoc bridge. Existing Promise-fallback compatibility handling remains in place. Package buffers are transferred by message, with the File and input-change event constructed inside the iframe to avoid foreign-realm event dispatch. A ready/ping handshake covers an iframe that finishes loading before the parent registers its listener. The source dispatches `csm:capture-state` with `{ busy: true/false }` and sets `document.documentElement.dataset.captureBusy`.

The bridge forwards that state using the current preview token. The parent uses the existing preview-token bridge and the busy state to disable its file picker and Replace package button. The import handler also checks busy state, covering an event arriving before the React interface updates. Capture is available inside the Preview toolbar, rather than being a separate server feature.

## Validation and release gates

The automated test file is `tests/screenshot/capture.test.mjs`. It covers available-state planning, collision allocation, PNG structural/dimension checks, timeout/cancellation behavior, progress after failure, degraded output, skipped-job accounting, font setup failure, ZIP failure cleanup, and PNG memory budgets.

`create-fixtures.py` creates small complete, missing-image, cancellation, shared-disclaimer, and optional video packages. The browser harness reopens the produced ZIP with CRC checking, decodes successful PNGs, checks dimensions, and samples known fixture pixels. Its generated HTML is test-only and is not the source embedded by QA Studio.

Run checks from the repository root:

```sh
node --test tests/screenshot/capture.test.mjs
python3 tests/screenshot/create-fixtures.py
node tests/screenshot/create-browser-harness.mjs
```

The node tests use the installed workspace's Babel parser to extract the production functions. The video fixture additionally uses FFmpeg when installed. Serve the repository locally, open `tests/screenshot/browser-harness.html`, and load the generated packages through the regular file picker. Machine-readable ZIP diagnostics appear in `#captureTestDiagnostics` after an export.

Before a broad release, repeat the checks on supported Chrome, Firefox, and Safari versions, including file:// and the QA Studio iframe. Add representative bundled-font, long-disclaimer, missing-background, nested SVG, masked-image, mobile-instream, and realistic high-frame-count fixtures. Compare decoded screenshot pixels with a native browser screenshot and an approved production reference. Do not use successful PNG decoding alone as the fidelity criterion.

## Production-browser capture specification

The following architecture is recommended additional work, not implemented backend functionality.

A capture worker should load an approved renderer build in an isolated Playwright browser context, receive a versioned job plan, set a known viewport/device scale, and ask an explicit application adapter to render each state. That adapter must resolve only the supplied package's resources, apply the selected timestamp, and return readiness results including font/image/text failures. Screenshot the creative-stage element only after readiness succeeds.

The browser engine, browser version, renderer commit, operating-system image, fonts, device ratio, viewport, locale, timezone, motion policy, and media timestamp belong in the manifest. A native browser screenshot is more faithful to that controlled browser, but cross-platform and cross-engine pixel differences still exist.[^6]

Suggested service contracts:

| Operation | Input | Output |
|---|---|---|
| Create capture | Package ID/hash, renderer version, scope, ratio, resource policy, state/timestamp policy | Capture ID and immutable planned jobs. |
| Read progress | Capture ID | State, completed/total counts, outcome counts, current job. |
| Cancel | Capture ID | Cancellation accepted; completed artifacts retained by policy. |
| Retry subset | Capture ID and affected job IDs | New child capture ID with parent relationship. |
| Download | Capture ID | Authenticated ZIP stream or short-lived authorized download. |

Workers should write PNGs to temporary storage or object storage as jobs complete and stream the final ZIP, rather than retaining the whole image set in memory. Put imported disclaimer HTML and SVG into an isolated rendering boundary; prevent scripts or event handlers from gaining access to the app. Limit uploaded ZIP expansion, layer/job counts, browser runtime, and resource fetches. Avoid a public arbitrary-URL screenshot endpoint; an approved renderer and package identifier provide a narrower and more predictable contract.

Acceptance for that service should include deterministic state selection, exact output dimensions, complete job accounting, process-level timeout/cancellation, repeatable captures in a pinned environment, bounded storage, authenticated downloads, and retention cleanup. If production rendering uses a responsive 375px viewport for an authored 428px design, expose **production viewport** and **authored canvas** as separate choices with explicit manifest dimensions; do not silently substitute one for the other.

## Sources

[^1]: bubkoo, [html-to-image README](https://github.com/bubkoo/html-to-image), API options and rendering pipeline; accessed September 13, 2026. Version-specific implementation is also checked against the supplied embedded 1.11.13 bundle.
[^2]: Stuk, [JSZip limitations](https://stuk.github.io/jszip/documentation/limitations.html), memory and generation behavior; accessed September 13, 2026.
[^3]: Microsoft, [Playwright screenshots](https://playwright.dev/docs/screenshots), element and buffer capture; accessed September 13, 2026.
[^4]: MDN, [MediaDevices.getDisplayMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia), interactive display capture requirements; accessed September 13, 2026.
[^5]: MDN, [FontFaceSet.load](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load), explicit font loading; accessed September 13, 2026.
[^6]: Microsoft, [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots), environmental screenshot differences; accessed September 13, 2026.


## Capture reliability correction — 2026-09-13

The supplied 7.8.0 manifest exported all 53 PNGs, with zero failed captures, but all 53 were marked degraded. The previous `_capture-failures.txt` also included those successful PNGs, which obscured coverage. Failures now mean no PNG; warnings and QA notices use a separate `_capture-warnings.txt`. The manifest retains backward-compatible job statuses and adds `notices` and `videoFrames` to attempted jobs.

Disclaimer image resolution recognizes `$LOC$assets/` as a publishing template prefix mapped to canonical archive-root resources, preferring exact paths before a unique basename fallback. Ambiguous fallback matches remain unresolved. The same resolution runs during import for Preview and capture. Font readiness examines direct text nodes, excluding containers that inherit UI fonts but render no text in them. Actual missing fonts still produce warnings. Text QA measurement and wrapping findings remain visible in the manifest as notices; they neither skip PNG conversion nor fail complete-asset mode. These changes preserve diagnostics rather than silently hiding missing assets.

The capture dialog follows the existing theme, fonts, accent, borders and button styles. It presents two labelled choices, a compact size/frame/resolution summary, an info hint explaining video timing and authored geometry, and Cancel/Capture ZIP actions. Initial export scale is 2×; users can explicitly choose 1× or 3× in the toolbar.

Browser verification of a six-second red-to-green video confirmed a selected seek position of 5 seconds and green `[0,254,0,255]` pixels in the final 160×120 PNG at default 2×. ZIP CRC verification passed. This verifies the timestamp rather than accepting any decodable frame.
