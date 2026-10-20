# Asset handling contract — Turbo Preview 7.8.1

> **Scope:** This is a historical ordinary-layer asset-resolution contract for the embedded main-unit preview. Current CTV/OTT video rendering uses its own ZIP/`export.json` asset contract, documented in [CTV/OTT Consolidated Spec](CTV-OTT-Consolidated-Spec.md); do not apply the ordinary-layer fallback table below as a guarantee for CTV/OTT footage or QR assets.

**Status:** Current-preview contract with evidence boundaries  
**Applies to:** `preview/archive/turbo-preview-7.8.1.html`
**Last reviewed:** 2026-09-15

## 1. Purpose

This document defines how Turbo Preview 7.8.1 identifies and resolves assets
inside an uploaded export ZIP. It keeps Photoshop layer annotations, generated
filenames and runtime fallback behavior separate. A naming observation is not
treated as an asset lookup rule unless production/export evidence establishes
that relationship.

This contract describes preview behavior. It does not change PSD layers,
rename packaged files, generate missing files or establish a new Photoshop
authoring rule.

## 2. Terms that must remain distinct

| Term | Where it appears | Meaning in the available evidence | Preview treatment |
|---|---|---|---|
| ` 2xl` | Trailing PSD layer-name suffix | The matched LRP export removed this suffix from exported display names. | Name-normalization evidence only. It is not a runtime file fallback and is not equivalent to `2x`. Preserve the raw source name for audit. |
| ` 2x` | Trailing Photoshop/plugin layer annotation | The guideline describes a hidden, genuinely high-resolution Retina companion with the same base name. Plugin exclusion handling also recognizes this marker. | Keep separate from `2xl`. Do not turn it into a universal structural or filename rule. |
| `-2x.png` | Generated package filename | A Retina raster file produced for some layers even when the exported layer record requests the plain `.png` name. | Runtime fallback candidate after the exact `.png` filename is absent. |
| `customAssets` | `export.json` array | Explicit mapping from a source `layerID` to a packaged filename. Linked Smart Objects normally appear here. | First source of an asset filename for an ordinary rendered layer. |
| Linked Smart Object reference | `smartObject.fileReference` or `smartObject.link._path` | Older exporters can retain the authoring reference while omitting `customAssets`. | Legacy filename fallback only when `smartObject.linked === true`; discard the local directory and use its basename. |
| Generated layer asset | Package raster derived from a renderable layer | Default exported raster convention is `<layer name>-<layerID>.png`. | Used when no explicit custom/linked filename is available. |

The spaces and hyphen in these suffixes matter. `Picture 2xl`, `Picture 2x`
and `Picture-123-2x.png` describe three different things.

## 3. Package asset namespace

Turbo Preview locates `export.json` first and treats its containing directory
as the package root. Every non-directory ZIP entry below that root is indexed
by its relative path. Each entry is converted to a browser Blob URL; the
original machine path is never used as a runtime URL.

Lookup is exact and case-sensitive because the current index is a JavaScript
`Map`. A `customAssets.fileName` containing a subfolder can resolve when that
same relative path exists in the ZIP. No general path, case or URL-decoding
normalization is applied to ordinary layer assets.

ZIP entries are assigned MIME types from their extensions so browsers can load
linked raster/vector images, fonts and videos consistently. The current table
recognizes SVG, PNG, JPEG, GIF, WebP, AVIF, WOFF, WOFF2, TTF, OTF, MP4, WebM,
HTML, CSS and JSON. Other extensions use `application/octet-stream`.

## 4. Ordinary layer resolution

For a renderable non-text layer, Turbo Preview selects the requested filename
in this order:

1. Use the `customAssets` filename mapped to the layer's `layerID`.
2. If that mapping is absent and the layer is a linked Smart Object, use the
   basename of `smartObject.fileReference`, then `smartObject.link._path`.
3. Otherwise request the generated filename
   `<exported layer name>-<layerID>.png`.

It then resolves the requested file in this order:

1. Exact relative filename.
2. If the requested filename ends in `.png`, the same filename with
   `-2x` inserted before `.png`.
3. A missing-asset placeholder, with one console warning per requested name.

The fallback is availability-based. Turbo Preview does not inspect device
pixel ratio, PSD resolution metadata or image dimensions to choose between the
two files. When both exact and `-2x.png` files exist, the exact file wins.
There is no equivalent `2xl` runtime fallback.

### Resolution examples

| Requested name | Package contents | Result |
|---|---|---|
| `background-31082.png` | `background-31082-2x.png` only | Use `background-31082-2x.png`. |
| `logo.svg` | `logo.svg` | Use exact `logo.svg`; no PNG fallback applies. |
| `assets/logo.svg` from `customAssets` | `assets/logo.svg` | Use the exact subfolder path. |
| `/author/project/assets/logo.svg` from a legacy linked reference | `logo.svg` at package root | Discard the authoring directory and use `logo.svg`. |
| `photo-42.png` | neither filename | Report it once and show the missing-asset treatment. |

