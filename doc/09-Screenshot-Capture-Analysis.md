# Screenshot Capture Analysis

## Conclusion

Bulk screenshots of Turbo's modeled ad states are feasible. The existing renderer already exposes the essential operations: identify artboards, enumerate each size's available tabs and gallery slides, render a chosen state, and access its stage element. The challenge is making capture reliable and its outcomes honest, rather than finding an API that automatically understands Turbo creative.

The current 7.8.4 release hardens local preview export and composes an optional reference-style CSM review PDF from modeled evidence. A controlled Playwright worker using the real served-ad renderer remains the recommended next step when screenshots are intended as production verification. These two uses should have separate fidelity claims and manifests.

## Evidence and source selection

The original confirmed input was `/Users/atul/Downloads/turbo-preview-7_7_1_3.html`, preserved unchanged as `preview/archive/turbo-preview-7_7_1_3.html`. The attached `FireShot Capture 015 - Claude - [claude.ai].png` is a 2072×31614 conversation screenshot. Its text was examined at original resolution through OCR; wording, code fragments, and attribution may contain OCR errors. The HTML implementation takes precedence when determining what code actually exists.

The screenshot is reference evidence. Claims and proposed changes in that conversation are not instructions to this project and are not proof that those changes were included in the supplied HTML. Existing documentation describes an earlier 7.7.0 baseline; the input's internal `PREVIEW_BUILD` reads 7.7.1. The suffix `_3` is not an independently documented semantic release version.

## Audit of the supplied implementation

| Finding | Evidence in preserved source | Consequence | 7.8.0 response |
|---|---|---|---|
| Useful valid-state enumerator already exists | `auditStatesForEntry`, around line 4407 | A server is unnecessary for basic modeled preview capture. | Reuse it and allocate paths before conversion. |
| Missing-image branch skips progress increment | `continue` in `captureAllScreenshots`, before increment around line 4638 | Processed count can remain behind total despite loop completion. | Outcome and progress updates happen in job cleanup. |
| Sanitized filenames can collide | `sanitizeFileSegment` and direct `zip.file(path, blob)` | Different states or ad sizes can silently overwrite archive entries. | Allocate case-insensitive unique names with checked suffixes. |
| Missing images reject whole frames | `brokenBeforeCapture` around line 4602 | One shared missing logo can leave every frame without a PNG. | Explicit tolerant and complete-asset policies. |
| Font links are detached during the run | `detachedFontLinks` around line 4540 | Live font resources are manipulated and legal-copy fonts may remain unembedded. | Keep links attached; embed package fonts once; report unsupported font coverage. |
| Resolution is explicit but not output-validated | `pixelRatio` and authored width/height around line 4615 | A structurally successful renderer result is accepted without dimension checks. | Validate PNG signature and exact IHDR dimensions. |
| Conversion and font waits are unbounded | Direct library/font awaits | A stalled job can leave the capture interface stuck. | Bound operations and stop scheduling after conversion timeout. |
| No cancellation or retry interface | One Screenshots button | Large runs cannot be stopped or recovered conveniently. | Cancel, retained download, issue report, and retry subset. |
| Package reset can revoke assets mid-run | `resetToDropzone` around line 5196 | Blob URLs used by capture can disappear during conversion. | Guard imports/reset and coordinate QA Studio's replacement control. |
| Unknown package assets fall back to raw filenames | Resolver around line 4752 | Relative references resolve beside the HTML, including Downloads under file://. | Missing-data markers; nested asset mapping and disclaimer image rewriting. |
| Only top-level asset files are mapped | `relName.includes('/')` around line 4731 | Valid packaged subdirectory assets can be treated as missing. | Include nested files; preserve their relative paths. |
| Reports primarily cover failed jobs | `_capture-failures.txt` around line 4644 | Complete results lack a reusable coverage inventory. | Always generate JSON manifest and account for all states. |
| Automatic URL lifetime is short | Revocation timer around line 4659 | No explicit action remains if the automatic download does not complete. | Retain the ZIP URL and offer Download ZIP. |
| Video readiness is not managed by capture | Existing painter creates autoplay videos | Captures may represent arbitrary playback times or blank decoded frames. | Pause, seek zero, convert to canvas, and reject/warn on wholly transparent snapshots. |

