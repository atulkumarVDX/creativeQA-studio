# CSM Review PDF

**Release:** Turbo Preview 7.8.4  
**Source:** `preview/archive/turbo-preview-7.8.4.html`
**Last updated:** 2026-09-22

## Purpose

The review PDF turns one screenshot run into a CSM-ready document without manual image placement. Release 7.8.4 was rebuilt through direct comparison with the supplied 47-page `USA-938-80400.pdf` reference. It follows that document's page size, section order, compact section headers, direct creative placement, page density, device/player presentation, and single-page full ISI treatment.

The reference and test package belong to different campaigns, so their artwork and state counts cannot be identical. The target is document-template parity using the evidence available in the loaded package. The structured 2× PNGs remain the detailed source record, and the PDF remains a review document rather than proof of served-ad pixel parity.

## Reference comparison

| Property | Reference | 7.8.3 output | 7.8.4 output |
|---|---:|---:|---:|
| Pages in evaluated package | 47 | 28 | 41 |
| PDF page box | 959.76×540 pt | 960×540 pt | 960×540 pt |
| Opening page | Video frames | Generated cover | Video frames |
| Page treatment | White with compact gray header | Generic gray cards | White with compact gray header |
| Creative placement | Direct, size-specific | Uniform contact-sheet cards | Direct, size-specific |
| Section categories | 16 | Partial generic grouping | All 16 categories represented when evidence exists |
| Mobile/player/OTT presentation | Present | Absent | Approximate document frames |
| Full ISI | One dense page | Four pages | One dense page |

The 41-page result is 87% of the reference page count. Page count alone is not the fidelity score because it varies with campaign states. The more important match is the document grammar: section names and order, page geometry, spacing, density, casing treatment, and disclaimer presentation.

## Coverage matrix

| Reference content | 7.8.4 behavior | Coverage |
|---|---|---|
| Video frames | Captures at 5, 12, and 15 seconds; short clips clamp inside their duration | Replicated when video exists |
| Desktop in-frame | Uses reference-specific layouts for 970×250, 300×250, 300×600, 160×600, and 728×90 | Replicated from verified PNGs |
| Desktop expandable teasers | Places available `preQual_<size>.png` assets on one mixed-size page | Replicated when assets exist |
| Desktop expandable engaged | Uses representative modeled endpoints across desktop sizes | Replicated endpoint evidence |
| Desktop instream | Places 970×546 captures in a player-style frame | Approximate presentation |
| Mobile instream | Places modeled `mobile-instream` captures in phone/browser frames | Conditional on package state |
| Mobile in-frame | Places 300×600 and 300×250 captures in phone/browser frames | Replicated with approximate casing |
| Mobile expandable teasers | Places available mobile teaser assets in phone/browser frames | Replicated when assets exist |
| Mobile expandable engaged | Uses modeled 428×622 endpoints in phone/browser frames | Conditional on package state |
| OTT | Uses package-video checkpoints in an OTT-style frame | Approximate presentation |
| Full ISI | Typesets parsed `disclaimer.html` into one dense page | Replicated as document text |
| VPM hover transition | No transition state exists in the preview model | Not replicated; endpoints remain separate |
| Served-ad chrome and pixels | Frames are drawn by the PDF composer around preview evidence | Production parity not claimed |

## User experience

1. Load a Turbo ZIP and open Preview.
2. Keep the screenshot scale at the default 2× unless a different source resolution is required.
3. Choose **Screenshots**.
4. Select all package sizes or the current selection, then choose the missing-asset policy.
5. Leave **Include CSM review PDF** selected.
6. Review the summary and choose **Create package**.
7. Follow capture, PDF preparation, and ZIP progress in the same dialog.
8. Use **Download ZIP** for the evidence package or **Review PDF** for the document alone.
9. Inspect warnings before sharing a partial result.

The ZIP contains the PDF at its root, PNGs under `ad-size/tab/slide.png`, `_capture-manifest.json`, and diagnostic text files when warnings or failures exist.

## Document flow

Sections follow the reference order and are omitted when the package provides no corresponding evidence:

1. Video frames.
2. Desktop in-frame: 970×250, 300×250, 300×600, 160×600, and 728×90.
3. Desktop expandable: all teasers, then engaged endpoints.
4. Desktop instream.
5. Mobile instream.
6. Mobile in-frame: 300×600 and 300×250.
7. Mobile expandable: all teasers, then engaged endpoints.
8. OTT.
9. Full ISI.

Each page is a 1600×900 canvas encoded into a 960×540-point PDF page. A light-gray header strip carries the uppercase section name and `vdx.tv` mark. Main-unit pages use successful capture PNGs. Teaser pages use package assets. Video and OTT pages use decoded package-video frames. The full-ISI page uses parsed disclaimer text.

## Technical behavior

- The PDF is generated locally in the browser with no upload or server dependency.
- Video decoding prefers `video1.mp4`, then falls back to the first package MP4.
- The first checkpoint uses 5 seconds, followed by 12 and 15 seconds; this avoids the blank intro sample and follows the screenshot policy.
- Captured PNGs retain their aspect ratio; section-specific grids control density and placement.
- Phone, browser, player, and OTT frames are Canvas drawings around source evidence and are identified as approximations in the manifest.
- Full ISI tries one, two, then three columns and reduces type only as needed to keep the disclaimer on one page.
- Canvas pages are JPEG-encoded at 0.86 quality and written by the local PDF 1.7 writer.
- `_capture-manifest.json.reviewPdf` records status, filename, page count, sections, limitations, warnings, and template `USA-938-80400-style-v1`.
- A PDF-specific failure does not discard valid PNGs or prevent the diagnostic ZIP.

## Acceptance criteria

A release is acceptable when:

- screenshot output defaults to 2×;
- PDF pages use the reference page geometry and section header treatment;
- available sections follow the reference order;
- every main-unit image comes from a successfully verified PNG in the same run;
- video page labels identify the intended time ranges;
- the PDF is inside the ZIP and available through the direct download button;
- the manifest page count matches the PDF page tree;
- VPM and casing limitations remain explicit;
- a PDF-only failure leaves the PNG ZIP usable;
- the generated ZIP passes CRC verification and the PDF opens in a standards-compliant reader.

## Remaining inputs for closer production parity

The implementation can already reproduce the document style and supported state flow. These inputs would close the remaining gaps:

- a modeled or capturable VPM hover-transition state;
- approved production phone, browser, player, and OTT casing assets and placement rules;
- mobile-instream states for packages that do not export them;
- a same-campaign golden PDF for pixel-level layout comparison;
- confirmation of any campaign-specific section naming or video checkpoint rules.

## Validation evidence

The representative eight-size Turbo package produced 41 pages, all 16 reference section categories, a 960×540-point page box, 45 clean captures, 36 warning-bearing captures, zero failed captures, and a CRC-valid ZIP. The generated PDF signature and its 41 page objects matched the manifest. Visual inspection confirmed the white page, compact gray header, direct creative layouts, device/player/OTT presentation, and one-page full ISI treatment.

Automated checks cover PDF catalog, page tree, JPEG image objects, cross-reference table, trailer, bridge version, screenshot outcomes, cancellation, partial results, and ZIP failure recovery. Browser fixtures verify PNG dimensions, sampled pixels, ZIP CRCs, embedded PDF signature, and page count.
