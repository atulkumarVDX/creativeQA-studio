# 15 — Mobile Expandable Production Behavior

**Status:** Evidence-backed parity contract
**Observed build:** Turbo Preview `7.9.11`
**Observed:** 2026-10-14 (Asia/Kolkata)
**Implementation build:** Turbo Preview `7.9.11`, validated 2026-10-14
**Production references:** supplied live mobile-expandable ad (`mediaDataID=14185590`), production component bundle `3.13.11-8`, and `vdx-container-turbo.js` `3.13.8-0`
**Package evidence:** Tryngolza, Ipsen, TRYPTYR and Alprolix, plus the earlier Vonjo expanded-main-unit inspection
**Current scope:** Expanded main unit only. The teaser/collapsed placement is
out of scope and must remain unchanged.

This document separates the Photoshop-authored canvas from the production
viewport and records the behavior that the preview must reproduce. It is a
parity contract, not a claim that the current preview is already 100% matched.
The production reference was inspected in a browser at the URL above; the
latest source package supplied for comparison is:

`/Users/atul/Library/CloudStorage/Box-Box/WikiFolders/Client/Vertical/Pharma/Pharma RX/Brands/VONJO/United States/Client Creative Assets/Creative/51465_Sobi_Vonjo_HCP/Production_V1/design.psd.zip`

## 1. The two coordinate systems

| Concern | Photoshop/export | Production mobile expandable |
|---|---:|---:|
| Authored artboard | `428 × 622` | not used as the browser viewport |
| Creative viewport | source canvas | expanded `428 × 622` or clipped `375 × 622` |
| Horizontal behavior | authored coordinates | responsive leaf layout into 375 px |
| Vertical behavior | authored y positions | qualifying direct sibling branches inherit the resized video's single height delta; unrelated structures retain authored flow |
| Browser-window resize | must not rescale the artboard | the creative remains 375 px wide; the page may scroll to expose it |

The 428 px source is not a license to uniformly scale the whole creative. The
inspected production state uses a 375 px mobile viewport and adapts selected
leaves, containers, media, and pinning relationships inside it. Turbo must
expose `375` (small production view) and `428` (large/authored view) as
explicit choices; one must never be silently substituted for the other.

The large `428×622` behavior is a real production expanded main-unit state.
The Showcase may start from a collapsed `300×250` teaser, but that teaser is
out of scope for the current parity work and must remain unchanged. The
`375×622` device view is the expanded main unit clipped by the narrower
viewport, not a separately authored 375 px canvas.

## 2. Production frame and clipping contract

For the inspected `375×622` production state, the DOM has this effective
containment chain:

```text
Showcase page
└─ demopage iframe                 375 × 622
   └─ #adRootContainer_12080725    fixed 375 × 622, overflow hidden
      └─ #adRootIframe_12080725    375 × 622, overflow clipped
         └─ creative body           375 × 622, overflow hidden
```

The same host can embed a smaller production creative. In the inspected
`300×600` mobile state, the outer host iframe remains `375×622`, while the
inner ad root and creative body are `300×600`; the clipping contract applies
at the inner creative dimensions.

Consequences:

1. The creative is clipped at x=`0..375` and y=`0..622`.
2. Content outside that rectangle is not reflowed into a taller page and is
   not horizontally scrolled by the creative itself.
3. A narrow desktop/browser window must not change the creative's intrinsic
   dimensions. The host may provide horizontal scrolling around it.
4. Overflow from stacked entries, media, and authored backgrounds is expected
   at state boundaries; it is not evidence of a missing asset by itself.

## 3. Mobile expandable stack and state lifecycle

Production uses a vertical `.vdx-stack` of entries. In the inspected state:

- stack width is `375`;
- an entry is approximately `375 × 436`;
- the active entry is positioned at y=`186`;
- neighboring inactive entries appear at y=`-220` and y=`622`;
- the root main-unit is taller than the viewport and is clipped by the fixed
  ad root.

The negative-y entry is normal stack/timeline positioning, not proof that the
video was cropped incorrectly. The selected tab/slide and the timeline/hash
state determine which entry is active. A preview state must therefore record
both the selected creative state and the viewport mode; a screenshot without
those two identifiers is not a reproducible parity check.

### Expanded-state finding from the live Showcase creative

The supplied Showcase creative exposes a collapsed teaser that can open the
main unit. Clicking it in the emulated `428×622` browser viewport expanded the
main unit to a full `428×622` production creative. The expanded DOM measured:

