# PSD authoring contracts — 0.1.0

Reviewed 2026-09-13 against all 13 guideline pages and all six matching template inventories (8,024 layers). This supplement defines source-validation contracts, not verified production rendering.

The project buttonN policy takes precedence over the PDF’s broader CTA names. Optional background images retain their background role; documented assets-generator suffixes must be parsed separately. Raw names and source ancestry must remain available.

Package lookup and the separate treatment of `2xl`, `2x`, generated Retina
filenames and linked Smart Objects are defined in
[`../12-Asset-Handling-Contract.md`](../12-Asset-Handling-Contract.md).

## Evidence and conflicts

- All six ZIP SHA-256 hashes match the existing full PSD inventories; archive manifests were rescanned. No matching export.json is present.
- Category Gallery and Dotter Gallery are template-observed, not described in this PDF.
- The generic container frame requirement has explicit component-specific exceptions: RM/Static Product slides and Nested Tabs targets/triggers have optional frames.
- CTA text is documented; image-only CTA behavior remains unconfirmed. Other CTA children are documented as ignored, so the adapter must not blindly render arbitrary children.
- Guide uses view360_identifier; templates include view360. Keep these as distinct evidence-backed aliases rather than silently rejecting templates.
- Comparison Slider and Product Gallery have incomplete root-frame requirements in the guide; keep unresolved checks advisory.
- Version, timing, feed semantics and exporter normalization require matching exporter/runtime evidence.

## Component contracts

### container

Evidence: guideline-documented; PDF pages: 3.

Required/listed structure: frame: rectangle shape.

Optional/alternate structure: background: pixel/Smart Object.

- Frame owns position, bounds, fill, radius and border color/width.
- CSS border styles unsupported; custom dashed artwork belongs in background.
- Use component-specific exceptions for slide/target frames rather than requiring frames in every artwork group.

### tabs

Evidence: guideline-documented; PDF pages: 2, 3, 4.

Required/listed structure: tabComponent: group even for single-tab campaigns; tabComponent/tabN: group; tabComponent/frame: rectangle shape; tabComponent/tabN/frame: rectangle shape; tabButtons: size-specific bounds marker/container.

Optional/alternate structure: background; master/tabButtons.

- Without master configuration, repeat the same tabButtons layer structure per artboard; with master, size-specific frame defines bounds.
- Master text order defines titles; _normal/_active/_hover define states.
- Mobile expandable ISI must be shared before tabComponent, sticky at top.

Template example: `sample/basetemplates/360view.zip` → `428x622/tabComponent`.

### cta

Evidence: user-confirmed; PDF pages: 6.

Required/listed structure: buttonN: CTA group with positive integer N; frame: shape.

Optional/alternate structure: text label: arbitrary name; background: pixel/Smart Object.

- Project policy buttonN overrides broader documented button{any unique identifier}.
- When image/Smart Object background is present, its role name must be background.
- Guide specifies a text CTA label; image-only CTA variants remain unconfirmed.
- Other layers inside CTA folder are ignored by documented exporter.
- Preserve recognized generator/annotation suffixes separately from role name.

Template example: `sample/basetemplates/360view.zip` → `428x622/header/button-clientLogo`.

### jumpTo

Evidence: guideline-documented; PDF pages: 6.

Required/listed structure: action target reference: componentId-itemNo.

Optional/alternate structure: CTA-like group with frame and optional background; standalone image/shape form.

- Preserve button-jump [componentId-itemNo] syntax and resolve target within owner/package.
- Guide supports multiple representations; do not require CTA group structure for standalone image/shape variants.

### video

Evidence: guideline-documented; PDF pages: 2, 6.

Required/listed structure: primary video inside tabComponent/tab1; playlist IDs resolved in master/videoPlaylist.

Optional/alternate structure: video [v1, v2]: rectangle shape; video container with frame.

- Playlist marker format videoId : filename [posterSecondOffset].
- Preserve playlist layer order. First-tab playlist count must match across sizes.
- Referenced assets must resolve relative to PSD folder; subfolders supported.

Template example: `sample/basetemplates/360view.zip` → `ott_theme2_FHD/ott_theme2_noqrcode/video`.

### videoComponent

Evidence: guideline-documented; PDF pages: 6.

Required/listed structure: videoComponent identifier and playlist references; frame: rectangle shape.

Optional/alternate structure: arrows/right; arrows/left; slideProgress/progressBar; playIcon; muteIcon; position marker.

