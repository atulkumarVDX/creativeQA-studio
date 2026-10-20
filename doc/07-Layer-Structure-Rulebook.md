# Layer structure rule book — draft 0.2.0

Date: 2026-09-13. Scope: Photoshop authoring, export structure, component state and future validation. This document introduces no renderer or Photoshop changes.

## Guideline-backed source of truth

The supplied `PSD export guidelines.pdf` and all six template ZIPs have now been reviewed together. The [authoring contracts supplement](layer-structure/authoring-contracts.md) and [machine-readable contracts](layer-structure/authoring-contracts.json) cover 22 structural profiles, with PDF page references, required/listed children, optional/alternate children, template paths and conflicts. These contracts take precedence over older provisional recommendations below where the PDF explicitly establishes a component requirement. The project-specific `buttonN` policy takes precedence over the PDF's broader CTA names.

All six template archive hashes match the existing complete inventories (8,024 template layers). None has `export.json`. Templates confirm authoring examples; matching exports/runtime remain necessary to confirm production conversion. The registry is descriptive and advisory, not an implemented PSD validator.

## 1. How to use this book

Start with the component closest to the intended interaction, preserve its template structure, and inspect findings against that component's profile. The supplied templates establish examples of expected authoring structure. They do not establish that every template choice is mandatory or that a live creative has been tested.

There are three distinct trees to preserve and compare:

1. **PSD tree:** actual groups, shapes, text, assets and configuration markers.
2. **Export tree:** layer IDs and parent IDs after documented exclusions and name normalization.
3. **Runtime tree:** HTML containers, children, generated items and interaction states after component conversion.

The runtime tree need not contain one DOM node for every Photoshop layer. A `frame` can supply its group's geometry; a data-driven component can generate many items from one template. Every such conversion needs an explicit mapping. Flattening all groups into unrelated artboard children loses the relationships needed to predict production behavior.

Runtime package lookup for generated, Retina, custom and linked assets is
defined separately in [Asset handling contract](12-Asset-Handling-Contract.md).
That contract preserves this book's distinction between `2xl`, `2x` layer
annotations and `-2x.png` generated filenames.

An ordinary group should retain its grouping semantics in the render model. Whether it requires a physical DOM wrapper depends on the production compiler; adding wrappers indiscriminately can introduce new clipping, stacking and coordinate effects. Preserve the source ancestry even when an adapter consumes or omits a node.

### Evidence labels and enforcement

| Label | Meaning | Default treatment |
|---|---|---|
| Template-observed | Directly read from a supplied base PSD | Recommended profile; deviation is a warning or review item |
| Sample-observed | Directly read from the LaRoche PSB | Example, not a universal requirement |
| Export-confirmed | Matched layer IDs, names and parents in PSB/export | Confirmed for this source and export revision |
| Plugin-observed | Executable logic or passing pure tests in Design Pilot | Tool capability or constraint, not proof of production support |
| Production-confirmed (historical) | Existing issue catalog includes observed live behavior | Applicable to that recorded runtime/case |
| Proposed | Recommended architecture, check or unverified behavior | Report as proposed; never silently block publication |

Confidence and severity are separate. An unsupported component produces **Unknown/review**, not a pass and not a claim that the PSD is invalid. Errors require deterministic corruption or a confirmed contract for the selected exporter/runtime version. A template deviation alone does not justify an error.

## 2. Sources and coverage

The user confirmed the LaRoche PSB, its export ZIP and extension directory `v2.0.7` as current. The newly supplied base-template folder is the reference for this draft. Files were found under `sample/creative/LaRoche/` after the workspace was reorganized.

