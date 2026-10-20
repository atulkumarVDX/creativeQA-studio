# Turbo QA layout-audit rule catalog

This catalog is the implementation contract for the proposed automated layout audit. A rule is not considered covered until it has: a stable ID, a measurable input, an expected value or comparison target, a tolerance, a severity mapping, an exception policy, and inspectable evidence in the UI.

## Source geometry

| ID | Check | Measurement | Default outcome |
|---|---|---|---|
| GEO-001 | Authored bounds | Rendered x, y, width and height versus PSD/artboard bounds | Warning beyond tolerance; error when materially displaced |
| GEO-002 | Edge alignment | Left, right, top and bottom edges against approved peers or guides | Warning |
| GEO-003 | Center alignment | Horizontal and vertical center delta against artboard or container | Warning; error when visibly outside container |
| GEO-004 | Gutters and spacing | Distance to artboard edges and related layers | Warning |
| GEO-005 | Bounds containment | Clipping or overflow beyond the artboard/container | Error |
| GEO-006 | Unrelated overlap | Intersection area between unrelated visible layers | Error when material; warning when near tolerance |
| GEO-007 | State bounds consistency | Bounds across tabs, slides and equivalent component states | Warning |

## Copy relationships

| ID | Check | Measurement | Default outcome |
|---|---|---|---|
| TYPE-001 | Shared copy edge | Heading, eyebrow, subheading and body-copy edge deltas | Warning |
| TYPE-002 | Copy-stack spacing | Vertical gaps between related text blocks versus approved scale | Warning |
| TYPE-003 | Copy-to-canvas alignment | Text-block edges and centers against artboard gutters/guides | Warning |

## CTA typography and container alignment

| ID | Check | Measurement | Default outcome |
|---|---|---|---|
| CTA-001 | Vertical ink centering | Visible glyph center versus button-frame center | Warning beyond tolerance; error outside frame |
| CTA-002 | Horizontal ink centering | Visible glyph center versus button-frame center | Warning beyond tolerance; error outside frame |
| CTA-003 | Line-box centering | CSS/PSD line box versus button-frame center | Warning |
| CTA-004 | Line-height risk | Explicit leading, `normal`, zero or unusually large line-height | Warning or info when intentional |
| CTA-005 | Baseline shift and text mode | Non-zero baseline shift; paragraph text where point text is required | Warning |
| CTA-006 | Dormant stroke risk | Disabled/exported frame stroke changing the runtime inner box | Warning |
| CTA-007 | CTA-to-nearby-copy alignment | CTA/frame edge or center versus the approved relationship to adjacent heading, sub-copy or body copy | Warning |

## Reference symbols and legal copy

| ID | Check | Measurement | Default outcome |
|---|---|---|---|
| REF-001 | Symbol edge clearance | Symbol bounds versus container/artboard edge | Warning; error on collision |
| REF-002 | Symbol baseline and scale | Symbol baseline/size versus approved reference style | Warning |
| REF-003 | Hanging indent | Wrapped-line start versus intended copy start | Warning |
| REF-004 | Marker-to-copy gap | Distance between marker and first copy glyph | Warning |
| REF-005 | Direction and state consistency | Indents across LTR/RTL, sizes, tabs and slides | Warning |

## Logo clearance

| ID | Check | Measurement | Default outcome |
|---|---|---|---|
| LOGO-001 | Edge clearance | Independent top/right/bottom/left distance to artboard edges | Warning |
| LOGO-002 | Neighbour clearance | Nearest distance to text, CTA, logos, icons, legal and controls | Warning; error on overlap |
| LOGO-003 | Safe-area policy | Fixed pixels, percentage of logo size, or authored safe-area guide | Warning |
| LOGO-004 | Edge-pinned exception | Explicit approved exception with reason and scope | Info |

## Presentation geometry

| ID | Check | Measurement | Default outcome |
|---|---|---|---|
| PRE-001 | Card gap consistency | Gaps between preview cards | Warning |
| PRE-002 | Stage padding and section alignment | Stage/section inset and shared edges | Warning |
| PRE-003 | Label-to-artboard alignment | Label edge/center versus artboard | Warning |
| PRE-004 | Comparison-row alignment | Row baselines, tops, bottoms and column starts | Warning |
| PRE-005 | Wide-bento breakpoint | Layout before, at and after the approved breakpoint | Error when cards overlap; warning for drift |
| PRE-006 | Mobile stacking | Ordering, spacing and overflow at mobile widths | Error for overlap/clipping; warning for spacing |
| PRE-007 | Mobile scale accuracy | Mobile-instream and 428x622 fit/original scale | Warning; info for approved showcase scaling |
| PRE-008 | Sticky offsets | Toolbar/control-panel top offsets after font load and resize | Error for obstruction; warning for drift |

## Visual regression and state coverage

| ID | Check | Measurement | Default outcome |
|---|---|---|---|
| VR-001 | Fixed viewport matrix | 970x546, 970x250, 428x622, 300x600, 300x250 and 728x90 | Error/warning by affected rule |
| VR-002 | Responsive viewport matrix | Approximately 375px, 720px and 1440px+ widths | Error/warning by affected rule |
| VR-003 | Deterministic capture readiness | Fonts, images, render cycle and layout observers settled | Error when capture is unreliable |
| VR-004 | Baseline visual comparison | Current capture versus last approved baseline | Review required |
| VR-005 | State traversal | Every valid artboard, tab, slide and supported state | Error when a required state cannot render |
| VR-006 | Approved exceptions | Runtime copy, intentional scaling and documented dynamic regions | Info, excluded from blocking result |

## Finding contract

Every finding must expose:

- Rule ID and category
- Artboard, tab, slide/state and layer identity
- Expected value, actual value, signed delta and tolerance
- Error, warning or info severity
- Evidence geometry used by the overlay
- Likely cause and recommended source fix
- Exception status and reason, when applicable
- Baseline/current capture references for visual-regression findings

Default severity policy:

- **Error:** outside the artboard/container, material unrelated overlap, required state failed, or content obstructed.
- **Warning:** measurable delta exceeds the configured tolerance.
- **Info:** approved or expected exception, dynamic/runtime content, or non-blocking production risk.