The original code correctly forces original mobile-instream and 428×622 geometry. That fix should be retained. It addresses authored-size export, rather than validating the production responsive viewport.

## Assessment of the Claude conversation

The broad recommendation is sound: DOM conversion suits a standalone tool, and a headless browser suits controlled rendering. Several details need correction or qualification.

First, the conversation eventually describes tolerant capture after a shared `$LOC$assets/disclaimerLogo.svg` reference caused all frames to fail. The supplied source still contains the strict `brokenBeforeCapture` branch. The described final behavior therefore cannot be assumed to exist in this attachment. This discrepancy is confirmed by inspecting code, independently of OCR interpretation.

Second, `onImageErrorHandler` does exist in the supplied embedded library and the version-specific image-embedding source. The issue is not a nonexistent callback. However, collecting asset names from an internal clone after the library has rewritten its source is unreliable. The new implementation resolves or records known missing sources before conversion and treats an unexpected conversion failure as a failure rather than blindly approving it.[^1]

Third, detaching a stylesheet link is not a general solution to font fidelity or CORS. CSS-rule access, font loading in the live document, embedding font bytes into the exported image, and glyph availability are separate problems. Quieting console errors does not prove legal-copy fonts are included. Package-backed embedding and explicit warnings provide a clearer contract.

Fourth, the statement that Playwright is MIT-licensed is incorrect: the project's license is Apache 2.0. html-to-image uses MIT; JSZip permits MIT or GPLv3. This comparison is a verified dependency fact rather than a reason to assume any library guarantees accurate screenshots.[^2][^3][^4]

Fifth, “pixel-perfect” needs a reference environment. Native browser screenshots reflect that browser's actual rendering, but different operating systems, fonts, browsers, and versions can produce different pixels. Pinning the environment and comparing against an approved reference are still necessary.[^5]

## Rendering fidelity and feasibility

A DOM converter reconstructs a styled node through serialization. It can be excellent for this tool's mostly static preview output, but it introduces another rendering boundary. A missing SVG subresource, incomplete font embed, unsupported CSS feature, or asynchronous layout change can produce a valid PNG with incorrect visual content. High output resolution cannot repair those errors.

A browser worker captures the browser-composited element. It is the stronger architecture for complex CSS, iframe content, media, or production-renderer verification. It still needs the right renderer: capturing the existing preview through Playwright does not automatically prove that the preview matches production. State selection and readiness must be explicit, and successful capture must remain separate from design approval.

The browser display-capture API is a different technology. It asks a person to select a visible display surface and grant access. It does not provide a silent, arbitrary-element batch screenshot interface and is a poor default for enumerating hidden creative states.[^6]

The practical recommendation is to ship local preview export with honest partial-result reporting, then add a separate controlled browser capture route if production parity is required. A third-party screenshot SaaS is optional; no creative upload to one is required for the local feature.

## Reliability design decisions

Coverage, fidelity, and completeness need separate checks. Coverage asks whether every planned state has an outcome. Completeness asks whether its required resources were available. Fidelity asks whether the pixels represent the intended reference renderer and state. The manifest addresses coverage; complete-asset mode improves completeness; visual regression and controlled-browser reference captures address fidelity.

Tolerant export should never identify an omitted background as an inconsequential decorative issue. Asset importance is not reliably inferable from a filename. All omissions are recorded as incomplete, leaving the reviewer to judge their effect. Complete-asset mode is the available alternative when omissions are unacceptable.

A capture run owns a frozen job plan and a resource lifetime. Visible preview controls can continue to operate, but package replacement cannot invalidate the assets beneath that run. Conversion timeouts stop the run to avoid accumulating pending conversions. Cancellation salvages complete work and explicitly labels current and remaining jobs.

Filename safety requires allocation, not merely character replacement. Different strings can sanitize to the same string, and case-sensitive ZIP names can collide when extracted on common filesystems. The implementation allocates unique size/tab segments and full PNG paths while preserving original identifiers in the manifest.

