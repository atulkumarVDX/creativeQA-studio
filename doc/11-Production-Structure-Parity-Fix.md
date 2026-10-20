# Production structure parity fix — 7.8.1

## Retina-only generated assets

The consolidated runtime and authoring treatment is defined in
[`12-Asset-Handling-Contract.md`](12-Asset-Handling-Contract.md). This section
records the release-specific defect and fix.

The SPIRIVA package exposed a shared asset-resolution defect. Its visible
`button-clientLogo/background` source layer requests the generated name
`background-31082.png`, while the package contains only
`background-31082-2x.png`. The loader previously detected the Retina fallback
when deciding whether to warn, but still returned the missing-asset data URL.
This specifically affected backgrounds promoted into containers because they
have no image `onerror` retry. The 7.8.1 package resolver now returns the exact
asset when present and otherwise returns the corresponding `-2x.png` asset.
The same rule applies to any uploaded package. A regression test covers this
lookup; all 55 structure and screenshot-capture tests pass.

## Exact matched La Roche set — September 15, 2026

The current `production-file/laRache/j.ad`, CSS folder and
`sample/creative/LaRoche/design_1.psb.zip` form a matched 970×546 fixture.
The compiled model selects Turbo Components 3.13.11-1, contains 97 objects and
93 numeric source-layer tags, and references the supplied 970×546 product CSS.
All 93 tags resolve to the ZIP. All five UUID selectors in `style.css` and
`image.css` resolve to objects in this compiled model. Font-family identity is
used for comparison; generated production and export filenames need not match.

Across nine tab/slide states, the actual 7.8.1 painter emits every tagged
compiled object. All comparable initial numeric left, top, width and height
properties match the compiled model within 0.001px. Source sibling ordering now
matches the compiled object arrays. A remaining root mismatch was corrected by
using the assigned size-instance order for reconstructed master navigation
elements; the master layer's original document itemIndex is no longer allowed
to reorder the size-specific bottom border.

The full automated suite now has 54 passing tests. The five-package,
248-state smoke run also passes. This establishes structural and initial inline
geometry parity for this exact fixture. It does not establish post-font computed
text geometry, decoded asset pixels, component animations, media playback or
browser screenshots. Those require rendering the matched assets and fonts in a
browser. Other component families require their own matched compiled fixtures
before universal coverage can be claimed.

## Compiled model received — September 14, 2026

The user supplied a populated `ccMainunitVersionVariation`. Production merges
this into `ccMainunitDesign`, so the empty base field does not imply an empty
effective model. The supplied model contains 97 objects: 53 containers and
44 text objects, with playlist/component configurations and product stylesheets.
It was extracted as JSON without executing the surrounding script or callbacks.
Client model contents remain outside the repository.

This evidence establishes low-to-high Photoshop itemIndex ordering in compiled
sibling arrays. The fix now inserts source siblings in that order regardless
of reverse rawLayers traversal or lazy group creation. RM Gallery conversion
now generates a collection and selected tabpanel wrapper for slide content.
Persistent gallery CTAs remain direct children of the gallery container outside
the collection, matching the supplied runtime HTML and compiled ownership.
Collection clipping and stacking follow the inspected runtime stylesheet.

Five live-shape discrepancies were traced to using keyOriginShapeBBox instead
of exported pathBounds. The compiled model uses pathBounds for these shapes;
the fix's live shape collector now shares the same path-first bounds helper as
frame-derived containers, with the original fallback when path bounds are absent.

Across all nine states of this supplied 970×546 model, all 93 numerically tagged
source objects are emitted by the actual fix painter. Every comparable initial
numeric left/top/width/height field matches the compiled model within 0.001px.
The remaining four objects are the untagged root and three CTA text wrappers.
Their correspondence is separate from the numeric-ID check. The compiled first
CTA text wrapper starts at 133px wide, matching preview; the supplied live DOM's
135.273px width is a post-font synchronization result, still unverified here.

The structural/capture suite has 53 passing tests. The five-package 248-state
smoke run also passes after these changes. Base 7.8.0 remains byte-identical.
These checks do not establish full computed CSS, component behavior, inactive
state lifecycle, product-image stylesheet parity, or coverage for component
families absent from this compiled fixture. No attached callbacks were executed.
The supplied three product stylesheet paths are references, not their contents.

## Production folder follow-up