| Source ID | File / PSD inside ZIP | Layers read | Main coverage |
|---|---|---:|---|
| T360 | `sample/basetemplates/360view.zip` / `auto_template9_v1/auto_template9_v1.psd` | 1,153 | 360 View, RM, CTV/OTT |
| TCAT | `sample/basetemplates/categoryGallery_Map.zip` / `auto_template11_v1/auto_template11_v1.psd` | 1,576 | Category Gallery, Location Map, RM |
| TCOLOR | `sample/basetemplates/colorpicker.zip` / `auto_template8_v1/auto_template8_v1.psd` | 1,209 | Color Picker, RM |
| TCOMPARE | `sample/basetemplates/comparisonslider.zip` / `cg_template6_v1/cg_template6_v1.psd` | 1,325 | Comparison Slider inside RM slides |
| TDOTTER | `sample/basetemplates/dottergallery.zip` / `cg_template4_v1/cg_template4_v1.psd` | 1,139 | Feed-driven Dotter Gallery |
| THOT | `sample/basetemplates/hotspot.zip` / `travel_template5_v1/travel_template5_v1.psd` | 1,622 | Hotspot, Static Product Gallery |
| LRP | `sample/creative/LaRoche/design_1.psb` | 1,440 | RM, live CTA, navigation, video, OTT |
| LRP-EXPORT | `sample/creative/LaRoche/design_1.psb.zip` / `export.json` | 1,246 records | PSB/export comparison |
| PLUGIN | `/Users/atul/Documents/Photoshop Automation/textMaster/mereged/v2.0.7` | — | Component recognition and state logic |

Full trees, source SHA-256 hashes, IDs, types, bounds, parent relationships and saved visibility: [inventory JSON](layer-structure/template-inventory.json), [readable trees](layer-structure/template-layer-trees.md). These files are generated evidence, not instructions or validation verdicts.

The six base-template ZIPs contain PSDs and supporting files, but **none contains `export.json`**. `data.json` and `dotterFeed.json` are component feeds, not export manifests. Authoring profiles are available now; export and live runtime mappings for those templates remain unverified.

### LaRoche source/export result

All 1,246 exported IDs occur in the PSB, and all retain their parent relationship. There are 74 name differences, each explained by removal of a trailing ` 2xl`. The 194 PSD nodes absent from the export all have a dot-prefixed node in their ancestor path (including themselves). No additional exported IDs were found. This is evidence that the matched export retains hierarchy; it does not prove pixel, typography or runtime parity.

The earlier preview diagnosis locates flattening after parsing, in the preview's render collection and DOM creation. It should not be generalized into a claim that `export.json` lacks parents.

## 3. Shared authoring rules

| Rule | Recommendation | Validation scope / exclusions |
|---|---|---|
| LS-001 | Preserve unique layer identity and a resolvable, acyclic parent chain. | Check every manifest; names may repeat under different parents. A tree path plus layer ID identifies a node. |
| LS-002 | Treat a dot prefix as an exclusion marker for that subtree in the evidenced profile. | Retain excluded nodes in the evidence tree; do not count `.dots` or `.staticProductGallery` as active components. Saved hidden state alone is not exclusion. |
| LS-003 | Preserve raw and normalized names separately. | LRP export removes trailing ` 2xl`; plugin distinguishes ` 2x` excluded duplicates from `2xl`. Verify exporter-specific suffix handling before applying it globally. |
| LS-004 | Match components with their own naming grammar and parent context. | Recommend the template spelling with optional evidenced numeric component suffix. Plugin substring matching is broader and is not the authoring contract. |
| LS-005 | Keep state keys unique among siblings in one owning component. | `category1/slide1` and `category2/slide1` are valid separate identities. Normalize accepted suffixes before detecting duplicates. |
| LS-006 | Separate state content from persistent controls and configuration. | `frame`, `arrows`, `dots`, `slideProgress`, triggers and feed markers must not become gallery slides. |
| LS-007 | Resolve `frame` only among the owning group's direct children. | Do not borrow a frame from an ancestor, a different slide or a descendant control. Multiple direct frames are ambiguous. |
| LS-008 | Choose a component-specific bounds policy. | Many component roots use one shape `frame`, but category slides and Static Product slides in the supplied templates can lack one. No universal “every group/slide requires frame” rule. |
| LS-009 | Preserve layer order and state numbering as separate data. | Plugin warning tests accept increasing or decreasing Photoshop order and flag mixed direction. A missing number is reviewable, not automatically broken. Do not reorder PSD layers to satisfy a generic ascending rule. |
| LS-010 | Evaluate visibility within the owning component/state path. | Inspect hidden states too. Do not force every hidden descendant visible or alter similarly named states in sibling components. Initial runtime state must be verified separately from the saved PSD snapshot. |
| LS-011 | Preserve wrapper groups such as `CanvasDesign`. | Templates place RM and Static Product galleries under this wrapper. A direct-child-only gallery finder misses them. Record discovery limits separately from valid PSD depth. |
| LS-012 | Resolve assets and action/data references within their owning component and package. | Preserve tokens such as `$imageUrl$` and `[tabComponent-2]`; never treat marker names as text to render or as commands to execute. |

