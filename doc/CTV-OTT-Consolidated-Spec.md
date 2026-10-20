# CTV/OTT preview — consolidated design and technical specification

**Current implementation:** Turbo QA Studio 7.11.16 · 2026-10-18.  
**Authority:** This document describes the local FFmpeg preview, not every publisher or After Effects delivery workflow. The implementation is `scripts/ctv-ott-renderer.mjs`, `scripts/preview-stack.mjs`, `app/page.tsx`, `vite.config.ts` and `preview/current-preview.ts`.

## Scope and source priority

QA Studio renders CTV/OTT as a separate local video preview. The uploaded export ZIP supplies **all creative media**: video, scene imagery, peel, logo, disclaimer, QR, CTA, tagline and scan anchor. No template footage, default video, hardcoded brand asset or generated replacement QR is permitted. The supplied After Effects project and QR-composition JSON provide motion, timing, geometry and effects *references only*. FFmpeg performs the render; After Effects is not needed at runtime. The result is a QA teaser, not a guaranteed pixel-identical AE or publisher export.

Reference material, relative to the workspace parent:

- `../sample/afterEffect - CTV/template-ctv-3-0-nophone-15s.aepx`
- `../sample/afterEffect - CTV/template-ctv-3-0-nophone-15s (converted) folder/`
- `../sample/afterEffect - CTV/2-comp_QRCode (2).json`
- Export-package examples: `../sample/creative/IONIS_tryngolza.zip`, `label-notVisible.zip`, `tryptryDTC.psd.zip`.

`export.json` and its referenced files determine the actual package design. AE values guide the preview motion. Values in this document describe the **implemented local preview for the supported theme**; they are not universal CTV/OTT publisher rules.

## Experience and service architecture

1. On ZIP upload, the app detects visible artboards named with a `ctv`, `ott` or `ctvott` prefix followed by `_` or end-of-name. It offers View CTV, View OTT or View CTV/OTT. CTV and OTT renders start automatically; opening the view after an error retries with the retained package.
2. The view reports rendering, unavailable and missing-assets states. A completed preview appears in a native video player with controls, autoplay muted, loop, inline playback and `nodownload` controls. The browser holds an object URL; the panel offers no MP4 download action.
3. The browser calls same-origin `/api/ctv-ott/health` and `/api/ctv-ott/render?format=ctv|ott`. Vite proxies these to the local renderer at `127.0.0.1:4177`, including when QA Studio is opened at `localhost:5173`.
4. `npm run dev` and `npm start` launch the renderer and app together through `scripts/preview-stack.mjs`. FFmpeg/ffprobe must be on `PATH`. A static `dist/` deployment by itself cannot render CTV/OTT; it needs an equivalent renderer service and proxy. The renderer health build, preview HTML badge and current pointer should all read **7.11.16**.

## Export-package contract

| Input | Current behavior |
|---|---|
| ZIP and `export.json` | The renderer reads `rawLayers` and `document.artboards`; a loose PSD, AE file or video is not a substitute. |
| Visible requested artboard | First visible artboard whose name begins with `ctv` or `ott` for the requested format. Bounds must be **1920×1080**. |
| `video` group | The group's video layer must resolve to a package video file, by literal name or exported `-<layerID>` suffix. A `frame` child supplies the final inset bounds. Missing either is an error; there is no default-video fallback. |
| `Screen1` | Optional `peel` and `peelLogo` images from the package. |
| `Screen2` | Required full-canvas base (`foreground` preferred for CTV; `background` for OTT; the other is fallback). Optional `noPhone Frame`, `QRCode` and `bringItAlive` overlays. |
| CTV `Screen3` | When present, `background`/`foreground` base and `noPhone Frame`, `QRCode`, `bringItAlive`, `tagLine`, `scanAnchor` are package assets. Grouped expansion requires the Screen 2 QR/frame and Screen 3 large frame/QR/CTA. |
| `disclaimer` | If present, this package image is composited at its exported bounds. Its own white pixels remain opaque; no synthetic white backing or alpha fade is added. |
| `qrCodeConfig` | `colorCode`, URL and `brandingLogo` metadata are read. The visible QR remains the supplied QR image; the renderer does not synthesize it from the URL. |

The renderer converts export layer bounds to artboard-relative coordinates. The supported CTV 3.0 no-phone geometry below is template-specific. Other theme structures can have valid source layers without automatically receiving the full grouped QR animation.

## Visual stacking and behavior

Back to front, the supported CTV composition has: full-canvas Screen 2/3 background blend; masked collapsed-card blur; package disclaimer and collapsed QR/card/CTA; one opaque package video; peel assembly during the intro; then expanded glass, frame, QR/backing, CTA, tagline and scan anchor. The collapsed card exists **from the first frame behind the opening video**. It is revealed by retraction, not a late fade. The backdrop outside the glass mask stays sharp.

The package video remains continuously opaque across Screen 2→3; two overlapping faded copies must not make it translucent. The disclaimer is behind the video, so it cannot paint over the retracting footage. Its package image supplies the white background. The peel and `peelLogo` move together toward the **right edge**, with the curled peel above the logo and top edges aligned. The CTV background blend is full-canvas—no right-side patch or seam.

OTT shares the CTV opening-video retraction, rightward peel exit and disclaimer-behind-video behavior. OTT does **not** inherit CTV QR/Screen 3 expansion by default. CTV-specific QR grouping, frosted glass and scan cue are scoped to the supported CTV theme.