- expanded iframe/body: `428×622`, overflow hidden;
- root main unit: `428×1494`, overflow hidden;
- close control: `20×20` at x=`398`, y=`10`;
- active content entry: `428×436` at y=`186`;
- neighboring entries: y=`-250` and y=`622`;
- video: `428×240.75` at x=`0`, `object-fit: contain`.

The available separate in-page mobile `300×600` entry is a different
production placement (the inspected routes changed to hash states `/12` and
`/15`). Its measured behavior remains:

- body/root viewport: `300×600`, overflow hidden;
- video: `300×168.75` (16:9), x=`0`;
- video container: `300×500`, x=`0`, y=`100`;
- video element: y=`265.625`, `object-fit: cover` in that state.

This `300×600` placement is different from the expanded mobile expandable
state and must not be substituted for it in parity checks.

### Current production finding (`375×622` after expansion)

The supplied live mobile-expandable ad loaded component bundle `3.13.11-8`.
At `375×622`, its full-width authored video was resized from approximately
`428×241` to `375×211.16`. Production then moved each direct sibling branch of
the video upward by the rounded video-height difference. In the measured state,
the following `CanvasDesign` branch began at the resized video bottom, so no
blank band remained between media and content.

Production performs this at the branch level. Nested copy, CTA, disclosure,
background and control leaves follow their owning branch without receiving an
independent offset. A structure without the qualifying direct sibling
relationship is not shifted. This finding supersedes the earlier inference
that production kept a 428px-wide video and merely clipped it at 375px.

## 4. Responsive geometry rules

Responsive behavior applies to leaves and their owning layout frames while
preserving the authored composition's center pinning.

### 4.1 Full-width elements

Background bands, tab strips, safety-information bars, and other design
elements remain on the authored 428px coordinate system and shift together by
half the width delta in the 375px host. Their authored height is preserved
unless the component has an explicit responsive height rule.

### 4.2 Pinning

- all ordinary non-video design elements are center-pinned and shift by half
  the width delta: `(428 - 375) / 2 = 26.5px`;
- circular bars select a left, center or right anchor from their authored
  position: a centered control stays centered with contained media, while an
  edge control preserves its edge gap (a right-pinned control shifts by 53px);
- siblings that form one visual cluster (copy, accent bar, icon, and CTA) must
  use the same responsive frame so their authored gap is preserved;
- do not pin individual siblings independently when Photoshop shows them as a
  single aligned cluster.

### 4.3 Text

Text line breaks, hard returns, indentation, capitalization, tracking, and
paragraph alignment are authored content/style. Responsive width may change
where a line wraps, but it must not silently change paragraph alignment to
justified, insert hyphenation, or discard an explicit break. Those are separate
text-rendering findings and should be reported rather than “corrected” by
mobile layout code.

### 4.4 Vertical flow after full-width video

When a production tab contains a left-aligned, full-width video as a direct
child, resize the video first and calculate:

```text
videoFlowDelta = round(responsiveVideoHeight - authoredVideoHeight)
```

Apply `videoFlowDelta` once to every direct sibling branch of that video. The
video branch itself receives no vertical delta. Descendants keep their authored
local coordinates relative to the shifted branch, so the branch moves as one
unit and internal spacing remains unchanged.

Do not identify affected leaves by comparing each leaf's top with the resized
video bottom. That threshold approach can split one visual cluster when some
children start above the boundary and others start below it. Do not apply this
rule to contained video, unrelated branches, or layouts without the qualifying
direct-child structure.

## 5. Video behavior (measured production evidence)

The supplied 428×622 source contains a video/frame region at local bounds
`x=0, y=186, width=428, height=241` (16:9). Production measured:

| Property | Measured value |
|---|---:|
| video width | `375px` |
| expected proportional height | `241 × 375 / 428 = 210.94px` |
| measured container height | approximately `211.16px` |
| horizontal position | `x=0` |
| viewport clipping | enabled |

Therefore the responsive media rule is:

```text
responsiveVideoWidth  = 375
responsiveVideoHeight = sourceVideoHeight × (375 / 428)
```

The production player exposes a video container and an inner video element.
The expanded state uses `428×240.75` media with `object-fit: contain`; the
separate collapsed/300×600 placement measured `object-fit: cover`. The preview
must capture the actual component/state style rather than assuming one
universal object-fit value.

### Turbo implementation