### Standard document shell

Template-observed across the corpus. Exact full trees are in the evidence appendix. Content placeholders below describe roles, not literal names.

```text
master
  templateConfig
    version: 1.0.0                     configuration marker
  videoPlaylist
    v1 : video1.mp4 [0]                configuration marker
    v2 : video2.mp4 [0]
  tabButtons
    titleN_active / titleN_normal      live text style/content examples
    tabN_active / tabN_normal          shape style examples
    bottom-border
    frame
  shared logos / optional feed configuration

970x546 (or another size artboard)
  navigation_bottom_border
  tabButtons                          per-size placeholder, not master group
  header
    button-clientLogo
    frame
  tabComponent
    tabN
      [video marker and/or content wrapper/component]
      frame
    frame
```

The eight standard sizes observed are `160x600`, `300x250`, `300x600`, `428x622`, `728x90`, `970x250`, `970x546`, `mobile-instream`. CTV/OTT themes are additional artboards. Do not require all sizes in every creative or identical content/state counts across sizes without a campaign requirement.

`master/tabButtons` and per-size `tabButtons` have different roles and types. Do not require every tab placeholder to be a group; the corpus also contains shape and Smart Object placeholders. The template does not include both active and normal copies for every numbered tab. Style reuse must be recorded by the runtime adapter, not invented through duplicated layers.

## 4. Component profiles

Trees show representative authoring structure. Numbered ellipses mean repeatable items, not a required count of three. A named child listed as template-observed is a recommended profile element until an exporter contract confirms necessity. Artwork names such as `carImg1` or `display_pop_bg` are examples, not reserved names.

### RM Gallery — `rmGallery`

Evidence: LRP, THOT, T360 and others. Example: LRP `970x546/tabComponent/tab2/rmGallery`, ID 210775.

```text
rmGallery
  button1                             optional persistent CTA
    [text label]
    frame
  arrows                              template controls
    right
    left
  dots                                or excluded .dots
    active
    normal
    frame
  slideProgress
    progressBar
      position slide tr
      indicator / background / playIcon / muteIcon
    circularBar
      muteIcon / playIcon / indicator / frame
  slideN
    [text, images, buttons, video, or nested component]
    frame                             present in LRP slides, not universal
  frame
```

State candidates are the direct `slideN` children; `button1` at gallery level persists across its states. A button inside a slide belongs only to that slide. Recommend at least one slide in an active authored RM profile; do not apply this check to feed-driven components. Confirm arrows/dots/progress behavior and defaults in production before requiring their presence. Left/right are the observed RM arrow names.

### Color Picker — `colorPickerGalleryN`

Evidence: TCOLOR `970x546/tabComponent/tab3/colorPickerGallery1`, ID 160151.

```text
colorPickerGallery1
  triggerN
    activeImage                       Smart Object
    normalImage                       Smart Object
    frame                             shape
  slideN
    [product image]
    [background shape]
  frame
```

Triggers and slides are siblings. Recommend matching numeric trigger/slide sets within this component and keeping trigger artwork inside its trigger. Do not pair against another component's `slide1`. The supplied slides do not require their own `frame`. One-to-one numeric interaction mapping is a proposed check supported by template correspondence; live action behavior is pending export/runtime evidence.

### Hotspot — `hotSpotGallery`

Evidence: THOT `970x546/tabComponent/tab3/hotSpotGallery`, ID 75001 (use the full inventory for exact per-size IDs).

```text
hotSpotGallery
  slideProgress
    [progressBar / circularBar]
  slideN
    closeButton                       Smart Object in this template
    display_pop_bg                     artwork group
      [text and shape]
    frame
  triggerN
    activeImage
    normalImage
    frame
  frame
```

Close controls are inside the corresponding slide in this template. Preserve trigger/slide ownership and record popup bounds relative to the owning component. The supplied template has no required root `backdrop`: do not demand one because a plugin comment mentions it. Determine whether the runtime starts with all popups closed, how close affects the trigger and whether a backdrop is generated from matched production evidence. These are not determined by saved visibility alone.

### Category Gallery — `categoryGalleryN`

Evidence: TCAT `970x546/tabComponent/tab2/categoryGallery1`, ID 75622.