## Motion timeline

Let `D` be the source-video duration. The preview ends at `D`.

| Event | Time | Implemented design/ease |
|---|---|---|
| Opening | `0–3 s` | Full-frame package video covers the card and disclaimer already composed behind it. |
| CTV + OTT retract | `3–4 s` | Video scales from 1920×1080 to package `video/frame` bounds using smoothstep `p²(3−2p)`; position tracks the scaled dimensions. It is padded to a fixed transparent FHD canvas before overlay. AE master reference is 100%→62%, but the package frame determines final output placement. |
| CTV + OTT peel | `3–4 s` | Peel/logo travel right together using cubic ease-out `1−(1−p)³`; alpha fades from 3.2–4.0 s. |
| Screen 2 hold | To `max(3,D−8) s` in CTV | Package video, ISI, collapsed QR, CTA and **already frosted** card hold together. |
| Screen 3 background | Starts `max(3,D−8) s` | Entire background fades in over 0.8 s under the foreground. |
| CTV QR expansion | Starts `max(3,D−8) s`; lasts **1.001 s** | AE QR comp frames **210.206–240.236 at 30 fps**. Small glass hands off to expanding glass at the same transition. QR and backing retain separate sizes but share one centered movement. |
| CTA / tagline | `max(3,D−7.8) s` / `max(3,D−7) s` | Package CTA fade 0.3 s; package tagline fade 0.2 s. |
| Scan cue | `max(3,D−4) s` | `scanAnchor` scales from QR edges to exported outer bounds over 0.5 s, centered on QR, then fades out over 0.05 s. Fixed transparent canvas prevents clipping or a leftward slide. |
| Disclaimer scroll | Starts 3 s | Package image scrolls through its excess authored height at a rate calculated through `D+2 s`; no generated ISI typography. |

For a 30 s video, expansion begins near **22 s**, tagline near **23 s**, and scan cue near **26 s**. These are local-preview timings, not universal delivery requirements.

## QR shape, glass and effects

The QR JSON's local AE values and package output bounds are distinct:

| Shape | Collapsed AE state | Expanded AE state |
|---|---|---|
| Glass panel / `QR BG` | position `(0,−4)`, size `190×242`, radius `10` | position `(0,−159.5)`, size `322×555`, radius `20` |
| White QR backing | position `(0,0)`, size `170×170`, radius `10` | position `(0,−92)`, size `260×260`, radius `10` |
| Dark stroke | `186×242`, radius `8` | `318×551`, radius `20` |
| Stroke | `190×242`, radius `10`, 50% opacity | `322×555`, radius `20`, 50% opacity |

For the supported FHD template, the small glass output box is `(1431,670,288,369)` and the large box `(1333,203,486,836)` in `(x,y,w,h)` order. The QR and CTA placement also use their package-exported rectangles; they must not be stretched with the tall panel.

The blur stack is Gaussian `sigma=13.537` then Fast Box Blur radius `2`. The package frame alpha defines the shape. The blur mask is fully opaque *inside* that shape, so sharp headline/background pixels cannot leak through low-opacity glass; translucent white and strokes come from package frame artwork. **The collapsed card has this blur before expansion**, masked by the small frame. The expanded panel uses the animated large-frame mask. The rest of the backdrop stays sharp. The moving QR's white backing comes from package artwork; its old area retains a 25%-white glass fill, not a transparent rectangle.

QR artwork and backing are scaled independently into one fixed square and moved once, keeping their centers synchronized. Panel position, panel size, backing size and QR position follow separate temporal Bézier references, approximated in FFmpeg with sampled linear segments. The scan anchor is a later independent cue. Different compositing engines mean exact AE pixels are not guaranteed.

## Encoder, limits and failure handling

| Item | Current local preview |
|---|---|
| Request/package | ZIP request body cap **1 GiB**; `export.json` and referenced media required. |
| Artboard | **1920×1080 only**; HD-authored input is rejected. |
| Duration | Read with `ffprobe`; positive and **≤270 s**. |
| Video | MP4, H.264/libx264, 15 Mbps target/min/max, 30 Mbps buffer, `yuv420p`, `+faststart`. |
| Frame rate | `30000/1001` (~29.97 fps). |
| Audio | Optional source stream (`0:a?`); AAC **320 kbps**, **48 kHz stereo**. |
| Renderer | FFmpeg/ffprobe on `PATH`; no AE runtime. |
| Failure | Missing required scene/video/frame, unsupported size, duration or render errors return a descriptive failure (HTTP 422 for package/render errors). No creative fallback. |

The CLI verification form is `node scripts/ctv-ott-renderer.mjs render package.zip ctv|ott output.mp4`. Checks are `npm test`, `npm run build`, three representative package renders, and visual checkpoints around 3–4 s, the 21–23 s glass transition in a 30 s CTV, the late scan cue and final QR/CTA. Structural assertions are in `tests/structure/ctv-ott.test.mjs`.

## Maintenance

Keep this document current when asset resolution, scene/layer order, timing, ease, effects, output profile, limits, or the host service changes. Preserve package creative/template motion separation. Synchronize `preview/current-preview.ts`, HTML `PREVIEW_BUILD`, renderer health/build, tests and the build inventory on a patch. Preserve previous artifacts unless cleanup is explicitly approved. Record production differences as evidence and verify more than one package before claiming parity.
