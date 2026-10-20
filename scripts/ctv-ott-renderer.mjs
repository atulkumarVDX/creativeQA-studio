#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUILD_DIR = dirname(fileURLToPath(import.meta.url));
const HTML_FILE = join(BUILD_DIR, "../preview/turbo-preview-7.12.0.html");
const HOST = "127.0.0.1";
const PORT = Number(process.env.TURBO_PREVIEW_PORT || 4177);
// Production sample packages can exceed 500 MB because of embedded PSD/video
// payloads. Keep a bounded local-render guard while allowing the supplied
// Ipsen package through.
const MAX_PACKAGE_BYTES = 1 * 1024 * 1024 * 1024;
const FPS = "30000/1001";
const MAX_DURATION = 270;

// The QR panel is authored as a 1280x720 Lottie subcomposition. Its absolute
// placement in the final CTV frame comes from export.json; these values define
// the authored expansion timing/easing and the effect stack used by FFmpeg.
const QR_COMPOSITION = {
  frameRate: 30,
  expansionStartFrame: 210.206,
  expansionEndFrame: 240.236,
  gaussianBlur: 13.537,
  edgeBlur: 2,
  // Values from 2-comp_QRCode (2).json. All four shapes share the same
  // 210.206–240.236 frame window, but only the glass panel changes aspect
  // ratio. The QR and CTA artwork must retain their own proportions.
  panel: Object.freeze({
    start: Object.freeze({ position: [0, -4], size: [190, 242], radius: 10 }),
    end: Object.freeze({ position: [0, -159.5], size: [322, 555], radius: 20 })
  }),
  qrBackground: Object.freeze({
    start: Object.freeze({ position: [0, 0], size: [170, 170], radius: 10 }),
    end: Object.freeze({ position: [0, -92], size: [260, 260], radius: 10 })
  }),
  strokeDark: Object.freeze({ start: Object.freeze({ size: [186, 242], radius: 8 }), end: Object.freeze({ size: [318, 551], radius: 20 }) }),
  stroke: Object.freeze({ start: Object.freeze({ size: [190, 242], radius: 10 }), end: Object.freeze({ size: [322, 555], radius: 20 }), opacity: 50 })
};
QR_COMPOSITION.expansionDuration =
  (QR_COMPOSITION.expansionEndFrame - QR_COMPOSITION.expansionStartFrame) / QR_COMPOSITION.frameRate;

// Lottie's temporal handles are cubic Bézier controls. FFmpeg's expression
// evaluator has no inverse-Bézier primitive, so approximate each authored
// curve with short linear segments in normalized time.
function qrBezierValue(progress, x1, y1, x2, y2) {
  const point = t => ({
    x: 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3,
    y: 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3
  });
  let low = 0;
  let high = 1;
  for (let step = 0; step < 20; step += 1) {
    const middle = (low + high) / 2;
    if (point(middle).x < progress) low = middle;
    else high = middle;
  }
  return point((low + high) / 2).y;
}

function qrEase(progress, x1, y1, x2, y2) {
  const samples = Array.from({ length: 25 }, (_, index) =>
    qrBezierValue(index / 24, x1, y1, x2, y2));
  return `(${samples.slice(1).map((value, index) => {
    const delta = Number((value - samples[index]).toFixed(7));
    return `${delta}*min(max(((${progress})-${index}/24)*24\\,0)\\,1)`;
  }).join("+")})`;
}

// pad can read iw/ih but not time. Recover the position curve from the
// already eased input width, keeping panel and backing geometry synchronized.
function qrMappedEase(sizeFraction, sizeHandles, positionHandles) {
  const sizes = Array.from({ length: 25 }, (_, index) =>
    qrBezierValue(index / 24, ...sizeHandles));
  const positions = Array.from({ length: 25 }, (_, index) =>
    qrBezierValue(index / 24, ...positionHandles));
  return `(${positions.slice(1).map((value, index) => {
    const delta = Number((value - positions[index]).toFixed(7));
    const start = Number(sizes[index].toFixed(7));
    const interval = Number((sizes[index + 1] - sizes[index]).toFixed(7));
    return `${delta}*min(max(((${sizeFraction})-${start})/${interval}\\,0)\\,1)`;
  }).join("+")})`;
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { ...options, shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", chunk => { stdout += chunk; });
    child.stderr?.on("data", chunk => { stderr += chunk; });
    child.on("error", rejectRun);
    child.on("close", code => {
      if (code === 0) resolveRun({ stdout, stderr });
      else rejectRun(new Error(`${basename(command)} exited with code ${code}\n${stderr.slice(-8000)}`));
    });
  });
}