```text
categoryGallery1
  home
    categoryN                         category selection tile
      title
      .trigger                        excluded helper in this template
      frame
    frame
  navBar
    next                              group: geo + frame
    prev                              group: geo + frame
    home                              shape navigation control
    title                             live text
    frame
  arrows / slideProgress / .dots
  categoryN                           category content, direct component child
    slideN
      [content]
  frame
```

There are three different meanings of similarly named nodes: `home/category1` is a tile, root `category1` owns content, and `navBar/home` is a control. Validation must match full context. A recursive search for all `categoryN` or `home` is insufficient. Compare tile/content category numbers as a recommendation; confirm click mappings from production. Slide selection is scoped to one category. Do not require a frame within every slide: this template's category slides demonstrate the exception.

### 360 View — `view360`

Evidence: T360 `970x546/tabComponent/tab3/view360`, ID 159316.

```text
view360
  .layer4AlignAdSize                   excluded alignment helper
  arrows
    right / left
  sequence
    cadreN
      underlay                        Smart Object in this template
      360BG                           shape artwork
  frame
```

Require `sequence` and numbered `cadreN` only when validating this selected template profile; these are not `slideN`. Keep frame order and cadre identities. Recommend equal intended viewport geometry, while allowing padded/raster asset bounds to differ. Drag direction, looping, starting frame and timing need runtime evidence. Plugin regex tolerates whitespace in `cadre 1`; canonical authoring examples use `cadre1`.

### Comparison Slider — `comparisonSliderN`

Evidence: TCOMPARE `970x546/tabComponent/tab3/rmGallery/slide1/comparisonSlider1`, ID 194636; repeated under slide2 and slide3 across sizes.

```text
rmGallery
  slide1
    comparisonSlider1
      dragIcon                        Smart Object
      preloader
        preloader.gif                 filename marker, pixel layer
      before
        .content / .video [v2]         excluded alternatives
        imageBefore                   Smart Object
      after
        .content / .video [v1]         excluded alternatives
        imageAfter                    Smart Object
      frame
```

`before` and `after` are comparison surfaces. Photoshop QC can capture them individually, but the live component may compose both simultaneously using a moving clip boundary. Do not turn them into mutually exclusive DOM slides just because the QC tool enumerates two captures. Require their association with the same comparison component and inspect drag/clip behavior in production. Disabled `.video` examples do not establish active video-comparison support.

### Dotter Gallery — `dotterGalleryN`

Evidence: TDOTTER `970x546/tabComponent/tab2/dotterGallery1`, ID 75622, with master configuration ID 111032.

```text
master
  dotterGallery1
    dataFile
      dotterFeed.json                  configuration marker

dotterGallery1                         per-size component
  noData
    [live text]
    frame
  dots
    active / normal / frame
  arrows
    next / prev                       differs from RM's right / left
  slideProgress
    [progressBar / circularBar]
  productTemplate
    groupsSwitch$pname$
      groupToggleTemplate
      frame
    retailers
      retailerTemplate
      [disclaimer copy]
      frame
    title
      $name$ $description$             live text tokens
    thumb
      $imageUrl$                       Smart Object token
      frame
    frame
  frame
```

This is a data-generated collection. The template has **no authored `slideN` requirement**. Validate the matching master configuration and per-size component identity, feed filename and token structure. Feed record counts and populated states require data/runtime validation. Empty data should exercise `noData`. Do not substitute the extension's generic flat-gallery classification for this authoring profile.

### Location Map — `locationMap`

Evidence: TCAT `970x546/tabComponent/tab3/locationMap`, ID 108606.

```text
locationMap
  logo / button / pin / loading        Smart Objects
  popup                               shape
  noData / default                     Smart Objects
  data
    data.json                         configuration marker
  frame
```

This component also has **no authored `slideN` requirement**. `popup` is a shape in the template and `button` is a Smart Object: neither should be forced into a universal group-plus-live-label schema. Preserve data, loading, fallback and map marker roles. Data access, map initialization, popup contents and CTA behavior remain runtime checks. A valid JSON file alone does not prove a feed fulfills the runtime schema.

### Static Product Gallery — `staticProductGallery`

Evidence: THOT `970x546/tabComponent/tab1/CanvasDesign/staticProductGallery`, full node in the inventory. T360 and TCOLOR also contain an excluded `.staticProductGallery`; those are not active instances.

```text
CanvasDesign
  staticProductGallery
    .dots / arrows / slideProgress
    slideN
      [text]
      button1
        Details                       text layer; name not required globally
        frame
      imageIcon
      button-jump1 [tabComponent-2]    shape with reference in its name
    frame
```