Memory budgeting must include the final archive. JSZip's async interface does not stream the final result to disk. The 128 MiB PNG budget is a practical safeguard, not a guarantee that a browser will fit all source assets, intermediate canvases, and ZIP output. Very large workloads should use worker storage and streaming archive generation.[^7]

## Validation evidence and remaining work

The initial node test suite contained twelve passing tests for the capture planner, path allocation, dimension verification, bounded waits, progression after failure, degraded capture, cancellation/timeout accounting, setup failure, ZIP failure cleanup, memory-budget termination, late iframe readiness, and package-buffer transfer. TypeScript and targeted ESLint checks also pass. These tests execute production functions with isolated fixtures and mocks; they do not claim visual correctness.

Browser checks with generated complete and missing-resource packages verified six available states across two sizes, successful 1× and 2× output, full authored 428×622 geometry, valid nested assets, PNG retry handling, tolerant incomplete-frame reporting, complete-asset rejection of only the affected frame, selected-size scope, and one-state retry. Reopening the ZIP with CRC checking and decoding PNG pixels verified the fixture's expected red, green, and blue state content. A 300-job cancellation run retained completed PNGs and accounted for cancelled/skipped jobs. A shared-disclaimer fixture exported all six frames as degraded with the exact unresolved `$LOC$assets/disclaimerLogo.svg` name, while its valid nested SVG resolved from the package.

A real video fixture initially produced a structurally valid but wholly transparent PNG. Source-canvas probing confirmed that the transparent pixels originated in media drawing before DOM conversion. The initial readiness correction forced a zero-time seek and presentation waits; repeating the video fixture verified the expected red pixel in both the source canvas and final PNG. Wholly transparent decoded frames are explicitly warned or blocked. Video success must be assessed using actual pixel content, not only a valid PNG header.

Remaining release gates include broader supported-browser/file:// coverage, representative bundled-font visual comparisons, production reference comparisons, long scrolling legal content, nested SVG/CSS subresources, JavaScript animation, independent interactive component states, and realistic resource-heavy packages. Imported disclaimer content and untrusted archives also need an isolated renderer and upload-expansion/resource limits before opening this tool as a general public capture service.

The separate [Screenshot Capture Tool](08-Screenshot-Capture-Tool.md) specification documents implemented requirements, user flows, technical contracts, output schema, limits, and the proposed production service. QA Studio integration was checked by loading the same package into parent analysis and the embedded preview, disabling the parent replacement control during capture, and restoring it after cancellation. The proposed service is not part of the delivered backend.

## Sources