The preview responsive path applies the measured production media rule: the
video is rendered at `375px` wide with proportional height
(`241 × 375 / 428 = 211.16px`), positioned at `x=0`, and clipped by the
375px host viewport. The 428px authored view retains the original media
dimensions.

After resizing a qualifying full-width video, Turbo mirrors the production tab
component by applying the rounded height delta to the video's direct sibling
branches. For a 241px source video, the responsive height is approximately
211.16px and the branch delta is `-30px`. The branch wrapper and its descendants
resolve to one effective movement; descendant-local gaps are not compressed or
shifted a second time.

Contained video does not scale to 375px. It retains its authored dimensions and
uses the same left/center/right anchor as other leaves, keeping a centered video
and its centered circular control on x-center 187.5.

## 6. Controls and overlays

The production video component has a wrapper, an inner player, and an overlay
layer. In the inspected state:

- poster/sound/replay controls are hidden by the video component's CSS path;
- the unmute/sound affordance remains as an overlay;
- controls are positioned relative to the responsive video/frame, not the
  original 428 px canvas;
- z-index and clipping belong to the video component's containing frame.

Turbo should compare the computed style of the selected state, not only the
PSD layer name. A control that is absent because the production component
intentionally hides it is different from a control that failed to render.

## 7. Preview modes and resize policy

The preview must maintain these distinct modes:

1. **Production/mobile-expandable-expanded mode:** viewport/creative is
   `428×622`; this is confirmed by the live expansion interaction.
2. **Production/mobile-expandable-responsive mode:** viewport is `375×622`;
   responsive leaves and media follow the rules in §4–§5 while the authored
   428px stage remains the source coordinate system and the host clips overflow.
3. **Authored/source mode:** source geometry is shown without responsive
   substitution.
4. **Browser-window resize:** neither expanded mode changes its intrinsic artboard
   dimensions. A smaller browser window may reveal less of the fixed artboard,
   but must not compress, stretch, or reflow it.

### Local preview interaction policy

The local preview does not implement the production stack's internal scroll
interaction. The expanded `428x622` artboard is clipped to its preview viewport,
and alternate content is selected through the same tab buttons used by the
other artboards. Tab selection must not be replaced with a scrollable creative
or an internal vertical scroller.

The current fixed-artboard preview change follows this policy: the browser
viewport can scroll around the artboard instead of making the artboard itself
responsive.

In focused Preview, tab and slide controls are scoped to the selected artboard;
this prevents unavailable global-union states from producing blank creatives.
Compare mode may aggregate the states of all included artboards. The ISI frame
is a responsive component inside the clipped host: x=0, width=375, with its
content scrolling vertically. Vertical video reflow follows §4.4: shift the
qualifying sibling branch once, never individual leaves selected by a boundary
test.

## 8. Parity checklist for every mobile expandable state

Before calling a state production-matched, verify all of the following:

- [ ] viewport is identified (`428×622` expanded production, `375×622`
      responsive production, or `428×622` authored source);
- [ ] tab, slide, and hash/timeline state are recorded;
- [ ] active and neighboring stack entries have the expected positions;
- [ ] root and iframe clipping are `375×622` in production mode;
- [ ] edge-to-edge bands use x=0 and width=375;
- [ ] left/right/center pinning follows the rules above;
- [ ] responsive clusters preserve authored sibling gaps;
- [ ] video width and proportional height are measured, not guessed;
- [ ] each qualifying direct sibling branch receives exactly one rounded video-height delta;
- [ ] descendants preserve their local positions inside the shifted branch;
- [ ] contained video and unrelated structures receive no video-flow delta;
- [ ] the video/content seam has no positive blank gap after browser subpixel rounding;
- [ ] object-fit is checked from the selected production state;
- [ ] overlays, controls, and z-index are compared inside the same frame;
- [ ] text alignment, hard returns, indentation, capitalization, and line
      wrapping are checked separately from geometry;
- [ ] a browser resize test confirms the artboard does not scale;
- [ ] large-production measurements are captured separately from small-
      production measurements;
- [ ] screenshot and DOM measurements are both captured for regressions.

## 9. Required regression fixtures

The test fixture for this behavior should contain at least:

- the Vonjo `428×622` source artboard;
- a `375×622` responsive render of the same tab/slide;
- one state with an active entry and neighbors above/below the viewport;
- one edge-to-edge video at source bounds `428×241`;
- one direct sibling content branch immediately following that video;
- one nested child cluster proving that descendant spacing is unchanged;
- one unrelated or contained-video structure proving that no delta is applied;
- one right-pinned navigation cluster;
- one text cluster with an explicit hard return and a non-justified paragraph;
- screenshots at normal width and at a browser width narrower than 375 px.