This template provides a flat product gallery. A slide can contain a nested Color Picker according to plugin logic, but no active nested Color Picker instance was established from these templates. Record that composition as plugin-observed pending a PSD/export fixture. Validate action target syntax and resolution separately from the visible button artwork; do not strip the bracketed reference.

### Nested Tabs — `nestedTabs`

Evidence: PLUGIN `tests/csm-nested-tabs.test.js`. No active template PSD instance found in this corpus.

```text
nestedTabs
  trigger1 / trigger2 / frame / slideProgress
  target1
    colorPickerGallery1
      triggerN / slideN / frame
  target2
    colorPickerGallery1
      triggerN / slideN / frame
```

The tested leaf convention is `targetN`, not `slideN`. The same nested gallery name under different targets is valid. The pure tests verify that selecting a state under target1 does not change target2's nested slides. Required controls and production rendering remain provisional until a matched PSD/export/runtime is supplied.

### Text CTA and button roles

User-confirmed authoring contract (2026-09-13; latest preview source: `preview/archive/turbo-preview-7.8.0.html`): CTA groups are named `buttonN`, where N is a positive integer such as 1, 2 or 3. A direct `frame` is required. A text label may be present; its literal layer name is not specified. An image/Smart Object may also be present and must be named exactly `background` when present. The background itself is not mandatory. These requirements supersede the older advisory CTA naming/frame guidance below, without changing the recorded historical source evidence.

```text
button1
  frame                               required
  <text label>                        permitted text layer
  background                          optional image/Smart Object; exact name required
```

Validation must select the CTA group profile by context and type before applying these rules; map Smart Object buttons and other action roles are separate profiles. Do not silently rename legacy unnumbered `button` groups. Report their nonconformance to the current authoring contract while retaining source evidence. Frame promotion, child positioning and background stacking still require matched production verification; this authoring confirmation is not production runtime evidence.

Evidence: LRP `970x546/tabComponent/tab1/CanvasDesign/button`, ID 214851; label ID 222520; frame ID 214849. This exact source structure is preserved in the matching export.

```text
button
  LEARN MORE                          type layer
  frame                               shape
```

The label and shape are siblings in the PSD, inside the button group. Production can consume the frame as the component's box and place the label inside that runtime container. Preserve both source parentage and runtime ownership; do not rewrite the PSD to put text inside a shape.

The previous proposed universal `button` rule was too narrow: Location Map's `button` is a Smart Object, `button-clientLogo` has another role, and LRP also includes a button-like group with a non-`frame` artwork shape. Recognize a text CTA profile by group/type/context and its direct frame. A missing frame in a button-like group is reviewable; it is not proof that the artwork is invalid. Literal label names need not be `label`.

Additional text/image/multiline/icon/bordered CTA profiles are deferred at the user's request. The existing historical disabled-stroke case remains [TR-002](06-Text-Render-Issue-Catalog.md); this pass does not re-measure that production link.

### CTV and OTT scenes

Evidence: T360, TCAT, TCOLOR, TCOMPARE, TDOTTER and THOT all include scene groups. Representative THOT trees:

```text
ott_theme2_FHD
  ott_theme2_noqrcode
    video
      video_ctvott.mp4                 filename marker
      frame
    Screen1
      peel / peelLogo / frame
    Screen2
      background / frame

ctv_theme3_QRCode_FHD
  ctv_theme3_nophone
    qrCodeConfig
      brandingLogo / colorCode / url / frame
    video
      video_ctvott.mp4 / frame
    Screen1
      peel / peelLogo / frame
    Screen2
      bringItAlive / QRCode / noPhone Frame / foreground / frame
    Screen3
      tagLine / scanAnchor / bringItAlive / QRCode / noPhone Frame / background / frame
```

Some templates include `dynamicAddress`, and some exclude it with a dot prefix. HD alternatives have dot-prefixed artboard names. Preserve exclusion separately from scene visibility. The LRP active OTT artboard differs from these layered base scenes; do not demand identical inner structure in every delivered creative.

These are alternate source scenes: the opening peel, Screen 2 video/QR hold, and (for supported CTV) Screen 3 expansion. The **current local-preview** timing, simultaneous overlays, asset provenance and layer order are now specified in [CTV/OTT Consolidated Spec](CTV-OTT-Consolidated-Spec.md), using the supplied AE reference and exported packages. This authoring-tree evidence alone still does not prove all publisher runtime behavior. The plugin also searches `FrameN`, `StateN`, and `SceneN`; only `ScreenN` is established as a scene naming convention by these templates. Do not authorize the other spellings for production from that heuristic alone.