- Self-sufficient component; do not require gallery wrapper.
- Resolve all playlist IDs.

### imageGallery

Evidence: guideline-documented; PDF pages: 7.

Required/listed structure: imageGallery identifier; image identifier layers; frame: rectangle shape.

Optional/alternate structure: arrows/right; arrows/left.

- Images are states; preserve layer order, do not require slideN groups.

### rmGallery

Evidence: guideline-documented; PDF pages: 7, 8.

Required/listed structure: rmGallery identifier; slide identifier groups; frame: rectangle shape.

Optional/alternate structure: arrows/right; arrows/left; slideProgress; background; slideN/frame; slideN/background.

- Slide frame is optional.
- If gallery and slide frames both exist, their bounds must match per guide.
- slideProgress absence disables autoplay slide animation.
- Gallery-level controls/CTA persist; slide-owned elements are state-scoped.

Template example: `sample/basetemplates/360view.zip` → `428x622/tabComponent/tab2/rmGallery`.

### colorPickerGallery

Evidence: guideline-documented; PDF pages: 8.

Required/listed structure: RM Gallery structure; trigger identifier groups; triggerN/frame: rectangle or ellipse.

Optional/alternate structure: triggerN/normalImage; triggerN/activeImage; triggerN/hoverImage; triggerN/normal; triggerN/active; triggerN/hover.

- Trigger frame defines bounds and shape. State shapes/images customize states.
- Keep triggers separate from slide content; runtime index mapping requires verification.

Template example: `sample/basetemplates/colorpicker.zip` → `428x622/tabComponent/tab3/colorPickerGallery1`.

### hotSpotGallery

Evidence: guideline-documented; PDF pages: 8.

Required/listed structure: hotSpotGallery identifier; slide identifier groups; slideN/frame: rectangle shape; slideN/closeButton: pixel/Smart Object; trigger identifier groups; triggerN/frame: rectangle or ellipse.

Optional/alternate structure: slideN/background; trigger state shapes/images; backdrop.

- Extends Color Picker. Slide frame owns popup geometry, border and radius.
- Do not confuse sequence position-marker shapes with popup content groups.

Template example: `sample/basetemplates/hotspot.zip` → `428x622/tabComponent/tab3/hotSpotGallery`.

### view360

Evidence: guideline-documented; PDF pages: 8.

Required/listed structure: hotspot-compatible component structure; sequence/cadreN groups starting at 1; cadreN/underlay: image; cadreN slide/trigger position-marker shapes.

Optional/alternate structure: arrows/right; arrows/left.

- Guide uses view360_{identifier}; supplied template uses view360. Treat as documented/template aliases pending exporter verification.
- cadreN prevents collision with geometry frame. Underlay supplies image, its bounds ignored.
- Position-marker shapes and popup content are distinct roles.

Template example: `sample/basetemplates/360view.zip` → `428x622/tabComponent/tab3/view360`.

### locationMap

Evidence: guideline-documented; PDF pages: 7.

Required/listed structure: frame: rectangle shape; popup: rectangle shape; pin; logo; button: pixel/Smart Object; noData; loading; default; data/filename.json: filename marker.

Optional/alternate structure: None explicitly recorded.

- No authored slideN requirement.
- Map button is an image role, exempt from CTA buttonN group policy.
- Validate asset/feed references without executing data.

Template example: `sample/basetemplates/categoryGallery_Map.zip` → `428x622/tabComponent/tab3/locationMap`.

### comparisonSlider

Evidence: guideline-documented; PDF pages: 7.

Required/listed structure: before or left: group; after or right: group.

Optional/alternate structure: preloader/filename marker; bar: loading rectangle; side/video playlist marker; side/image layer; side/content: rich-media group.

- Within each side, documented selection priority is video > image > content.
- Template frame/dragIcon are observed; guide does not explicitly list root frame here, so root-frame enforcement remains reviewable.

Template example: `sample/basetemplates/comparisonslider.zip` → `428x622/tabComponent/tab3/rmGallery/slide3/comparisonSlider3`.

### nestedTabs

Evidence: guideline-documented; PDF pages: 10.

Required/listed structure: frame: rectangle shape; target identifier groups; trigger identifier groups.

Optional/alternate structure: targetN/frame; targetN/background; triggerN/frame; triggerN/background; trigger normal/active variants; master/nestedTabs trigger overrides.