Acceptance is based on measured geometry and clipping, not visual similarity at
one zoom level. “100% matched” should only be claimed after the responsive DOM,
computed styles, and screenshots agree for every tab/slide state in the fixture.

## 10. Evidence limits and future parity work

The production inspection establishes the expanded `428×622` viewport, the
responsive `375×622` host, state-specific video sizing, and direct-sibling
vertical flow. It does not prove that every creative uses identical component
CSS or that every state uses the same object-fit value. Apply the sibling-flow
rule only when the exported structure supplies its qualifying relationship;
otherwise preserve the authored structure and report the state as unverified
when production evidence is unavailable.

Future parity work should continue to test the full expanded tab/slide matrix
at both 375px and 428px, then re-check fixed-artboard behavior under a narrow
browser window. Do not alter the teaser placement while doing so.

## 11. Implementation requirements and remaining parity work

These are the implementation changes required before claiming expanded-main-unit
parity. The teaser/collapsed placement is explicitly excluded from this list
and must not be changed.

### P0 — expanded-state model

1. **Add the expanded close control.** Render a `20×20` close control at the
   top-right (`x=width−30`, `y=10`) in both `428×622` and `375×622` expanded
   states, with the production z-index and hit area.
2. **Use the correct expanded canvas width.** At `428×622`, render the
   expanded artboard at 428 px. At `375×622`, use the 375px responsive host
   and preserve the authored coordinate system for non-media content.

### P0 — media parity

4. **Separate media rules by state.** Expanded media is `428×240.75` at
428px and `375×211.16` in the responsive expanded host, with
   `object-fit: contain`; the separate `300×600` placement measured
   `300×168.75` with `object-fit: cover`. Remove the unconditional preview
   `object-fit: cover` for expandable media.
5. **Preserve the production video/frame relationship.** Keep the video at
   the authored y position, scale its height proportionally with its responsive
   width, then apply the rounded height delta once to every qualifying direct
   sibling branch. Preserve descendant-local coordinates and do not use a
   per-leaf boundary test.

### P1 — stack and clipping parity

6. **Represent the production stack lifecycle.** Maintain active and neighbor
   entries at the measured positions (`y=-250`, `y=186`, and `y=622` for the
   expanded state), with root height approximately `1494` and body overflow
   hidden.
7. **Keep viewport clipping at the correct owner.** Clip at the expanded ad
   root/body, not by shrinking children until they fit. The 375 px state is a
   clipped view of the expanded state.
8. **Keep browser resizing independent.** A browser narrower than the creative
   must scroll or crop the host view; it must not change the authored artboard
   dimensions or silently select the 375 responsive layout.

### P1 — content and controls

9. **Match the expanded ISI/indication flow.** Preserve the production root's
   tall content area and its internal ISI scrolling behavior; do not flatten it
   into a single static artboard screenshot.
10. **Keep overlays state-aware.** Position sound, replay, navigation, and close
    overlays relative to the active expanded entry and viewport. Hidden
    production controls must remain hidden, while visible controls must not be
    lost during clipping.

### P2 — validation and reporting

11. **Add expanded-state fixtures.** Cover expanded `428×622` and expanded
    clipped `375×622`; include screenshots and DOM geometry for each. Keep the
    existing teaser fixture unchanged.
12. **Report unsupported state mappings.** If a package has no production
    compiled fixture for a state, mark it as unverified instead of declaring
    full parity from the authored PSD alone.

## 12. Build 7.9.11 implementation validation

Build 7.9.10 established the global responsive ISI, horizontal pinning,
control anchoring and focused-state rules. Build 7.9.11 corrects its incomplete
vertical rule using the production sibling-flow behavior.

Live 375×622 DOM measurements covered Tryngolza, Ipsen, TRYPTYR and Alprolix.
Tryngolza, Ipsen and TRYPTYR each produced a `-0.156px` video/content seam,
which is the expected browser subpixel overlap rather than a visible gap.
Alprolix lacks the qualifying following sibling branch and retained its authored
approximately `16.8px` internal content spacing. This negative case confirms
that the rule does not move unrelated structures.

The complete automated suite passes 116/116 tests. TypeScript checks, the
production build and lint complete with zero errors. Regression coverage
asserts the branch-level delta, unchanged descendant spacing, and the exclusion
for unrelated branches. The user accepted the four-package result on
2026-10-14.