The first example is the confirmed SPIRIVA failure fixed in 7.8.1. Its visible
`button-clientLogo/background` requested `background-31082.png`, while the ZIP
contained only `background-31082-2x.png`.

## 5. Linked, embedded and generated Smart Objects

| Source condition | Filename source | Current behavior |
|---|---|---|
| Layer ID occurs in `customAssets` | `customAssets.fileName` | Treat as authoritative for ordinary image rendering and resolve within the package. |
| `smartObject.linked === true`, mapping absent | Basename from `fileReference` or `link._path` | Compatibility fallback for older exports. Turbo Preview never follows or fetches the original local path. |
| Smart Object is not marked linked and has no mapping | Generated `<name>-<layerID>.png` | The preview consumes the raster generated into the package; it does not decode the embedded Photoshop object itself. |
| Native text or a live-supported vector shape | No raster required | Render through the text/shape path; a missing PNG must not be inferred solely from its absence. |

The legacy linked-reference fallback intentionally keeps only a basename. It
therefore cannot locate a file stored only in a package subfolder unless the
exporter supplies that subfolder through `customAssets`. Supporting basename
search across ordinary package assets would require collision behavior that is
not established by current production evidence.

## 6. Container backgrounds

The evidenced `button-clientLogo/background` Smart Object is promoted from a
child image into CSS `background-image` on its owning container. The child is
then consumed rather than painted again. Its requested generated filename uses
the same exact-then-`-2x.png` package resolver.

This is the path that exposed the SPIRIVA bug: CSS backgrounds have no image
element `onerror` event, so the fallback must happen in the shared package
resolver. The current promotion is confirmed for the named logo structure. It
must not be generalized to every layer named `background` without matched
production conversion evidence.

An explicit `customAssets` filename is used for ordinary image rendering. Use
of that mapping for every future CSS-background component adapter is not yet
established and must be verified when such an adapter is added.

## 7. Fonts, disclaimer assets and other references

These paths have distinct resolution rules:

- **Fonts:** Font filenames declared in the parsed export must match the indexed
  package-relative filename exactly. The PNG Retina fallback does not apply.
- **Disclaimer HTML:** Relative image references are resolved against the
  disclaimer file's package directory. `$LOC$assets/` is mapped to the export
  root convention. If exact resolution fails, a unique matching basename is
  accepted; basename collisions remain unresolved. `srcset` is removed.
- **Data, feeds, CSS, media and actions:** The authoring contract requires
  references to remain package-scoped and tokens to be preserved. Structure QA
  does not yet implement universal resolution or execution for all of these
  reference types.

## 8. Validation and reporting boundary

Asset handling and Structure QA have different responsibilities:

- The renderer reports a missing requested asset through its missing treatment
  and console warning.
- LS-003 records the `2xl`/`2x` name distinction; it must not rewrite raw names.
- LS-012 describes package-scoped asset, feed and action validation, but full
  reference validation is still advisory and not universally implemented.
- Absence of a raster PNG is not an issue for native text, supported live vector
  shapes or configuration-marker layers that are not supposed to rasterize.
- Successful `-2x.png` fallback is a resolved asset, not a structural finding.

## 9. Confirmed behavior and open evidence

Confirmed by the current source and regression coverage:

- exact package-relative lookup precedes `-2x.png` fallback;
- PNG fallback works for both image elements and CSS backgrounds using the
  shared resolver;
- `customAssets` is keyed by layer ID;
- legacy linked references never use the original local directory;
- extension-derived MIME typing includes linked SVG assets;
- the SPIRIVA Retina-only generated logo resolves through the fallback;
- `2xl` and `2x` remain separate normalization concepts.

Not established as universal production behavior:

- choosing assets by browser pixel ratio;
- treating `2xl` as a file-resolution suffix;
- arbitrary basename matching for ordinary linked assets;
- case-insensitive asset lookup;
- automatic selection by decoded pixel dimensions;
- fetching a missing linked asset from an authoring machine or external URL;
- applying logo-background promotion to unrelated component families;
- complete feed, stylesheet, video and component-specific asset-reference
  validation.

These items remain evidence gaps. They are not implicit requirements or
assumptions for future implementation.

## 10. Implementation and source references

- `preview/archive/turbo-preview-7.8.1.html`
  - `getCustomAssetName`: custom and legacy linked filename selection.
  - `parseExport`: layer-ID-to-custom-filename map.
  - `assetMimeType`: package Blob MIME assignment.
  - `handleZipFile` / `setAssetResolver`: package indexing and exact/Retina
    fallback.
  - `resolveDisclaimerAsset`: disclaimer-specific relative-path handling.
- `doc/07-Layer-Structure-Rulebook.md`: LS-003 and LS-012 rationale.
- `doc/layer-structure/rules.json`: machine-readable normalization ledger.
- `doc/layer-structure/authoring-contracts.md` and `.json`: guideline-backed
  package reference and Retina companion evidence.
- `doc/11-Production-Structure-Parity-Fix.md`: SPIRIVA regression record.
- `tests/structure/render-tree-fix.test.mjs`: generated Retina fallback
  regression.
- `tests/screenshot/capture.test.mjs`: disclaimer package-path resolution.