## 5. Coordinate and DOM contract

Status: proposed shared conversion contract, with historical CTA evidence in TR-002. A complete production compiler was not inspected in this pass.

For every component instance retain:

- source layer ID, original name, source parent ID, full path and source order;
- component family and instance identity, separate from display name;
- semantic parent and state owner, plus the source IDs consumed by its runtime node;
- absolute PSD bounds, geometry source (`frame`, vector bounds, group or asset), and local bounds;
- visibility/exclusion, clip/mask, transform, opacity/blending, stacking, border and padding semantics;
- runtime parent, containing-block convention, text/font resolution and renderer version.

For an untransformed frame-derived component, a geometric starting point is `child.absolutePosition - frame.absolutePosition`. Final CSS positioning must also account for the actual containing block, border/padding convention and any compiler compensation. Subtraction alone is not a complete renderer contract. Transformed ancestors require conversion into local coordinates without applying a scale twice. `box-sizing: border-box` alone does not remove the border's effect on child positioning.

Treat Photoshop strokes as drawing properties. Do not automatically convert a centered/outside stroke into a layout-changing CSS border. A disabled stroke must remain disabled in the intended output. To predict a known defective production build, identify that build and reproduce its behavior in a clearly identified parity profile with a diagnostic; do not silently repair it only in preview.

Ordinary paint order, group clipping, group opacity and group effects need explicit support or an unsupported-feature finding. Source bounds can include raster antialias padding, and visible children can intentionally overflow. Do not label any child beyond its frame as a structural error without the component's clipping contract.

## 6. Validation design

The companion [rule registry](layer-structure/rules.json) is draft configuration for a future validator, not an installed validator and not a JSON Schema for raw `export.json`. A [JSON Schema](layer-structure/rules.schema.json) describes the registry itself. Evidence profiles and rule IDs are shared with this document.

Run checks in this order:

1. Source integrity: unique IDs, parent resolution, cycles, source/version identity.
2. Classify nodes: component, state, control, artwork, configuration, excluded or unknown.
3. Select a profile by context, with explicit handling of suffixes and excluded ancestors.
4. Validate direct children, identity scope, types and references within that profile.
5. Compare PSD/export using an exclusion/normalization ledger; preserve every unexplained difference.
6. Compare runtime ancestry, component mapping and local coordinates against the compiled export.
7. Exercise interactions and measure visuals after fonts and component data settle.

Report `ruleId`, severity, confidence, source/version, artboard, component path, layer ID, expected vs observed structure, reason, suggested repair and evidence. Missing export or live runtime evidence must be **not evaluated**, not passed. Keep source layer names/IDs available in DOM diagnostics even when several layers compile into one component.

| Check | Expected result | False-positive exclusion / repair |
|---|---|---|
| Duplicate slide in one RM instance | Warning until exporter contract confirms error | The same name in a separate category is valid; rename only the unintended duplicate. |
| Missing frame in text-CTA profile | Review profile/bounds mapping | Do not apply to map Smart Object buttons or every slide; use matching template frame if intended. |
| Frame ambiguity | Report direct-frame candidates with IDs | Do not use a recursive first-match lookup; resolve intended owner. |
| Mismatched Color Picker/Hotspot trigger and slide numbers | Warning | Account for excluded helpers and separately scoped instances; verify intended target. |
| Category tile/content mismatch | Warning | Distinguish `home/categoryN`, direct `categoryN`, and `navBar/home`. |
| Dotter/Map with no `slideN` | No missing-slide finding | Use feed/template profile and check required data markers. |
| 360 `sequence` without cadres | Profile warning | Disabled component is outside active validation; do not demand slides. |
| Missing package feed/asset | Export/package finding | Do not infer missing PNG from native text/shape/config layers that are not rasterized. |
| More nesting than tool supports | Unsupported/review | Do not state that the PSD or production nesting is invalid. |
| Disabled stroke with positive stored width | QA warning if component/descendant context is relevant | Promote only when rendered border/offset confirms it; follow TR-002. |
| Runtime label parent differs from intended component | Runtime parity mismatch | Compare mapped semantic owners, not raw node count. |
| Hidden scene/state | Inspect during state enumeration | Hidden saved state is not a missing or broken layer. |

