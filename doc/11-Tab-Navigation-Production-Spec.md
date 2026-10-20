# Tab Navigation — Production Specification

## Purpose

This document records the production behavior used by Turbo tab navigation and the rules the local preview must reproduce. It is based on the `tab-menu.md` component notes, the production `vdx-components-turbo.js` CSS/runtime behavior, live production DOM measurements, and the Ipsen `export.json` package.

The specification applies to horizontal three-tab menus, horizontal two-tab menus, narrow vertical menus, and creatives with no tabs.

## 1. Source geometry and ownership

- The master `tabButtons/frame` owns the reusable tab labels, active/normal visual styles, and pill geometry.
- Each ad-size artboard owns a `tabButtons` placeholder. The placeholder supplies the menu's position and available frame size; it is not a rasterized tab image.
- The per-size `navigation_bottom_border` is an independent full-width divider. It is aligned to the bottom edge of the per-size `tabButtons` placeholder.
- The runtime maps the master tab content into the per-size placeholder. The placeholder's exported `left`, `top`, `width`, and `height` are authoritative; it must not use one hard-coded width or inferred position for every creative or every ad size.
- A horizontal placeholder is rendered horizontally. A narrow/tall placeholder such as 160×600 is rendered by rotating the same horizontal menu `-90deg`.

## 2. Production horizontal menu geometry

The production menu has a 28px outer frame and a 22px tab wrapper:

| Element | Production rule |
|---|---|
| Outer menu | `display:flex; justify-content:center; align-items:flex-end; pointer-events:none` |
| Outer menu height | 28px |
| Wrapper direction | `row` |
| Wrapper alignment | `align-items:flex-end` |
| Wrapper flex | `0 1 auto` |
| Wrapper gap | 24px |
| Wrapper height | 22px |
| Wrapper padding | `0 18px` |
| Wrapper box sizing | `content-box` |
| Wrapper overflow | `visible` |
| Trigger height | 22px |
| Trigger flex | `1 1 auto` |
| Trigger width | `auto`; intrinsic to the rendered title and flex layout |
| Trigger overflow | `visible` |

The wrapper alignment follows the exported placeholder anchoring. A right-pinned placeholder, where `left + width = artboard.width`, uses `flex-end`; a left-pinned full-width placeholder uses `center`. This is important when the natural wrapper, including its 36px horizontal padding, is wider than the placeholder. Applying one global alignment produces the visible Ipsen mismatch between 970×250/728×90 and 300×250/300×600. The outer menu width is always the current artboard's exported `tabButtons.width`; measured widths such as Vonjo 251px and Pure 178px are observations, not constants.

### Pill shape

Each pill is a child of its trigger and is intentionally wider than the title:

```css
left: -20px;
width: calc(100% + 40px);
height: 200%;
border-radius: 22px 22px 0 0 / 100% 100% 0 0;
clip-path: inset(0 0 50%);
```

The trigger uses the production shadow:

```css
filter: drop-shadow(0 -2.5px 1.5px rgba(0, 0, 0, .2));
```

The title is live text with `line-height:24px`, `white-space:nowrap`, and `width:max-content`. Font family, size, weight, color, and fill colors come from the package's master tab styles; they must not be globally replaced with a campaign-specific font or size. The exported title font size is authoritative for every creative and for both active and normal states.

## 3. State and stacking behavior

- The selected tab receives `active` styling and z-index `3`.
- Normal tabs are stacked in source order behind the active tab. For three tabs their z-indices are `2`, then `1`; for two tabs the normal tab is `1`.
- Active and normal states may use different fill and text colors, but the geometry remains shared.
- Labels are sourced by tab number. Borrowed state templates supply visual styling only; their original text runs must not leak into another tab's label.
- Tab order is the authored/runtime tab order, not alphabetical order.
- Clicking a tab changes the selected tab content while preserving the menu's position and geometry.

## 4. Two-tab and three-tab behavior

The same production layout rules apply to both counts. The menu width is resolved per creative/per size from the actual placeholder and flex layout; it is not a universal constant.

### Three tabs

The Vonjo production measurement is a useful reference:

- Outer menu: `251×28px`.
- Wrapper: `215px` content width plus `18px` left/right padding.
- Gap: `24px`.
- Trigger widths: approximately `40.203px`, `69.063px`, and `57.734px`.
- Production inspection measured the rendered title at approximately 13px in this capture, but the preview must still use the Vonjo title size from `export.json`; live inspection must not become a hard-coded campaign override.

### Two tabs

Pure Encapsulation production measured an outer menu of `178×28px`, with the same 24px gap and 18px horizontal padding. The two-tab menu must therefore remain naturally sized; it must not be forced to the three-tab width.

## 5. Ipsen 300×250 and 300×600 reference

The Ipsen package has a 300px-wide horizontal `tabButtons` placeholder for both sizes:

| Artboard | Placeholder | Divider |
|---|---:|---:|
| 300×250 | left 0, top 219, width 300, height 28 | top 247, height 3 |
| 300×600 | left 0, top 849, width 300, height 28 | top 877, height 3 |

Ipsen 970×250 and 728×90 placeholders are right-pinned to their artboard edges, so their production wrapper is right-aligned. Ipsen 300×250 and 300×600 placeholders start at the left edge and use centered wrapper alignment.

The live 300×600 production DOM measured:

- Outer menu: `x=0, y=569, width=300, height=28`.
- Wrapper: `x=-5.640625, y=575, outer width=311.2890625`; computed content width `275.289px` plus 36px padding.
- Titles: Video `31.8359px`, Impact of Fatigue `96.9063px`, Assess Symptoms `98.5469px`.
- Trigger heights: 22px; title line-height: 24px.
- The wrapper is centered, so its intentional 5.64px overhang is split across both sides.

The 300×250 menu follows the same 300×28 placeholder geometry and must be centered in that frame. The local preview must not right-align this menu or shrink the title row to an arbitrary campaign width.

## 6. Narrow, mobile, and no-tab creatives

### 160×600 and other narrow-tall sizes

- If `tabButtons.height > tabButtons.width`, use the same horizontal tab geometry and rotate the menu `-90deg`.
- Solve the pre-rotation box from the final placeholder bounds; do not squash the horizontal menu into the narrow width.
- Preserve title order and pill overlap through rotation.

### Mobile Expandable

- Mobile Expandable creatives do not render a tab menu.
- Their tab content is presented as one long scrollable page, with navigation performed by page scrolling/jump controls where authored.

### No-tab creatives

- If the package has no authored tab order or no valid tab component, render no `.vdx-menu`, no tab triggers, and no synthetic tab pills.
- Do not invent a single-tab navigation bar for a creative that has no tab navigation.
- The artboard content and any independent authored controls remain unchanged.

## 7. Validation checklist

For every package and ad size, verify:

- [ ] The menu exists only when tabs exist and is omitted for no-tab/Mobile Expandable cases.
- [ ] Horizontal menus use the per-size placeholder position and width.
- [ ] Wrapper alignment is derived from exported anchoring: right-pinned placeholders use `flex-end`; left-pinned full-width placeholders use `center`.
- [ ] The wrapper uses 24px gaps, 18px horizontal padding, 22px height, and visible overflow.
- [ ] Pills use 20px side overhang and the production elliptical top radius.
- [ ] The active tab is z-index 3; normal tabs descend behind it.
- [ ] Two-tab menus are naturally sized and are not forced to three-tab dimensions.
- [ ] 300×250 and 300×600 Ipsen tabs sit on the bottom edge of their 28px placeholder and align with the divider.
- [ ] 160×600-style menus rotate `-90deg` without reversing tab order.
- [ ] Labels use the exported package font family, font size, weight, color, tracking, and tab-number text; no borrowed `runs`, fallback font, or campaign-specific override changes the layout.

## 8. Known evidence boundary

The exact geometry above is production-verified for Vonjo, Pure Encapsulation, and Ipsen 300×600, with Ipsen 300×250 placeholder coordinates confirmed from its `export.json`. Other campaigns may legitimately use different fonts, colors, label widths, or resolved outer widths while still following the same component rules.