Inspection of all 12 files in the supplied `production-file` folder establishes
additional runtime contracts. Turbo component CSS clips `.vdx-collection` and
`.vdx-collection-item`, sets collection positioning to relative with z-index 0,
and gives `.vdx-content-entry` z-index 0 and no background repeat. These rules
are now applied to the fix's generated tab wrappers and covered by its tests.

The model trace is explicit: `initializer.js` merges `ccMainunitDesign` and
`ccMainunitVersionVariation`, then assigns the design to `mainUnitConfig`.
`processCssPath` only resolves product stylesheet URLs; it is not a PSD compiler.
`creative.js` constructs `new window.VDXContainer(mainUnitConfig)` and renders
its recursive objects. The supplied `j.ad.html` has an empty
`ccMainunitDesign`; it does not provide a populated compiled object model.
The referenced `creative.js.map` and `initializer.js.map` are absent.
The large `main-DHW6Uvwq.js` is an application bundle; inspection found no raw
Photoshop/export descriptors or PSD hierarchy conversion entry points.

There are two container generations here. `vdxcontainer.min.js` computes child
coordinates with parent-border subtraction and responsive/pinning rules;
`vdx-container-turbo.js` instead applies already compiled CSS. The initializer
selects the Turbo runtime based on toolName. Do not apply the older runtime's
border and pinning convention globally to Turbo exports.

A populated `ccMainunitDesign` with its variation/product styles is the most
specific next compiled fixture needed. It can establish consumed source roles
and object CSS across more components even if the production compiler is not
available. Universal parity remains unverified.

`preview/archive/turbo-preview-7.8.0.html` remains the base, unchanged during this fix.
`preview/archive/turbo-preview-7.8.1.html` embeds the separately maintained
`scripts/structure/render-tree-fix.js`.

This implements shared conversion changes for uploaded exports, with no
creative names, fixed source layer IDs, or LaRoche-specific offsets in the
engine. Ordinary containers use finite exported `boundsNoEffects` when
available, falling back to `bounds`. Descendants retain source ancestry and
are rebased into the owning container at render scale. An existing direct
frame is promoted only for the supported frame-derived naming profiles;
descendant frames are not borrowed and multiple candidates remain ambiguous.
Frame promotion consumes the frame paint record. This does not introduce a
requirement that every group or slide have a frame.

The confirmed direct logo background is converted to container background
CSS through the existing asset resolver, including generator filename fallback.
TabComponent conversion creates component, collection and selected tabpanel
wrappers from the supplied production hierarchy. Current selection still paints
the selected tab rather than maintaining the production library's whole live
collection. Frame-enabled flags remain respected. Validation rules are unchanged.

## Verification

- 51 structure and screenshot-capture tests pass, including six new fix tests.
- The actual parser and painter execute in a minimal DOM against five real
  exports: Ipsen (34 states), Cosentyx HCP (76), Cosentyx DTC (54), navigation
  prototype (12), and LaRoche (72). Total: 248 states on 32 artboards. No invalid
  numeric inline geometry was emitted in these runs. These are smoke checks,
  not production comparisons for the four packages without supplied DOM.
- Supplied LaRoche 970×546/tab1 production content matches the fix's source
  parent ownership, ordinary container geometry, icon and product image local
  positions, CTA frame size and label local offset. Decimal differences in CTA
  frame positions are rounding. Text wrapper widths after font synchronization
  are not yet verified.
- The base file's SHA-256 was checked against its value captured before the fix.

To re-embed only this fix:

```sh
node scripts/structure/embed-render-tree.mjs ../../preview/archive/turbo-preview-7.8.1.html ./render-tree-fix.js
node --test tests/structure/*.test.mjs tests/screenshot/capture.test.mjs
node scripts/structure/smoke-render-fix.mjs /path/to/export.json
```

## Remaining requirement

Universal production structural parity is **not established** by this fix.
The inspected runtime, `production-file/vdx-container-turbo.js` version
3.13.8-0, recursively renders already compiled objects and their supplied CSS.
It does not supply the PSD/export-to-object compiler. The earlier task,
“Fix CTA layer nesting in preview”, explicitly called for the same conversion
rules and component adapters, not arbitrary nesting.

The latest production compiler or equivalent compiled-object fixtures are
needed to implement and verify all gallery/player/ISI/navigation conversions,
marker and background consumption, masks, clipping, transforms, group effects,
opacity, stacking and inactive-state lifecycle. Do not infer these mappings
from authoring acceptance or template layer names. Full browser computed-style
and post-font screenshot parity remains outstanding. The user has been asked
for the compiler location while the evidenced fix work proceeds.