async function commandExists(command) {
  try {
    await run("/usr/bin/which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root) {
  const output = [];
  async function walk(folder) {
    for (const name of await readdir(folder)) {
      const filePath = join(folder, name);
      const info = await stat(filePath);
      if (info.isDirectory()) await walk(filePath);
      else output.push(filePath);
    }
  }
  await walk(root);
  return output;
}

function unit(value) {
  if (typeof value === "number") return value;
  if (value && typeof value._value === "number") return value._value;
  return 0;
}

function layerBounds(layer) {
  const rect = layer?.bounds || {};
  return {
    top: unit(rect.top),
    left: unit(rect.left),
    width: unit(rect.width),
    height: unit(rect.height)
  };
}

function rgbValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function solidColorFromLayer(layer) {
  const color = layer?.adjustment?.find?.(entry => entry?._obj === "solidColorLayer")?.color;
  if (!color) return null;
  const red = rgbValue(color.red);
  const green = rgbValue(color.green ?? color.grain);
  const blue = rgbValue(color.blue);
  return [red, green, blue].every(channel => channel !== null) ? { red, green, blue } : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function packageModel(data, files, format) {
  const layers = Array.isArray(data.rawLayers) ? data.rawLayers : [];
  const byId = new Map(layers.map(layer => [layer.layerID, layer]));
  const children = new Map();
  for (const layer of layers) {
    if (!children.has(layer.parentLayerID)) children.set(layer.parentLayerID, []);
    children.get(layer.parentLayerID).push(layer);
  }
  const rootId = (data.document?.artboards || []).find(id => {
    const layer = byId.get(id);
    return layer && layer.visible !== false && new RegExp(`^${format}`, "i").test(layer.name || "");
  });
  const root = byId.get(rootId);
  if (!root) throw new Error(`No visible ${format.toUpperCase()} artboard was found.`);
  const rootRect = layerBounds(root);
  if (!rootRect.width || !rootRect.height) throw new Error("The video artboard has no usable dimensions.");

  const fileByName = new Map(files.map(file => [basename(file).toLowerCase(), file]));
  function child(parentId, name) {
    const match = (children.get(parentId) || []).find(layer =>
      String(layer.name || "").trim().toLowerCase() === String(name).toLowerCase()
    );
    return match || null;
  }
  function descendants(parentId) {
    const result = [];
    const queue = [...(children.get(parentId) || [])];
    while (queue.length) {
      const layer = queue.shift();
      result.push(layer);
      queue.push(...(children.get(layer.layerID) || []));
    }
    return result;
  }
  function group(name) {
    return descendants(root.layerID).find(layer =>
      Number(layer.layerKind) === 7 && String(layer.name || "").trim().toLowerCase() === name.toLowerCase()
    ) || null;
  }
  function assetFor(layer) {
    if (!layer) return null;
    const literal = fileByName.get(String(layer.name || "").toLowerCase());
    if (literal) return literal;
    const idPattern = new RegExp(`-${escapeRegex(layer.layerID)}\\.(png|jpe?g|webp|mp4|mov)$`, "i");
    return files.find(file => idPattern.test(basename(file))) || null;
  }
  function namedAsset(groupLayer, name) {
    if (!groupLayer) return null;
    const layer = descendants(groupLayer.layerID).find(item =>
      String(item.name || "").trim().toLowerCase() === name.toLowerCase()
    );
    if (!layer) return null;
    return { layer, file: assetFor(layer), state: frameState(layer) };
  }
  function namedAssets(groupLayer, name) {
    if (!groupLayer) return [];
    return descendants(groupLayer.layerID)
      .filter(item => String(item.name || "").trim().toLowerCase() === name.toLowerCase())
      .map(layer => ({ layer, file: assetFor(layer), state: frameState(layer) }))
      .filter(item => item.file);
  }
  function frameState(layer) {
    if (!/^noPhone Frame$/i.test(String(layer?.name || "").trim())) return null;
    const siblingQr = (children.get(layer.parentLayerID) || []).find(item =>
      /^QRCode$/i.test(String(item.name || "").trim())
    );
    return siblingQr && layerBounds(siblingQr).width <= 250 ? "small" : "large";
  }

  const qrCodeConfig = group("qrCodeConfig");
  const qrColorLayer = qrCodeConfig && child(qrCodeConfig.layerID, "colorCode");
  const qrUrlLayer = qrCodeConfig && child(qrCodeConfig.layerID, "url");
  const qrBrandingLayer = qrCodeConfig && child(qrCodeConfig.layerID, "brandingLogo");
  const qrConfig = qrCodeConfig ? {
    color: solidColorFromLayer(qrColorLayer),
    layer: qrCodeConfig,
    url: qrUrlLayer?.textKey?.text || null,
    brandingLogo: qrBrandingLayer ? {
      layer: qrBrandingLayer,
      file: assetFor(qrBrandingLayer),
      fileReference: qrBrandingLayer.smartObject?.fileReference || null
    } : null
  } : null;
  function relative(layer) {
    const rect = layerBounds(layer);
    return {
      x: Math.round(rect.left - rootRect.left),
      y: Math.round(rect.top - rootRect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }
  if (qrConfig) qrConfig.placement = relative(qrCodeConfig);

  const videoGroup = group("video");
  const videoLayer = videoGroup && descendants(videoGroup.layerID).find(layer => /\.(mp4|mov|webm)$/i.test(layer.name || ""));
  // The CTV/OTT footage must be the asset referenced by this artboard's
  // video group. A same-named loose file is not an acceptable substitute.
  const videoFile = assetFor(videoLayer);
  const frameLayer = videoGroup && child(videoGroup.layerID, "frame");
  if (!videoFile || !frameLayer) throw new Error("The package does not contain a video source and authored video frame.");

  const screen1 = group("Screen1");
  const screen2 = group("Screen2");
  const screen3 = format === "ctv" ? group("Screen3") : null;
  if (!screen1 || !screen2) throw new Error(`The ${format.toUpperCase()} artboard is missing Screen1 or Screen2.`);

  const screen2Base = namedAsset(screen2, format === "ctv" ? "foreground" : "background")
    || namedAsset(screen2, "background")
    || namedAsset(screen2, "foreground");
  const screen3Base = screen3 && (namedAsset(screen3, "background") || namedAsset(screen3, "foreground"));
  if (!screen2Base?.file) throw new Error("The package is missing the primary CTV/OTT screen image.");
  const disclaimer = descendants(root.layerID).find(layer =>
    String(layer.name || "").trim().toLowerCase() === "disclaimer"
  );

  function optionalAssets(groupLayer, names) {
    return names.map(name => namedAsset(groupLayer, name)).filter(item => item?.file);
  }

  return {
    format,
    width: Math.round(rootRect.width),
    height: Math.round(rootRect.height),
    videoFile,
    videoFrame: relative(frameLayer),
    intro: optionalAssets(screen1, ["peel", "peelLogo"]),
    screen2: {
      base: screen2Base,
      overlays: optionalAssets(screen2, ["noPhone Frame", "QRCode", "bringItAlive"])
    },
    screen3: screen3Base ? {
      base: screen3Base,
      // The Screen3 mobile composition is authored as a single stack. Keep
      // the tagline in the stack so it enters the expanding frame with the
      // QR and CTA instead of remaining baked into the right-hand backdrop.
      overlays: [
        ...namedAssets(screen3, "noPhone Frame"),
        ...optionalAssets(screen3, ["tagLine", "QRCode", "bringItAlive", "scanAnchor"]),
      ]
    } : null,
    qrConfig,
    disclaimer: disclaimer ? { layer: disclaimer, file: assetFor(disclaimer) } : null,
    relative
  };
}

function ffmpegInputs(model) {
  const inputs = [{ file: model.videoFile, kind: "video" }];
  for (const item of model.intro) inputs.push({ ...item, kind: "image", role: "intro" });
  inputs.push({ ...model.screen2.base, kind: "image", role: "screen2", isBase: true });
  for (const item of model.screen2.overlays) inputs.push({ ...item, kind: "image", role: "screen2" });
  if (model.screen3) {
    inputs.push({ ...model.screen3.base, kind: "image", role: "screen3", isBase: true });
    for (const item of model.screen3.overlays) inputs.push({ ...item, kind: "image", role: "screen3" });
  }
  if (model.disclaimer?.file) inputs.push({ ...model.disclaimer, kind: "image", role: "disclaimer" });
  return inputs;
}

function alphaFilter(input, hasScreen3, duration) {
  const role = input.role;
  const layerName = String(input.layer?.name || "").toLowerCase();
  const transitionStart = Math.max(3, duration - 8);
  if (role === "disclaimer") return "format=rgba";
  if (role === "intro") return "format=rgba,fade=t=out:st=3.2:d=0.8:alpha=1";
  if (hasScreen3 && /scananchor/.test(layerName)) {
    const scanStart = Math.max(3, duration - 4);
    const scanEnd = Math.max(scanStart + 0.5, duration - 3.5);
    return `format=rgba,fade=t=in:st=${scanStart}:d=0.5:alpha=1,fade=t=out:st=${scanEnd}:d=0.05:alpha=1`;
  }
  if (hasScreen3 && role === "screen3" && /bringitalive/.test(layerName)) {
    const ctaStart = Math.max(3, duration - 7.8);
    return `format=rgba,fade=t=in:st=${ctaStart}:d=0.3:alpha=1`;
  }
  if (hasScreen3 && role === "screen3" && /tagline/.test(layerName)) {
    const taglineStart = Math.max(3, duration - 7);
    return `format=rgba,fade=t=in:st=${taglineStart}:d=0.2:alpha=1`;
  }
  if (role === "screen2") {
    if (hasScreen3 && input.isBase) return "format=rgba,fade=t=in:st=3.8:d=0.01:alpha=1";
    const exitDuration = /^(qrcode|bringitalive|nophone frame)$/.test(layerName) ? 0.15 : 1;
    const exit = hasScreen3 ? `,fade=t=out:st=${transitionStart}:d=${exitDuration}:alpha=1` : "";
    const entrance = hasScreen3 ? "3.8:d=0.01" : "3:d=0.8";
    return `format=rgba,fade=t=in:st=${entrance}:alpha=1${exit}`;
  }
  return `format=rgba,fade=t=in:st=${transitionStart}:d=1:alpha=1`;
}

function buildFilter(model, inputs, duration) {
  const graph = [];
  const frame = model.videoFrame;
  const screen2BaseIndex = inputs.findIndex(input => input.role === "screen2" && input.isBase);
  const screen3BaseIndex = inputs.findIndex(input => input.role === "screen3" && input.isBase);
  const screen3FrameIndex = inputs.findIndex(input =>
    input.role === "screen3" && !input.isBase && input.state === "large" &&
    /^noPhone Frame$/i.test(String(input.layer?.name || "").trim())
  );
  const screen3SmallFrameIndex = inputs.findIndex(input =>
    input.role === "screen3" && !input.isBase && input.state === "small" &&
    /^noPhone Frame$/i.test(String(input.layer?.name || "").trim())
  );
  const screen3QrIndex = inputs.findIndex(input => input.role === "screen3" && /^QRCode$/i.test(String(input.layer?.name || "").trim()));
  const screen2FrameIndex = inputs.findIndex(input => input.role === "screen2" && /^noPhone Frame$/i.test(String(input.layer?.name || "").trim()));
  const screen3CtaIndex = inputs.findIndex(input => input.role === "screen3" && /^bringItAlive$/i.test(String(input.layer?.name || "").trim()));
  const screen3TaglineIndex = inputs.findIndex(input => input.role === "screen3" && /^tagLine$/i.test(String(input.layer?.name || "").trim()));
  const screen2Qr = model.screen2.overlays.find(item => /^QRCode$/i.test(String(item.layer?.name || "").trim()));
  const screen2Cta = model.screen2.overlays.find(item => /^bringItAlive$/i.test(String(item.layer?.name || "").trim()));
  const groupedPanel = model.format === "ctv" && Boolean(screen2Qr) && screen2FrameIndex >= 0 && screen3FrameIndex >= 0 && screen3QrIndex >= 0 && screen3CtaIndex >= 0;
  // These are the authored CTV 3.0 no-phone frame bounds from the supplied
  // template exports. The small and expanded panel shapes are embedded in
  // the two frame PNGs; the animation interpolates between those template
  // states rather than scaling the whole 1920×1080 canvas.
  // These are the final-frame coordinates read from the package's Screen3
  // layers. They correspond to the 2-comp QR composition's start/end states;
  // do not derive them by scaling the browser preview or the whole frame PNG.
  const ctvSmallPanel = { x: 1431, y: 670, width: 288, height: 369 };
  const ctvLargePanel = { x: 1333, y: 203, width: 486, height: 836 };
  const qrBackingRect = (qr, panel, shape) => {
    const size = Math.round(panel.width * shape.size[0] / shape.panelWidth);
    return {
      x: Math.round(qr.x + (qr.width - size) / 2),
      y: Math.round(qr.y + (qr.height - size) / 2),
      width: size,
      height: size
    };
  };
  const smallQr = screen2Qr && model.relative(screen2Qr.layer);
  const largeQr = screen3QrIndex >= 0 && model.relative(inputs[screen3QrIndex].layer);
  const smallQrBacking = groupedPanel && smallQr && qrBackingRect(smallQr, ctvSmallPanel, {
    size: QR_COMPOSITION.qrBackground.start.size,
    panelWidth: QR_COMPOSITION.panel.start.size[0]
  });
  const largeQrBacking = groupedPanel && largeQr && qrBackingRect(largeQr, ctvLargePanel, {
    size: QR_COMPOSITION.qrBackground.end.size,
    panelWidth: QR_COMPOSITION.panel.end.size[0]
  });
  const sourceCount = model.screen3 ? 3 : 2;
  const sourceLabels = model.screen3 ? "[sourceBase][sourceInset2][sourceInset3]" : "[sourceBase][sourceInset2]";
  graph.push(`[0:v]split=${sourceCount}${sourceLabels}`);
  // CTV's Screen 2 and Screen 3 use the same package video in the same
  // authored frame. Fading two separate transparent copies against the
  // backdrop makes the footage see-through during their overlap.
  if (screen2BaseIndex >= 0) {
    // The AEPX master comp animates 3-comp_video from scale 1 to .62 and
    // 4-comp_peel from y=340 to y=0 over 3–4s. The package's video-frame
    // bounds supply the destination; the AE project's collected footage is
    // only an animation reference, never a rendered creative source.
    const p = "min(max((t-3)/1\\,0)\\,1)";
    const ease = `(${p})*(${p})*(3-2*(${p}))`;
    const videoW = `${model.width}+(${frame.width}-${model.width})*${ease}`;
    const videoH = `${model.height}+(${frame.height}-${model.height})*${ease}`;
    if (groupedPanel) {
      // Screen 2 and Screen 3 carry full-canvas backgrounds. Crossfade those
      // canvases beneath every foreground layer; cropping Screen 3 to its
      // right-hand side produces a visible vertical patch at the join.
      const transitionStart = Math.max(3, duration - 8);
      graph.push(`[${screen2BaseIndex}:v]scale=${model.width}:${model.height},format=rgba[screen2Canvas]`);
      graph.push(`[${screen3BaseIndex}:v]scale=${model.width}:${model.height},format=rgba,fade=t=in:st=${transitionStart}:d=0.8:alpha=1[screen3Canvas]`);
      graph.push(`[screen2Canvas][screen3Canvas]overlay=0:0:format=auto,split=2[baseCanvas][screen2GlassSource]`);
      graph.push(`[baseCanvas]format=yuv420p[base]`);
    } else {
      graph.push(`[${screen2BaseIndex}:v]scale=${model.width}:${model.height},format=yuv420p[base]`);
    }
    // FFmpeg overlay retains the first input dimensions when scale changes
    // mid-stream. Pad back to a fixed FHD transparent canvas before overlay.
    const peelX = `${frame.x}*(ow-iw)/(${model.width}-${frame.width})`;
    const peelY = `${frame.y}*(oh-ih)/(${model.height}-${frame.height})`;
    graph.push(`[sourceBase]scale=w='${videoW}':h='${videoH}':eval=frame,format=rgba,pad=${model.width}:${model.height}:x='${peelX}':y='${peelY}':eval=frame:color=black@0[peelVideo]`);
    graph.push(`[sourceInset2]nullsink`);
    model.peelVideoPosition = { x: 0, y: 0 };
  } else {
    graph.push(`[sourceBase]scale=${model.width}:${model.height}:force_original_aspect_ratio=increase,crop=${model.width}:${model.height},setsar=1,format=yuv420p[base]`);
  }
  if (model.screen3) {
    graph.push(`[sourceInset3]nullsink`);
  }
  for (let index = 1; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (input.role === "disclaimer") {
      const pos = model.relative(input.layer);
      const visibleHeight = Math.max(1, model.height - pos.y);
      const travel = Math.max(0, pos.height - visibleHeight);
      const scrollStart = 3;
      const scrollEnd = Math.max(scrollStart + 1, duration + 2);
      const scrollRate = travel / (scrollEnd - scrollStart);
      const scrollOffset = `max(0\\,min(${travel}\\,(t-${scrollStart})*${scrollRate}))`;
      // The package's opaque ISI card waits behind the opening video in both
      // CTV and OTT; retraction reveals it without making white translucent.
      graph.push(`[${index}:v]crop=${pos.width}:${visibleHeight}:0:'${scrollOffset}',format=rgba[asset${index}]`);
      continue;
    }
    if (index === screen2BaseIndex) continue;
    if (groupedPanel && index === screen3BaseIndex) continue;
    if (groupedPanel && input.role === "screen2" &&
      /^(qrcode|bringitalive|nophone frame)$/.test(String(input.layer?.name || "").trim().toLowerCase())) {
      // The collapsed lockup is already present behind the opening video.
      // Its reveal comes from the opaque video retracting, not a late fade.
      if (index === screen2FrameIndex) {
        graph.push(`[${index}:v]split=2[collapsedFrameAssetSource][collapsedFrameMaskSource]`);
        graph.push(`[collapsedFrameAssetSource]format=rgba[asset${index}]`);
      } else graph.push(`[${index}:v]format=rgba[asset${index}]`);
      continue;
    }
    // The animated large frame already begins at the collapsed geometry.
    // Keeping the separate small Screen 3 frame during expansion leaves its
    // baked white QR square protruding below the moving QR backing.
    if (groupedPanel && (index === screen3FrameIndex || index === screen3SmallFrameIndex)) continue;
    if (model.format === "ctv" && input.role === "screen3" && input.isBase) {
      // Keep the Screen 3 backdrop sharp. The AEPX glass treatment applies
      // only inside the translucent noPhone Frame panel, so build a blurred
      // copy and mask it with that exported panel alpha before compositing.
      // AEPX QR composition: Gaussian Blur 13.537118 followed by Fast Box
      // Blur radius 2.0. Reproduce both stages explicitly in FFmpeg.
      if (screen3FrameIndex >= 0) {
        const transitionStart = Math.max(3, duration - 8);
        graph.push(`[${index}:v]crop=640:${model.height}:1280:0,gblur=sigma=${QR_COMPOSITION.gaussianBlur},boxblur=${QR_COMPOSITION.edgeBlur}:1,format=rgba[glassblur${index}]`);
        const maskSources = [];
        for (const [state, frameIndex, panel] of [
          ["small", screen3SmallFrameIndex, ctvSmallPanel],
          ["large", screen3FrameIndex, ctvLargePanel]
        ]) {
          if (frameIndex < 0) continue;
          const suffix = `${index}${state}`;
          graph.push(`[${frameIndex}:v]format=rgba,alphaextract,crop=${panel.width}:${panel.height}:${panel.x}:${panel.y},lut=y='if(gt(val,0),255,0)',format=gray[glassmaskCrop${suffix}]`);
          graph.push(`color=c=black:s=640x1080:r=${FPS}:d=${duration},format=gray[glassmaskCanvas${suffix}]`);
          graph.push(`[glassmaskCanvas${suffix}][glassmaskCrop${suffix}]overlay=x=${panel.x - 1280}:y=${panel.y}:eof_action=pass[glassmask${suffix}]`);
          const fade = state === "small"
            ? `fade=t=in:st=${transitionStart}:d=0.01:alpha=1,fade=t=out:st=${transitionStart}:d=${QR_COMPOSITION.expansionDuration}:alpha=1`
            : `fade=t=in:st=${transitionStart}:d=${QR_COMPOSITION.expansionDuration}:alpha=1`;
          graph.push(`[glassblur${index}][glassmask${suffix}]alphamerge,${fade}[glass${suffix}${index}]`);
          maskSources.push(`glass${suffix}${index}`);
        }
        if (maskSources.length === 2) {
          graph.push(`[${maskSources[0]}][${maskSources[1]}]overlay=eof_action=pass[asset${index}]`);
        } else {
          graph.push(`[${maskSources[0]}]format=rgba[asset${index}]`);
        }
      } else {
        graph.push(`[${index}:v]crop=640:${model.height}:1280:0,format=rgba,fade=t=in:st=${Math.max(3, duration - 8)}:d=1:alpha=1[asset${index}]`);
      }
      input.cropOverlay = { x: 1280, y: 0 };
      continue;
    }
    if (model.format === "ctv" && input.role === "screen3" &&
      /^noPhone Frame$/i.test(String(input.layer?.name || "").trim())) {
      const transitionStart = Math.max(3, duration - 8);
      const isSmall = input.state === "small";
      const panel = isSmall ? ctvSmallPanel : ctvLargePanel;
      const fade = isSmall
        ? `fade=t=in:st=${transitionStart}:d=0.01:alpha=1,fade=t=out:st=${transitionStart}:d=${QR_COMPOSITION.expansionDuration}:alpha=1`
        : `fade=t=in:st=${transitionStart}:d=${QR_COMPOSITION.expansionDuration}:alpha=1`;
      graph.push(`[${index}:v]format=rgba,crop=${panel.width}:${panel.height}:${panel.x}:${panel.y},${fade}[asset${index}]`);
      input.dynamicOverlay = { x: String(panel.x), y: String(panel.y) };
      continue;
    }
    if (model.format === "ctv" && input.role === "screen3" &&
      /^(qrcode|bringitalive)$/.test(String(input.layer?.name || "").trim().toLowerCase())) {
      // Production's CTV template expands the mobile CTA stack using authored
      // center/size keyframes instead of crossfading two independent stacks.
      const transitionStart = Math.max(3, duration - 8);
      const isCta = /bringitalive/.test(String(input.layer?.name || "").trim().toLowerCase());
      const animationStart = transitionStart;
      // The exported Lottie composition expands from frame 210.206 to
      // 240.236 at 30 fps: 1.001 seconds. All children use the same parent
      // progress, but each keeps its package-authored aspect ratio.
      const animationDuration = QR_COMPOSITION.expansionDuration;
      const progress = `min(max((t-${animationStart})/${animationDuration}\\,0)\\,1)`;
      const easedProgress = qrEase(progress, 0.167, 0, 0.833, 0.839);
      const startRect = model.relative(isCta ? screen2Cta?.layer : screen2Qr?.layer);
      const end = model.relative(input.layer);
      if (!isCta && groupedPanel) {
        // The QR is composited with its white backing below. Giving the two
        // independent overlays separate position curves lets them drift.
        input.groupedQr = true;
        continue;
      }
      const width = `${startRect.width}+(${end.width}-${startRect.width})*${easedProgress}`;
      const height = `${startRect.height}+(${end.height}-${startRect.height})*${easedProgress}`;
      const x = `${startRect.x}+(${end.x}-${startRect.x})*${easedProgress}`;
      const y = `${startRect.y}+(${end.y}-${startRect.y})*${easedProgress}`;
      // Use the PSD-authored Screen 2 and Screen 3 rectangles so the
      // transition follows the same geometry as the Blender/production
      // template for each package, rather than relying on fixed coordinates.
      graph.push(`[${index}:v]format=rgba,scale=w='${width}':h='${height}':eval=frame[asset${index}]`);
      input.dynamicOverlay = { x, y };
      continue;
    }
    if (model.format === "ctv" && input.role === "screen3" &&
      /^tagline$/i.test(String(input.layer?.name || "").trim())) {
      // Blender places the final tagline inside the mobile frame at the
      // authored Screen3 coordinates. It fades in after the frame has begun
      // expanding, rather than staying on the background throughout.
      graph.push(`[${index}:v]${alphaFilter(input, true, duration)}[asset${index}]`);
      const tagline = model.screen3?.overlays.find(item => /^tagline$/i.test(String(item.layer?.name || "").trim()));
      const taglinePos = model.relative(tagline?.layer);
      input.dynamicOverlay = { x: String(taglinePos?.x ?? 1382), y: String(taglinePos?.y ?? 232) };
      continue;
    }
    if (groupedPanel && input.role === "screen3" &&
      /^scanAnchor$/i.test(String(input.layer?.name || "").trim())) {
      const anchor = model.relative(input.layer);
      const scanStart = Math.max(3, duration - 4);
      const scanDuration = 0.5;
      const progress = `min(max((t-${scanStart})/${scanDuration}\\,0)\\,1)`;
      const spread = qrEase(progress, 0.167, 0, 0.833, 1);
      // The asset's exported bounds are its outer/final state. Its opening
      // state hugs the QR itself, then all four corners move out together.
      const width = `${largeQr.width}+(${anchor.width}-${largeQr.width})*${spread}`;
      const height = `${largeQr.height}+(${anchor.height}-${largeQr.height})*${spread}`;
      // overlay caches the secondary input's initial dimensions. Changing
      // those dimensions per frame clips the growing right/bottom edges and
      // looks like a leftward slide. Keep its canvas at the final size and
      // animate only the artwork inside that transparent canvas.
      graph.push(`[${index}:v]format=rgba,scale=w='${width}':h='${height}':eval=frame,pad=${anchor.width}:${anchor.height}:x='(ow-iw)/2':y='(oh-ih)/2':eval=frame:color=black@0,${alphaFilter(input, true, duration)}[asset${index}]`);
      input.dynamicOverlay = { x: String(anchor.x), y: String(anchor.y) };
      continue;
    }
    graph.push(`[${index}:v]${alphaFilter(input, Boolean(model.screen3), duration)}[asset${index}]`);
  }

  if (groupedPanel) {
    const transitionStart = Math.max(3, duration - 8);
    const elapsed = QR_COMPOSITION.expansionDuration;
    const progress = `min(max((t-${transitionStart})/${elapsed}\\,0)\\,1)`;
    // The QR composition's position/size keyframes use cubic Bezier easing.
    // Only the glass shape stretches in both axes. Stretching the whole
    // composition would squash the QR, its circular markers, and the CTA.
    const panelSizeEase = qrEase(progress, 0.167, 0, 0.833, 1);
    const backingSizeEase = qrEase(progress, 0.167, 0, 0.833, 0.839);
    const large = ctvLargePanel;
    const small = ctvSmallPanel;
    const animatedWidth = `${small.width}+(${large.width}-${small.width})*${panelSizeEase}`;
    const animatedHeight = `${small.height}+(${large.height}-${small.height})*${panelSizeEase}`;
    // pad can read the scaled dimensions but not t; map the authored size
    // curve back to each shape's distinct authored position curve.
    const panelPosition = qrMappedEase(`(iw-${small.width})/(${large.width}-${small.width})`,
      [0.167, 0, 0.833, 1], [0.167, 0, 0.833, 0.97]);
    const panelX = `${small.x}+(${large.x}-${small.x})*${panelPosition}`;
    const panelY = `${small.y}+(${large.y}-${small.y})*${panelPosition}`;
    // Blur the actual backdrop and headline that sit behind the glass, not
    // Screen 3's mostly empty sky image. The blur is visible only through
    // the panel mask; the surrounding backdrop stays sharp.
    graph.push(`[screen2GlassSource]gblur=sigma=${QR_COMPOSITION.gaussianBlur},boxblur=${QR_COMPOSITION.edgeBlur}:1,format=rgba,split=2[collapsedBlurSource][expandedBlurSource]`);
    // The small no-phone frame is glass before expansion too. Use the
    // exported small frame's alpha as a fully opaque blur mask, while its
    // translucent white artwork is composited separately above the blur.
    graph.push(`[collapsedFrameMaskSource]format=rgba,alphaextract,crop=${small.width}:${small.height}:${small.x}:${small.y},lut=y='if(gt(val,0),255,0)',pad=${model.width}:${model.height}:${small.x}:${small.y}:black[collapsedGlassMask]`);
    graph.push(`[collapsedBlurSource][collapsedGlassMask]alphamerge[collapsedGlass]`);
    const backingCutout = {
      x: largeQrBacking.x - large.x,
      y: largeQrBacking.y - large.y,
      width: largeQrBacking.width,
      height: largeQrBacking.height
    };
    const backingWidth = `${smallQrBacking.width}+(${largeQrBacking.width}-${smallQrBacking.width})*${backingSizeEase}`;
    const qrSizeEase = qrEase(progress, 0.167, 0, 0.833, 0.839);
    const qrPositionEase = qrEase(progress, 0.167, 0, 0.667, 1);
    const qrWidth = `${smallQr.width}+(${largeQr.width}-${smallQr.width})*${qrSizeEase}`;
    const qrHeight = `${smallQr.height}+(${largeQr.height}-${smallQr.height})*${qrSizeEase}`;
    const backingCanvas = largeQrBacking.width;
    const qrGroupX = `${smallQrBacking.x}+${smallQrBacking.width}/2+(${largeQrBacking.x}+${largeQrBacking.width}/2-${smallQrBacking.x}-${smallQrBacking.width}/2)*${qrPositionEase}-${backingCanvas}/2`;
    const qrGroupY = `${smallQrBacking.y}+${smallQrBacking.height}/2+(${largeQrBacking.y}+${largeQrBacking.height}/2-${smallQrBacking.y}-${smallQrBacking.height}/2)*${qrPositionEase}-${backingCanvas}/2`;
    // The white QR backing is baked into the exported frame PNG. Replace its
    // pixels with the same 25% white glass used by the surrounding panel,
    // rather than cutting a transparent hole. That hole would stretch with
    // the tall panel and become visible below the square QR backing mid-way
    // through expansion. Animate the extracted white square with the QR.
    graph.push(`[${screen3FrameIndex}:v]format=rgba,split=2[panelFrameSource][qrBackingSource]`);
    graph.push(`[panelFrameSource]crop=${large.width}:${large.height}:${large.x}:${large.y},drawbox=x=${backingCutout.x}:y=${backingCutout.y}:w=${backingCutout.width}:h=${backingCutout.height}:c=white@0.25:t=fill:replace=1,scale=w='${animatedWidth}':h='${animatedHeight}':eval=frame,pad=${model.width}:${model.height}:x='${panelX}':y='${panelY}':eval=frame:color=black@0,split=2[panelMaskSource][expandedPanel]`);
    // Scale each package asset inside the same fixed square, then move that
    // square once. This preserves authored QR sizes while locking both
    // centers to the backing on every frame of the expansion.
    graph.push(`[qrBackingSource]crop=${largeQrBacking.width}:${largeQrBacking.height}:${largeQrBacking.x}:${largeQrBacking.y},scale=w='${backingWidth}':h='${backingWidth}':eval=frame,pad=${backingCanvas}:${backingCanvas}:x='(ow-iw)/2':y='(oh-ih)/2':eval=frame:color=black@0[qrBackingCanvas]`);
    graph.push(`[${screen3QrIndex}:v]format=rgba,scale=w='${qrWidth}':h='${qrHeight}':eval=frame,pad=${backingCanvas}:${backingCanvas}:x='(ow-iw)/2':y='(oh-ih)/2':eval=frame:color=black@0[qrArtworkCanvas]`);
    graph.push(`[qrBackingCanvas][qrArtworkCanvas]overlay=0:0:format=auto[expandedQrGroup]`);
    // The exported frame is deliberately low-opacity glass. Its nonzero
    // alpha defines the shape; the blur itself must be fully opaque inside
    // that shape, otherwise the unblurred headline leaks through it.
    graph.push(`[panelMaskSource]alphaextract,lut=y='if(gt(val,0),255,0)'[panelMask]`);
    graph.push(`[expandedBlurSource][panelMask]alphamerge[expandedGlass]`);
    model.collapsedGlass = { x: 0, y: 0 };
    model.expandedPanel = { x: 0, y: 0 };
    model.expandedQrGroup = { x: qrGroupX, y: qrGroupY };
  }

  let current = "base";
  let stage = 0;
  function overlay(label, x, y, enable = null) {
    const next = `stage${stage++}`;
    const suffix = enable ? `:enable='${enable}'` : "";
    graph.push(`[${current}][${label}]overlay=x=${x}:y=${y}:eval=frame:eof_action=pass${suffix}[${next}]`);
    current = next;
  }

  const disclaimerIndex = inputs.findIndex(input => input.role === "disclaimer");
  function overlayDisclaimer() {
    if (disclaimerIndex < 0) return;
    const pos = model.relative(inputs[disclaimerIndex].layer);
    overlay(`asset${disclaimerIndex}`, pos.x, pos.y);
  }

  // The collapsed glass has the same blur as the expanded glass from its
  // first visible frame. The opening video remains above it during retraction.
  if (groupedPanel) {
    overlay("collapsedGlass", model.collapsedGlass.x, model.collapsedGlass.y,
      `lt(t,${Math.max(3, duration - 8)})`);
  }

  // Both CTV and OTT keep the ISI below the opaque retracting video.
  overlayDisclaimer();

  // Screen 2's complete QR lockup sits under the opening video from frame
  // one. As that video shrinks into its inset, the QR is uncovered in place.
  if (groupedPanel) {
    for (let index = 1; index < inputs.length; index += 1) {
      const input = inputs[index];
      if (input.role !== "screen2" || input.isBase ||
        !/^(qrcode|bringitalive|nophone frame)$/i.test(String(input.layer?.name || "").trim())) continue;
      const pos = model.relative(input.layer);
      overlay(`asset${index}`, pos.x, pos.y, `lt(t,${Math.max(3, duration - 8)})`);
    }
  }

  if (model.peelVideoPosition) overlay("peelVideo", model.peelVideoPosition.x, model.peelVideoPosition.y);

  const introIndexes = inputs.map((input, index) => input.role === "intro" ? index : -1)
    .filter(index => index >= 0)
    .sort((left, right) => Number(/^peel$/i.test(inputs[left].layer?.name || "")) -
      Number(/^peel$/i.test(inputs[right].layer?.name || "")));
  const peelLayer = model.intro.find(item => /^peel$/i.test(item.layer?.name || ""));
  const peelPosition = peelLayer && model.relative(peelLayer.layer);
  const peelExitDistance = Math.max(0, model.width - (peelPosition?.x ?? model.width));
  for (const index of introIndexes) {
    const pos = model.relative(inputs[index].layer);
    if (model.peelVideoPosition) {
      const p = `min(max((t-3)/1\\,0)\\,1)`;
      // Both package layers are one peel assembly. The logo stays behind the
      // curled peel, and both receive exactly the same horizontal transform.
      const easeOut = `1-(1-(${p}))*(1-(${p}))*(1-(${p}))`;
      // Exported peelLogo begins one pixel above the peel. Align the two
      // package layers so the logo's white top row cannot protrude.
      const peelY = /^peelLogo$/i.test(inputs[index].layer?.name || "") && peelPosition
        ? peelPosition.y : pos.y;
      overlay(`asset${index}`, `${pos.x}+${peelExitDistance}*(${easeOut})`, peelY);
    } else overlay(`asset${index}`, pos.x, pos.y);
  }

  for (let index = 1; index < inputs.length; index += 1) {
    if (inputs[index].role !== "screen2" || !inputs[index].isBase || model.peelVideoPosition) continue;
    const pos = model.relative(inputs[index].layer);
    overlay(`asset${index}`, pos.x, pos.y);
  }

  // Transparent frame, QR, and CTA assets sit above the inset video.
  for (let index = 1; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (input.role !== "screen2" || input.isBase) continue;
    const pos = model.relative(input.layer);
    const collapsedQrStack = groupedPanel && /^(qrcode|bringitalive|nophone frame)$/i.test(String(input.layer?.name || "").trim());
    if (collapsedQrStack) continue;
    overlay(`asset${index}`, pos.x, pos.y);
  }

  if (model.screen3) {
    for (let index = 1; index < inputs.length; index += 1) {
      if (inputs[index].role !== "screen3" || !inputs[index].isBase) continue;
      if (groupedPanel) continue;
      if (inputs[index].cropOverlay) {
        overlay(`asset${index}`, inputs[index].cropOverlay.x, inputs[index].cropOverlay.y);
        continue;
      }
      const pos = model.relative(inputs[index].layer);
      overlay(`asset${index}`, pos.x, pos.y);
    }
    if (model.format !== "ctv") overlay("inset3", frame.x, frame.y);
    if (groupedPanel) {
      const expanded = `gte(t,${Math.max(3, duration - 8)})`;
      overlay("expandedGlass", model.expandedPanel.x, model.expandedPanel.y, expanded);
      overlay("expandedPanel", model.expandedPanel.x, model.expandedPanel.y, expanded);
      overlay("expandedQrGroup", model.expandedQrGroup.x, model.expandedQrGroup.y, expanded);
    }
    for (let index = 1; index < inputs.length; index += 1) {
      const input = inputs[index];
      if (input.role !== "screen3" || input.isBase) continue;
      if (groupedPanel && (index === screen3FrameIndex || index === screen3SmallFrameIndex)) continue;
      if (input.groupedQr) continue;
      if (input.dynamicOverlay) {
        const expandingQrStack = groupedPanel && /^(qrcode|bringitalive)$/i.test(String(input.layer?.name || "").trim());
        overlay(`asset${index}`, input.dynamicOverlay.x, input.dynamicOverlay.y,
          expandingQrStack ? `gte(t,${Math.max(3, duration - 8)})` : null);
        continue;
      }
      const pos = model.relative(input.layer);
      overlay(`asset${index}`, pos.x, pos.y);
    }
  }

  graph.push(`[${current}]fps=${FPS},format=yuv420p[outv]`);
  return graph.join(";");
}

async function probeDuration(file) {
  const result = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file
  ]);
  return Number.parseFloat(result.stdout.trim());
}

async function renderPackage(zipPath, format, outputPath) {
  const workDir = await mkdtemp(join(tmpdir(), "turbo-video-render-"));
  try {
    const unpacked = join(workDir, "package");
    await mkdir(unpacked);
    await run("/usr/bin/unzip", ["-q", zipPath, "-d", unpacked]);
    const files = await walkFiles(unpacked);
    const exportPath = files.find(file => basename(file).toLowerCase() === "export.json");
    if (!exportPath) throw new Error("No export.json was found in the package.");
    const data = JSON.parse(await readFile(exportPath, "utf8"));
    const model = packageModel(data, files, format);
    if (model.width !== 1920 || model.height !== 1080) {
      throw new Error(`${format.toUpperCase()} must be authored at 1920×1080; found ${model.width}×${model.height}.`);
    }
    const duration = await probeDuration(model.videoFile);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("The CTV/OTT source video has no readable duration.");
    if (duration > MAX_DURATION) throw new Error(`Source video exceeds the ${MAX_DURATION}-second CTV/OTT limit.`);
    const inputs = ffmpegInputs(model);
    const args = ["-hide_banner", "-y", "-i", inputs[0].file];
    for (const input of inputs.slice(1)) {
      args.push("-loop", "1", "-framerate", FPS, "-t", String(duration), "-i", input.file);
    }
    args.push(
      "-filter_complex", buildFilter(model, inputs, duration),
      "-map", "[outv]",
      "-map", "0:a?",
      "-t", String(duration),
      "-c:v", "libx264",
      "-preset", "medium",
      "-b:v", "15M",
      "-minrate", "15M",
      "-maxrate", "15M",
      "-bufsize", "30M",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "320k",
      "-ar", "48000",
      "-ac", "2",
      "-movflags", "+faststart",
      outputPath
    );
    await run("ffmpeg", args);
    return outputPath;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

function jsonResponse(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function receivePackage(request, target) {
  let received = 0;
  const chunks = [];
  for await (const chunk of request) {
    received += chunk.length;
    if (received > MAX_PACKAGE_BYTES) throw new Error("Package exceeds the 1 GB local-render limit.");
    chunks.push(chunk);
  }
  await writeFile(target, Buffer.concat(chunks));
}

async function handleRender(request, response, url) {
  const format = String(url.searchParams.get("format") || "ctv").toLowerCase();
  if (!new Set(["ctv", "ott"]).has(format)) return jsonResponse(response, 400, { error: "Format must be ctv or ott." });
  const requestDir = await mkdtemp(join(tmpdir(), "turbo-preview-request-"));
  const zipPath = join(requestDir, "package.zip");
  const outputPath = join(requestDir, `turbo_${format}_preview.mp4`);
  try {
    await receivePackage(request, zipPath);
    await renderPackage(zipPath, format, outputPath);
    const info = await stat(outputPath);
    response.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": info.size,
      "Content-Disposition": `attachment; filename=\"turbo_${format}_preview.mp4\"`,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    });
    const stream = createReadStream(outputPath);
    stream.pipe(response);
    stream.on("close", () => rm(requestDir, { recursive: true, force: true }));
  } catch (error) {
    await rm(requestDir, { recursive: true, force: true });
    jsonResponse(response, 422, { error: error?.message || String(error) });
  }
}

async function startServer() {
  if (!existsSync(HTML_FILE)) throw new Error(`Missing ${HTML_FILE}`);
  if (!(await commandExists("ffmpeg"))) throw new Error("FFmpeg is not available on PATH.");
  const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://${HOST}:${PORT}`);
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,X-Package-Name"
      });
      return response.end();
    }
    if (request.method === "GET" && url.pathname === "/health") return jsonResponse(response, 200, { ok: true, build: "7.12.0", renderer: "ffmpeg" });
    if (request.method === "POST" && url.pathname === "/render") return handleRender(request, response, url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/turbo-preview-7.12.0.html")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return createReadStream(HTML_FILE).pipe(response);
    }
    jsonResponse(response, 404, { error: "Not found" });
  });
  server.listen(PORT, HOST, () => {
    console.log(`Turbo Preview 7.12.0: http://${HOST}:${PORT}/`);
    console.log("Press Ctrl+C to stop the local renderer.");
  });
}

const cli = process.argv.slice(2);
if (cli[0] === "render") {
  const [, zipPath, format = "ctv", outputPath = resolve(`turbo_${format}_preview.mp4`)] = cli;
  if (!zipPath) throw new Error("Usage: node ffmpeg_preview_server.mjs render package.zip [ctv|ott] [output.mp4]");
  await renderPackage(resolve(zipPath), format.toLowerCase(), resolve(outputPath));
  console.log(resolve(outputPath));
} else {
  await startServer();
}