Suggested future fixture tests: category home and each category slide; Hotspot initial/each popup/close; Color Picker each trigger; Dotter populated/empty feed; Map loading/populated/no-data/popup; Comparison Slider endpoints and midpoint; 360 first/middle/last/loop; nested target and child state with sibling isolation; CTA before/after disabled-stroke repair; CTV/OTT scene boundaries and shared overlays. These tests remain planned, not executed by this draft.

## 7. Plugin evidence and known gaps

Examined current executable code in `csm-constants.js`, `csm-state-logic.js`, `csm-photoshop-api.js`, `csm-state-engine.js`, `module-qc.js`, and existing pure tests. Manifest version is 2.0.7; State Manager constants report 2.0.5 / `2.0.5+2026.09.01.05`. Record both build identities.

- `resolveStates()` implements flat, categorized and sequence shapes. The Photoshop scan calls it, and the state engine consumes scoped changes. Older constants comments describing only flat support are stale. The previous conversational claim of no category/360 state handling is corrected here. Live Photoshop execution has not been tested in this pass.
- `nestedTabs` has a tested `targetN` convention and isolation between sibling target instances.
- `locationMap` and `dotterGallery` are classified as flat in the registry, but the supplied templates contain no `slideN`. Their feed-driven state generation needs distinct profiles.
- Top-level gallery discovery can descend through wrappers and returns the first matching gallery in a tab. It is not an inventory of every sibling gallery.
- Nested gallery discovery in the current pure logic checks direct children of a state. This is narrower than the recursive search used by parts of QC. Arbitrarily nested galleries inside decorative wrappers are not proven supported.
- `MAX_NEST_DEPTH = 3` is an implementation limit; it is not an authored PSD limit or a production guarantee.
- Substring matching and inconsistent whitespace tolerance across plugin paths require explicit alias handling. The scanner accepting `target 2x` as a target key does not make it a recommended layer name: exclusion handling can interpret a trailing ` 2x` differently.

Verification completed: the existing state-logic, nested-tabs and sequence-warning Node test scripts passed. These test model behavior and do not certify production rendering.

Registry verification completed with `node tools/check_layer_rulebook.cjs`: JSON Schema validation passed; all 12 component IDs and 12 rule IDs are unique; every rule reference resolves; every PSD-based component example resolves to an active group and matches its recommended name pattern. All 9,464 inventoried layer records have consistent parent paths. The LaRoche exclusions and name-normalization explanation were checked programmatically. The checker uses the existing Ajv 2020 package under `turbo-qa-studio/node_modules`; it checks this book's consistency, not a creative's compliance with the proposed rules.

## 8. Maintenance and remaining evidence

Draft 0.1.0 is a documentation/registry release independent of the existing preview build. Keep evidence snapshots immutable by source hash, and re-inventory when a source revision changes. Each promoted rule needs a source fixture, an exporter/runtime version where relevant, a positive example and a counterexample. Render the human guidance and future validator from the same registry where practical.

Next useful evidence, without blocking this draft:

1. Matching **export ZIPs containing `export.json`** for the six base PSD templates and their exporter version. Existing ZIPs are authoring packages.
2. Production URLs or saved DOM/component payloads for the same exports, especially data-driven Dotter/Map, Hotspot actions and comparison clipping.
3. Production PSD/export-to-component compiler source, if available, to confirm frame promotion, supported nesting and marker consumption.
4. An actual Nested Tabs PSD/export and a Static Product → Color Picker nested example.
5. CTA variants when the user is ready; existing text CTA coverage is sufficient for this draft.

Initial CTV/OTT layer-tree coverage is complete. A supplied AE project and matching export packages now establish the motion/effects references used by the **local 7.11.16 preview**; see [CTV/OTT Consolidated Spec](CTV-OTT-Consolidated-Spec.md). A production runtime/export for every publisher and theme is still not established by this authoring-tree inventory.

Reproduction: run `tools/inventory_layer_templates.py` with `psd-tools==1.19.0`. It reads PSDs from ZIP memory and the LaRoche PSB without saving them; emits inventory and tree appendices. Layer iteration follows foreground-to-background order per the parser's [official usage documentation](https://psd-tools.readthedocs.io/en/latest/usage.html). Parser output establishes structural evidence only; no composited-image fidelity is claimed.
