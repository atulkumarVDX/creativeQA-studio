Structure QA executes an initial subset of the existing advisory registry.

The preview parser and validator now share `buildStructureIndex` from
`render-tree.js`. Source records retain identity, ancestry, order, visibility,
absolute bounds and parent-relative bounds independently of selected state.
Painting mounts selected elements inside source group containers. Ordinary
groups use their finite exported bounds, and children are positioned relative
to their parent while preserving their artboard placement. Document-wide group
bounds are retained with visible overflow; missing bounds inherit the parent
origin. Group effects are not inferred. CTA groups with one direct frame and live text promote that frame into
the container and rebase descendants into its coordinates. Disabled strokes
remain disabled. No authoring rules or source layers are changed.

After changing rendering helpers, run
`node scripts/structure/embed-render-tree.mjs`. Run
`node --test tests/structure/*.test.mjs tests/screenshot/capture.test.mjs`
to verify both embedded engines and capture regressions. Masks, group blending,
component clipping and runtime mappings still require matched evidence.

Implemented: LS-013 CTA naming/direct frame/background contract; LS-007 duplicate direct frame shapes on matched frame-derived profiles; LS-005 duplicate state keys at registered state paths; LS-008 required direct RM Gallery frame from the existing authoring contract; LS-004 review for unregistered names in recognized component families. LS-002 exclusion handling preserves audit nodes and skips excluded subtrees, while auditing saved hidden states.

No registry or authoring contract is modified. Recommended/template child paths are not interpreted as universal requirements. Missing runtime mappings and remaining authoring checks are reported as unchecked. CTA structural mounting is verified against supplied label-offset and frame-size evidence; full visual parity remains unverified.

Expanded contract coverage: literal required roles and typed direct children are checked only for profiles selected by the existing registry. These include Map roles, Dotter productTemplate, Category home/categories, Static Product frame/slides, nested Tabs root frame/targets/triggers, Color Picker triggers/trigger frames, Hotspot slide frames/close buttons, and comparison before/left and after/right alternatives. Optional RM slide frames are compared with the root frame when both provide finite exported bounds. Rectangle versus ellipse subtype is explicitly unchecked when only layerKind is available.

The internal coverage inventory retains all 22 contracts. Package coverage shows only profiles with selected instances and their executed requirements. Unselected profiles are counted under Validator limitations rather than presented as unchecked package structures. Inherited structures, free-form identifier aliases, reference resolution, data feeds, timing, full shape subtype validation and runtime behavior are not silently inferred from descriptive requirements. Coverage remains incomplete.

The expanded suite has 33 passing tests, including accepted alternative structures, required-child ownership, template-observed review severity, excluded subtrees, incomplete-result reporting and screenshot regressions. Browser visual verification of the expanded coverage UI has not been performed because local file navigation was blocked earlier by browser policy.

The standalone HTML embeds the current registry, authoring contracts and engine for offline use. After changing the engine or the separately maintained registry/contracts, run `node scripts/structure/embed.mjs`. Verify with `node --test tests/structure/validator.test.mjs tests/screenshot/capture.test.mjs`.

Coverage is tracked separately from findings. If checks ran and emitted no findings, the summary says "No issues detected in executed checks". Empty or unsupported packages say "No supported structural checks ran for this package". Actual unknown components remain review findings. Partial implementation and runtime limits appear under Validator limitations; neither zero findings nor completed scanning certifies full package validity.

Navigation prototype regression: the supplied 68-layer export produces four LS-008 missing RM root frame warnings (IDs 6, 27, 42, 61) and two LS-004 unknown nested-component review items (IDs 11, 47). Slide frames remain optional, and Map/Dotter requirements are not inferred from RM rules. All 27 structure and capture tests pass.

Browser smoke test: a synthetic package with button0, no direct frame, and a misnamed Smart Object background produced three LS-013 warnings. Clicking its background finding opened the artboard/state and highlighted the image. Structural groups without rendered elements show a location message. Real production CTA parity and full browser screenshot export were not evaluated in this milestone.

Reporting correction verified by 36 passing structure/capture tests: executed scope, unsupported packages, hidden unselected profiles, separate validator limitations and preserved unknown-component reviews. No validation requirement was removed or relaxed.