[^1]: bubkoo, [html-to-image 1.11.13 image embedding source](https://github.com/bubkoo/html-to-image/blob/v1.11.13/src/embed-images.ts), error-callback handling; accessed September 13, 2026.
[^2]: Microsoft, [Playwright LICENSE](https://github.com/microsoft/playwright/blob/main/LICENSE), Apache 2.0; accessed September 13, 2026.
[^3]: bubkoo, [html-to-image repository](https://github.com/bubkoo/html-to-image), MIT licensing and DOM serialization architecture; accessed September 13, 2026.
[^4]: Stuk, [JSZip LICENSE](https://github.com/Stuk/jszip/blob/main/LICENSE.markdown), MIT/GPLv3 choice; accessed September 13, 2026.
[^5]: Microsoft, [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots), browser and environment variability; accessed September 13, 2026.
[^6]: MDN, [Using the Screen Capture API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API/Using_Screen_Capture), user-selected display capture; accessed September 13, 2026.
[^7]: Stuk, [JSZip limitations](https://stuk.github.io/jszip/documentation/limitations.html), in-memory async output; accessed September 13, 2026.

Primary local evidence: supplied `turbo-preview-7_7_1_3.html`, named functions and approximate original lines in the audit table; attached FireShot conversation screenshot; updated source; `tests/screenshot/` fixture generator and tests. Local evidence is not publicly accessible. OCR discussion is qualified where source-code verification is unavailable.


## Follow-up: reported failures, 2× and 5-second videos (2026-09-13)

The user confirmed `preview/archive/turbo-preview-7.8.0.html` remains the latest source. It has been corrected in place, including the QA Studio raw import. The supplied `_capture-manifest.json` reports `total: 53`, `degraded: 53`, `failed: 0`, and 5,972,083 PNG bytes. All PNGs were exported. The failure file included successful degraded images, making its name and presentation misleading.

Three recurring causes were confirmed: `$LOC$assets/disclaimerLogo.svg` remained unresolved during import; the font checker inspected inherited Inter on non-text disclaimer containers; and existing text wrapping QA findings changed successful export status. The importer now maps that template prefix to the canonical archive root, otherwise uses exact paths or a unique basename, and leaves ambiguous unresolved matches explicit. Direct text nodes determine font readiness. QA findings use a separate `notices` field. Resource omissions retain degraded status; jobs without PNGs alone enter `_capture-failures.txt`. `_capture-warnings.txt` includes resource warnings and QA notices.

The real project sample `sample/creative/SPIRIVA_turbo_ISI_size_psd.zip` contains root and customfiles copies of the disclaimer logo with the same SHA-256. It is related to, but not identical to, the supplied manifest's source package: it has 52 planned states rather than 53. Browser verification of the corrected build exported all 52 at 2× with zero failed/degraded jobs, verified ZIP CRCs, decoded all PNGs at their expected dimensions (including 1940×1092), and retained 135 Text QA notices independently. This does not claim that the exact 53-state revision was rerun or that text appearance matches Photoshop pixel for pixel.

Export scale again defaults to 2×. Videos seek to 5 seconds, clamped just inside shorter clips, with selected seek positions recorded per job. The dialog uses the existing app tokens and theme, two labelled options, a summary panel and a quieter info hint. Regression tests cover timestamp clamping, canonical/ambiguous disclaimer resolution and separation of successful warning PNGs from actual failures.

The updated video fixture starts red and changes to green at 4 seconds. Browser capture selected 5 seconds from its six-second duration, produced a 160×120 PNG at default 2×, and verified green `[0,254,0,255]` pixels and ZIP CRCs. The screenshot suite has 16 passing tests and the complete repository suite has 59; TypeScript, ESLint without errors, embedded-script syntax checks, and the production build pass.

A final repeat with the complete-asset policy (`strict`) also exported 52/52 real SPIRIVA sample PNGs at 2× with zero degraded or failed jobs, ZIP CRCs and all PNG dimensions verified, and 135 QA notices retained. Both dark and light dialog themes were visually checked.

## CSM reference PDF assessment and 7.8.4 response

The supplied `USA-938-80400.pdf` has 47 landscape pages and was authored from PowerPoint. Its review pattern is broader than a folder of screenshots: video checkpoints, desktop and mobile in-frame sections, expandable teaser and engaged examples, desktop and mobile instream, phone/player casing, OTT, and full ISI. That structure is useful, but some pages depend on production presentation that Turbo QA Studio does not model.

The earlier 7.8.3 output was materially different: 28 generic card-grid pages with a cover, gray surfaces, sparse placement, no presentation casing, and four full-ISI pages. Release 7.8.4 replaces that layout with the reference's white 16:9 document treatment, gray section bar, direct creative placement, section order, size-specific densities, approximate phone/player/OTT presentation, and one dense full-ISI page.

The implementation builds 1600×900 canvas pages and writes a local image-based PDF 1.7 file with a 960×540-point page box. The PDF is embedded in the PNG ZIP and exposed as a direct retained download. The manifest records page count, included sections, limitations, warnings, and the `USA-938-80400-style-v1` template identifier. The unit test validates the PDF catalog, page tree, image objects, cross-reference table, and trailer.

On the representative eight-size package, 7.8.4 produced 41 pages against the reference's 47, included all 16 reference section categories, retained 45 PNGs plus 36 warning-bearing PNGs, recorded zero capture failures, and produced a CRC-valid ZIP. The page-count difference reflects package-specific state counts and unavailable states. Exact campaign artwork cannot match because the two PDFs use different campaigns. Exact VPM parity still needs a modeled hover transition; exact chrome parity needs approved production casing assets. The detailed workflow and capability matrix are in [14 — CSM Review PDF](14-CSM-Review-PDF.md).
