import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preview = readFileSync("preview/turbo-preview-7.12.0.html", "utf8");
const app = readFileSync("app/page.tsx", "utf8");
const renderer = readFileSync("scripts/ctv-ott-renderer.mjs", "utf8");
const stack = readFileSync("scripts/preview-stack.mjs", "utf8");
const viteConfig = readFileSync("vite.config.ts", "utf8");

test("CTV/OTT controls live in the host app, not the embedded main-unit preview", () => {
  assert.doesNotMatch(preview, /ctvOttPreviewPanel|CTV \/ OTT teaser preview|Render CTV|Render OTT/);
  assert.match(app, /View CTV\/OTT/);
  assert.match(app, /ctv-ott-subnav/);
  assert.match(app, /ctv-ott-video-grid/);
});

test("CTV/OTT assets are detected and rendered automatically after upload", () => {
  assert.match(app, /function detectCtvOttFormats\(exportData/);
  assert.match(app, /exportData\.document\?\.artboards/);
  assert.match(app, /void renderCtvOttPackage\(file, detectedCtvOttFormats/);
  assert.match(app, /const openCtvOtt = \(\) =>/);
  assert.match(app, /ctvOttStatus === "error"/);
  assert.match(app, /renderCtvOttPackage\(pendingFileRef\.current, ctvOttFormats/);
  assert.match(app, /fetch\(`\$\{rendererBase\}\/render\?format=\$\{format\}`/);
  assert.match(app, /No supported CTV\/OTT artboard was found/);
  assert.match(app, /The local FFmpeg renderer is unavailable/);
});

test("the local app stack starts the FFmpeg renderer with the preview app", () => {
  assert.match(stack, /scripts\/ctv-ott-renderer\.mjs/);
  assert.match(stack, /spawn\(appArgs\[0\]/);
});

test("the browser reaches the renderer through the same-origin app proxy", () => {
  assert.match(app, /const rendererBase = "\/api\/ctv-ott"/);
  assert.doesNotMatch(app, /http:\/\/127\.0\.0\.1:4177/);
  assert.match(viteConfig, /"\/api\/ctv-ott"/);
  assert.match(viteConfig, /rewrite: \(requestPath: string\) => requestPath\.replace/);
  assert.match(viteConfig, /server: \{/);
  assert.match(viteConfig, /preview: \{ proxy: ctvOttProxy \}/);
});

test("FFmpeg renderer stays on the approved production preview profile", () => {
  assert.match(renderer, /const HTML_FILE = join\(BUILD_DIR, "\.\.\/preview\/turbo-preview-7\.12\.0\.html"\)/);
  assert.match(renderer, /role === "disclaimer"/);
  assert.match(renderer, /duration - 8/);
  assert.match(renderer, /duration - 7\.8/);
  assert.match(renderer, /duration - 4/);
  assert.match(renderer, /const MAX_PACKAGE_BYTES = 1 \* 1024 \* 1024 \* 1024/);
  assert.match(renderer, /const MAX_DURATION = 270/);
  assert.match(renderer, /model\.width !== 1920 \|\| model\.height !== 1080/);
  assert.match(renderer, /-b:v", "15M/);
  assert.match(renderer, /-ar", "48000/);
  assert.match(renderer, /-ac", "2/);
  assert.match(renderer, /build: "7\.12\.0"/);
  assert.match(renderer, /const qrBackingRect = \(qr, panel, shape\) =>/);
  assert.match(renderer, /\[qrBackingSource\]crop=/);
  assert.match(renderer, /\[expandedQrGroup\]/);
  assert.match(renderer, /:c=white@0\.25:t=fill:replace=1/);
  assert.match(renderer, /panelMask/);
  assert.match(renderer, /alphamerge/);
  assert.match(renderer, /qrCodeConfig/);
  assert.match(renderer, /solidColorFromLayer/);
  assert.match(renderer, /tagline/);
  assert.match(renderer, /const QR_COMPOSITION =/);
  assert.match(renderer, /expansionStartFrame: 210\.206/);
  assert.match(renderer, /expansionEndFrame: 240\.236/);
  assert.match(renderer, /gaussianBlur: 13\.537/);
  assert.match(renderer, /edgeBlur: 2/);
  assert.match(renderer, /gblur=sigma=\$\{QR_COMPOSITION\.gaussianBlur\}/);
  assert.match(renderer, /boxblur=\$\{QR_COMPOSITION\.edgeBlur\}:1/);
  assert.match(renderer, /QR_COMPOSITION\.expansionDuration/);
});

test("CTV stages retain the collapsed QR and animate the panel and artwork without distortion", () => {
  assert.match(renderer, /\[sourceBase\]scale=w='\$\{videoW\}':h='\$\{videoH\}':eval=frame/);
  assert.match(renderer, /model\.peelVideoPosition =/);
  assert.match(renderer, /pad=\$\{model\.width\}:\$\{model\.height\}:x='\$\{peelX\}'/);
  assert.match(renderer, /if \(groupedPanel\)/);
  assert.match(renderer, /role === "screen3" && \/bringitalive\//);
  assert.match(renderer, /role === "screen2"/);
  assert.match(renderer, /const startRect = model\.relative\(isCta \? screen2Cta\?\.layer : screen2Qr\?\.layer\)/);
  assert.match(renderer, /scale=w='\$\{width\}':h='\$\{height\}':eval=frame/);
  assert.match(renderer, /\[screen2GlassSource\]gblur=/);
  assert.match(renderer, /alphaextract,lut=y='if\(gt\(val,0\),255,0\)'\[panelMask\]/);
  assert.match(renderer, /const videoFile = assetFor\(videoLayer\)/);
  assert.doesNotMatch(renderer, /videoFile = assetFor\(videoLayer\) \|\|/);
  assert.match(renderer, /overlay\("expandedPanel", model\.expandedPanel\.x, model\.expandedPanel\.y, expanded\)/);
  assert.match(renderer, /overlay\("expandedQrGroup", model\.expandedQrGroup\.x, model\.expandedQrGroup\.y, expanded\)/);
  assert.match(renderer, /index === screen3FrameIndex \|\| index === screen3SmallFrameIndex/);
  assert.match(renderer, /pad=\$\{model\.width\}:\$\{model\.height\}:x='\$\{panelX\}'/);
  assert.doesNotMatch(renderer, /input\.role === "screen2"[^\n]*\n\s*\/\^\(qrcode\|bringitalive\)\$\//);
});

test("CTV backgrounds transition as a full canvas beneath the foreground", () => {
  assert.match(renderer, /\[screen2Canvas\]\[screen3Canvas\]overlay=0:0:format=auto,split=2\[baseCanvas\]\[screen2GlassSource\]/);
  assert.match(renderer, /if \(groupedPanel && index === screen3BaseIndex\) continue/);
  assert.doesNotMatch(renderer, /\[\$\{index\}:v\]crop=640:\$\{model\.height\}:1280:0,format=rgba,fade=t=in:st=\$\{Math\.max\(3, duration - 8\)\}:d=0\.8:alpha=1\[asset\$\{index\}\]/);
});

test("CTV collapsed QR frame has masked frosted blur before expansion", () => {
  assert.match(renderer, /const screen2FrameIndex = inputs\.findIndex/);
  assert.match(renderer, /\[\$\{index\}:v\]split=2\[collapsedFrameAssetSource\]\[collapsedFrameMaskSource\]/);
  assert.match(renderer, /\[screen2GlassSource\]gblur=sigma=\$\{QR_COMPOSITION\.gaussianBlur\},boxblur=\$\{QR_COMPOSITION\.edgeBlur\}:1,format=rgba,split=2\[collapsedBlurSource\]\[expandedBlurSource\]/);
  assert.match(renderer, /\[collapsedFrameMaskSource\]format=rgba,alphaextract,crop=/);
  assert.match(renderer, /\[collapsedBlurSource\]\[collapsedGlassMask\]alphamerge\[collapsedGlass\]/);
  assert.match(renderer, /overlay\("collapsedGlass", model\.collapsedGlass\.x, model\.collapsedGlass\.y,/);
  assert.ok(renderer.indexOf('overlay("collapsedGlass"') < renderer.indexOf('overlay("peelVideo"'));
  assert.match(renderer, /\[expandedBlurSource\]\[panelMask\]alphamerge\[expandedGlass\]/);
});

test("CTV and OTT retract one opaque package video and exit the peel rightward", () => {
  assert.match(renderer, /if \(screen2BaseIndex >= 0\) \{/);
  assert.match(renderer, /\[sourceBase\]scale=w='\$\{videoW\}':h='\$\{videoH\}':eval=frame,format=rgba,pad=/);
  assert.match(renderer, /\[sourceInset2\]nullsink/);
  assert.match(renderer, /\[sourceInset3\]nullsink/);
  assert.doesNotMatch(renderer, /overlay\("inset2"/);
  assert.match(renderer, /const peelExitDistance = Math\.max\(0, model\.width - \(peelPosition\?\.x \?\? model\.width\)\)/);
  assert.match(renderer, /\$\{pos\.x\}\+\$\{peelExitDistance\}\*\(\$\{easeOut\}\)/);
  assert.match(renderer, /const introIndexes = inputs\.map/);
  assert.match(renderer, /if \(model\.peelVideoPosition\) \{/);
  assert.match(renderer, /if \(role === "intro"\) return "format=rgba,fade=t=out:st=3\.2:d=0\.8:alpha=1"/);
  assert.match(renderer, /const peelY = \/\^peelLogo\$\/i\.test\(inputs\[index\]\.layer\?\.name \|\| ""\) && peelPosition/);
  assert.match(renderer, /\? peelPosition\.y : pos\.y/);
});

test("CTV and OTT keep the opaque disclaimer behind the retracting video", () => {
  const disclaimer = renderer.indexOf('overlayDisclaimer();');
  const video = renderer.indexOf('overlay("peelVideo", model.peelVideoPosition.x, model.peelVideoPosition.y)');
  assert.ok(disclaimer >= 0 && video > disclaimer);
  assert.doesNotMatch(renderer, /isiBacking/);
  assert.match(renderer, /crop=\$\{pos\.width\}:\$\{visibleHeight\}:0:'\$\{scrollOffset\}',format=rgba\[asset\$\{index\}\]/);
  assert.doesNotMatch(renderer, /fade=t=in:st=3:d=0\.8:alpha=1/);
});

test("CTV QR handoff is continuous and uses the template's temporal handles", () => {
  assert.match(renderer, /function qrEase\(progress, x1, y1, x2, y2\)/);
  assert.match(renderer, /qrEase\(progress, 0\.167, 0, 0\.833, 1\)/);
  assert.match(renderer, /qrEase\(progress, 0\.167, 0, 0\.833, 0\.839\)/);
  assert.match(renderer, /const qrPositionEase = qrEase\(progress, 0\.167, 0, 0\.667, 1\)/);
  assert.match(renderer, /\[qrBackingCanvas\]\[qrArtworkCanvas\]overlay=0:0:format=auto\[expandedQrGroup\]/);
  assert.match(renderer, /pad=\$\{backingCanvas\}:\$\{backingCanvas\}:x='\(ow-iw\)\/2':y='\(oh-ih\)\/2':eval=frame:color=black@0/);
  assert.match(renderer, /if \(input\.groupedQr\) continue/);
  assert.doesNotMatch(renderer, /\[expandedQrBacking\]/);
  assert.match(renderer, /smallQrBacking\.x\}\+\$\{smallQrBacking\.width\}\/2/);
  assert.match(renderer, /if \(collapsedQrStack\) continue/);
  assert.match(renderer, /expandingQrStack \? `gte\(t,\$\{Math\.max\(3, duration - 8\)\}\)`/);
  assert.doesNotMatch(renderer, /scale=w='\$\{width\}':h='\$\{height\}':eval=frame,fade=t=in:st=\$\{transitionStart\}:d=0\.15/);
});

test("CTV reveals the collapsed QR from behind the retracting video", () => {
  const lockup = renderer.indexOf("// Screen 2's complete QR lockup sits under the opening video");
  const video = renderer.indexOf('overlay("peelVideo", model.peelVideoPosition.x, model.peelVideoPosition.y)');
  assert.ok(lockup >= 0 && video > lockup);
  assert.match(renderer, /graph\.push\(`\[\$\{index\}:v\]format=rgba\[asset\$\{index\}\]`\);/);
  assert.doesNotMatch(renderer, /fade=t=in:st=3\.8:d=0\.01:alpha=1\[asset\$\{index\}\]/);
});

test("CTV scanAnchor scales within a fixed overlay canvas instead of sliding or clipping", () => {
  assert.match(renderer, /\^scanAnchor\$\/i\.test/);
  assert.match(renderer, /const width = `\$\{largeQr\.width\}\+\(\$\{anchor\.width\}-\$\{largeQr\.width\}\)\*\$\{spread\}`/);
  assert.match(renderer, /const height = `\$\{largeQr\.height\}\+\(\$\{anchor\.height\}-\$\{largeQr\.height\}\)\*\$\{spread\}`/);
  assert.match(renderer, /pad=\$\{anchor\.width\}:\$\{anchor\.height\}:x='\(ow-iw\)\/2':y='\(oh-ih\)\/2':eval=frame:color=black@0/);
  assert.match(renderer, /input\.dynamicOverlay = \{ x: String\(anchor\.x\), y: String\(anchor\.y\) \}/);
});