- Target and trigger frames optional per component-specific guide.
- Master overrides require matching size-specific structure.
- Do not flatten nested state ownership.

### staticProductGallery

Evidence: guideline-documented; PDF pages: 11, 12.

Required/listed structure: frame: rectangle shape; slide identifier groups.

Optional/alternate structure: arrows; slideProgress; background; slideN/frame; slideN/background.

- Slide frames optional; preserve nested component ownership.

Template example: `sample/basetemplates/hotspot.zip` → `428x622/tabComponent/tab1/CanvasDesign/staticProductGallery`.

### scrollpane

Evidence: guideline-documented; PDF pages: 8, 9.

Required/listed structure: content [identifier]: reference marker; matching scrollpane content artboard; referenced content group/frame.

Optional/alternate structure: component frame; scrollVertical/bar; scrollVertical/rail; scrollHorizontal/bar; scrollHorizontal/rail; content background.

- Content artboard name must match scrollpane component name; resolve content identifier.

### countdown

Evidence: guideline-documented; PDF pages: 9, 10.

Required/listed structure: No unconditional child requirement established.

Optional/alternate structure: clock-content groups; slot [day|hour|minute|second]/textStyle; slot/frame; content without clocks.

- Slots optional; frame is important for roll theme.
- Target date behavior not sufficiently specified for automatic source validation.
- Do not infer mandatory slots or state visibility.

Template example: `sample/basetemplates/hotspot.zip` → `428x622/tabComponent/tab1/CanvasDesign/countdown`.

### dynamicCopy

Evidence: guideline-documented; PDF pages: 12.

Required/listed structure: data/filename.json marker; default group with text layers; frame: rectangle shape.

Optional/alternate structure: background.

- Preserve $token$ syntax.
- Use paragraph text boxes for auto-fit bounds.
- Token text disables pixel-perfect positioning; do not misclassify expected runtime copy changes as PSD mismatch.

### productGallery

Evidence: guideline-documented; PDF pages: 12, 13.

Required/listed structure: No unconditional child requirement established.

Optional/alternate structure: arrows; slideProgress; data; grid; error; css.

- Record dataInput/dataUrl/dataFile or raw data with dataCook; dataCreate may supply generated data.
- Grid markers define layout, cell size, centering and gap; required combinations are not fully specified.
- HTML/CSS/data-cook layers are configuration evidence only; do not execute during validation.
- Guide does not explicitly specify slideN/root frame for this profile; do not import RM requirements automatically.

### categoryGallery

Evidence: template-observed; PDF pages: not covered.

Required/listed structure: home: group; categoryN: groups; frame: shape.

Optional/alternate structure: navBar; arrows; slideProgress; categoryN/slideN.

- Template-observed only; absent from supplied PDF. Do not impose flat slideN root states.

Template example: `sample/basetemplates/categoryGallery_Map.zip` → `428x622/tabComponent/tab2/categoryGallery1`.

### dotterGallery

Evidence: template-observed; PDF pages: not covered.

Required/listed structure: productTemplate: group; frame: shape.

Optional/alternate structure: noData; arrows; dots; slideProgress.

- Template-observed only; absent from supplied PDF. Data-driven, no authored slideN requirement.
- Feed presence/schema must be verified separately.

Template example: `sample/basetemplates/dottergallery.zip` → `428x622/tabComponent/tab2/dotterGallery1`.

### ctvOtt

Evidence: guideline-documented; PDF pages: 2, 3.

Required/listed structure: artboard type ctv|ott|ctvott with _HD|_FHD quality; supported theme group; video/filename marker.

Optional/alternate structure: Screen1 peelLogo; Screen2 background/foreground; Screen3 QR assets; qrCodeConfig/brandingLogo; qrCodeConfig/colorCode; qrCodeConfig/url; pharma disclaimer; custom/video.

- Use documented theme names; retain template aliases as observed until export-verified.
- Pharma disclaimer is pixel/Smart Object inside theme.
- Scene timing and runtime selection remain unverified.

## Implementation boundary

The JSON stores required/listed roles and conditional checks in descriptive form; it is not yet an executable validator. Compile these into typed path/type/cardinality rules only after resolving optionality and alias conflicts. A missing role should not be silently repaired. Report rule, owner, full path, evidence and exporter version.

Machine registry: [authoring-contracts.json](authoring-contracts.json). Full trees: [template-layer-trees.md](template-layer-trees.md).
