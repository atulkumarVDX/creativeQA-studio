/* Raw export descriptors remain heterogeneous across Photoshop plugin versions. */
import { MAX_PACKAGE_SIZE_BYTES } from "@/config/package";
import type { PackageCustomAsset, PackageFont } from "@/types/package";
import { makeFinding } from "@/lib/qa-engine/findings";
import { formatBytes } from "@/lib/qa-engine/format";
import { normalizeLayerText } from "@/lib/qa-engine/text-analysis";
import type { AssetRecord, Finding, Severity } from "@/lib/qa-engine";
import type { Layer, LayerContext, ZipAsset } from "@/lib/qa-engine/types";

function packagePath(value: unknown) { return String(value ?? ""); }
function bytes(value: unknown) { return Number.isFinite(Number(value)) ? Number(value) : 0; }
function extension(name: string) { return (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "file").toUpperCase(); }

export function analyzePackageAssets(input: { layers: Layer[]; contexts: LayerContext[]; customAssets: PackageCustomAsset[]; fontsData: PackageFont[]; artboardLayers: Layer[]; zipAssets: ZipAsset[]; packageSizeBytes?: number }) {
  const { layers, contexts, customAssets, fontsData, artboardLayers, zipAssets, packageSizeBytes } = input;
  const findings: Finding[] = [];
  type DeclaredReference = { count: number; allowRetinaFallback: boolean; displayName: string };
  const declaredReferences = new Map<string, DeclaredReference>();
  const addReference = (name: unknown, allowRetinaFallback = false) => {
    const value = packagePath(name);
    if (!value) return;
    const current = declaredReferences.get(value);
    declaredReferences.set(value, {
      count: (current?.count || 0) + 1,
      allowRetinaFallback: Boolean(current?.allowRetinaFallback || allowRetinaFallback),
      displayName: current?.displayName || value,
    });
  };
  customAssets.forEach(asset => addReference(asset.fileName, true));
  fontsData.forEach(font => addReference(font.fileName));
  layers.forEach(layer => {
    const match = /^v\d+\s*:\s*([^\[]+)/i.exec(String(layer.name ?? ""));
    // Whitespace around the filename belongs to the playlist marker syntax,
    // not to the packaged filename itself.
    if (match) addReference(match[1].trim());
    const linked = layer.smartObject?.linked === true
      ? layer.smartObject.fileReference || layer.smartObject.link?._path
      : null;
    if (linked) addReference(String(linked).split(/[\\/]/).pop(), true);
  });
  const hasIsi = contexts.some(context => Boolean(context.artboard) && normalizeLayerText(context.layer.name).toLowerCase() === "isi")
    || layers.some(layer => /^ISI_preQual_\d+x\d+\.png$/i.test(packagePath(layer.name)));

  const exportEntry = zipAssets.find(asset => /(^|\/)export\.json$/i.test(packagePath(asset.name)));
  const exportPath = packagePath(exportEntry?.name);
  const basePrefix = exportPath ? exportPath.slice(0, exportPath.length - "export.json".length) : "";
  const relativeAssets = zipAssets
    .map(asset => ({ asset, path: packagePath(asset.name) }))
    .filter(item => !basePrefix || item.path.startsWith(basePrefix))
    .map(item => ({ asset: item.asset, path: item.path.slice(basePrefix.length) }))
    .filter(item => item.path && !/(^|\/)export\.json$/i.test(item.path));
  // Retain videos outside the export folder for creative-wide validation.
  if (basePrefix) zipAssets.filter(asset => !asset.name.startsWith(basePrefix) && /\.(?:mp4|webm|mov|m4v)$/i.test(asset.name))
    .forEach(asset => relativeAssets.push({ asset, path: asset.name }));
  const available = new Set(relativeAssets.map(item => item.path));

  // disclaimer.html is a runtime dependency only when the package declares an
  // ISI marker. The preview intentionally discovers its name case-insensitively.
  if (hasIsi) {
    const disclaimer = relativeAssets.find(item => /(^|\/)disclaimer\.html$/i.test(item.path));
    addReference(disclaimer?.path || "disclaimer.html");
  }

  // Ordinary raster layers are referenced by the renderer's name-layerID convention.
  layers.forEach(layer => {
    if (!layer.name || !Number.isFinite(layer.layerID) || layer.textKey) return;
    const oneX = `${layer.name}-${layer.layerID}.png`;
    const twoX = `${layer.name}-${layer.layerID}-2x.png`;
    if (available.has(oneX)) addReference(oneX);
    if (available.has(twoX)) addReference(twoX);
  });

  const resolvedReferenceCounts = new Map<string, number>();
  for (const [name, reference] of declaredReferences) {
    const retryName = reference.allowRetinaFallback && /\.png$/i.test(name)
      ? name.replace(/\.png$/i, "-2x.png")
      : "";
    const resolvedName = available.has(name) ? name : retryName && available.has(retryName) ? retryName : "";
    if (resolvedName) {
      resolvedReferenceCounts.set(resolvedName, (resolvedReferenceCounts.get(resolvedName) || 0) + reference.count);
    } else {
      findings.push(makeFinding({
        ruleId: "assets.declared-missing",
        severity: "error",
        confidence: "high",
        title: "Missing assets",
        message: `${reference.displayName} is used in the creative but is not included in this package.`,
      }));
    }
  }

  // Static first-tab candidates, including all interaction states: visibility is
  // deliberately ignored because rollover/hidden state artwork may be preloaded.
  const scopePaths = new Map<string, Set<string>>();
  const custom = new Map(customAssets.map(item => [String(item.layerID), item.fileName]));
  const resolve = (name: string) => available.has(name) ? name
    : /\.png$/i.test(name) && available.has(name.replace(/\.png$/i, "-2x.png"))
      ? name.replace(/\.png$/i, "-2x.png") : "";
  for (const artboard of artboardLayers) {
    const scope = normalizeLayerText(artboard.name);
    const members = contexts.filter(c => c.artboard === scope && !c.excluded);
    const tabs = members.map(c => c.tab).filter(Boolean);
    const firstTab = tabs.sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))[0];
    const paths = new Set<string>();
    for (const c of members) {
      if (c.tab && c.tab !== firstTab) continue;
      if (c.layer.textKey || c.layer.layerSection?._value === "layerSectionStart" || c.layer.artboard) continue;
      const linked = c.layer.smartObject?.linked === true
        ? String(c.layer.smartObject.fileReference || c.layer.smartObject.link?._path || "").split(/[\\/]/).pop() : "";
      const name = String(custom.get(String(c.layer.layerID)) || linked || `${c.layer.name}-${c.layer.layerID}.png`);
      const resolved = resolve(name);
      if (resolved) paths.add(resolved);
    }
    scopePaths.set(scope, paths);
  }
  const primaryVideoNames = new Set<string>(["video1.mp4"]);
  for (const context of contexts) {
    if (context.excluded) continue;
    const match = /^v1\s*:\s*([^\[]+)/i.exec(String(context.layer.name ?? ""));
    if (match) primaryVideoNames.add(match[1].trim());
  }
  const isCtvOttVideo = (path: string) => /^video_ctvott\.(?:mp4|webm|mov|m4v)$/i.test(path.split("/").pop() || path);
  const firstViewInfo = (path: string) => {
    const base = path.split("/").pop() || path;
    if (primaryVideoNames.has(path)) return { scopes: [...scopePaths.keys()], reason: "Primary video" };
    if (/\.(?:mp4|webm|mov|m4v)$/i.test(path)) return { scopes: [], reason: "Other video" };
    if (/^(?:video\d+|teaserVideo)\.jpe?g$/i.test(base)) return { scopes: [...scopePaths.keys()], reason: "Autogenerated poster excluded from validation" };
    const shared = /\.(?:css|js|mjs|woff2?|ttf|otf|eot)$/i.test(path)
      || /^(?:teaserLogo|peelLogo)(?:-\d+)?\.[a-z0-9]+$/i.test(base);
    return {
      scopes: [...scopePaths].filter(([, paths]) => shared || paths.has(path)).map(([scope]) => scope),
      reason: shared ? "Shared dependency candidate; confirm loading and framework exclusions" : "First-tab artwork including preloaded interaction states",
    };
  };
  const assets = relativeAssets
    .map(({ asset, path }) => {
      const baseName = path.split("/").pop() || path;
      const referenceCount = resolvedReferenceCounts.get(path) || 0;
      const isSystem = /^(?:export\.log|errors\.txt|\.ds_store)$/i.test(baseName);
      return {
        name: path,
        firstViewScopes: firstViewInfo(path).scopes,
        firstViewReason: firstViewInfo(path).reason,
        validationErrors: [],
        validationWarnings: [],
        durationSeconds: asset.durationSeconds,
        firstViewBudgetExcluded: /\.(?:mp4|webm|mov|m4v)$/i.test(path) || /^(?:video\d+|teaserVideo)\.jpe?g$/i.test(baseName),
        compressedSize: bytes(asset.compressedSize),
        uncompressedSize: bytes(asset.uncompressedSize),
        extension: extension(baseName),
        status: isSystem ? "system" : referenceCount ? "referenced" : "unreferenced",
        referenceCount,
      } as AssetRecord;
    })
    .sort((a, b) => b.uncompressedSize - a.uncompressedSize);
  const videos = assets.filter(asset => /^(?:mp4|webm|mov|m4v)$/i.test(asset.extension)).map(asset => ({ name: asset.name.split("/").pop() || asset.name, path: asset.name, size: asset.uncompressedSize }));

  const firstViews = [...scopePaths.keys()].map(artboard => {
    const totalBytes = assets.filter(a => a.firstViewScopes.includes(artboard) && !a.firstViewBudgetExcluded).reduce((sum, a) => sum + a.uncompressedSize, 0);
    return { artboard, totalBytes, status: totalBytes >= 500 * 1024 ? "over-limit" as const : "review" as const };
  });
  const budgetFinding = (ruleId: string, title: string, message: string, artboard?: string) => {
    findings.push({ ...makeFinding({ ruleId, title, message, artboard, severity: "error", confidence: "high" }),
      category: "Assets", reason: message,
      suggestedFix: "Optimize or defer the listed assets. Confirm served first-view requests, framework exclusions and long-form handling before sign-off." });
  };
  for (const view of firstViews) {
    if (view.status === "over-limit") {
      assets.filter(a => a.firstViewScopes.includes(view.artboard) && !a.firstViewBudgetExcluded).forEach(a => a.validationErrors.push(`${view.artboard}: combined first-view assets must be under 500 KB (${formatBytes(view.totalBytes)}).`));
      budgetFinding("assets.first-view-budget", "First-view assets reach the 500 KB limit.",
      `${view.artboard}: ${view.totalBytes} bytes. First-view assets must be strictly below 512000 bytes. Video and autogenerated posters are excluded.`, view.artboard);
    }
  }
  // Count every packaged video once, including playlists, CTV/OTT and files
  // outside the export.json directory. Archive compression is not video size.
  const packagedVideos = [...new Map(zipAssets.filter(asset => /\.(?:mp4|webm|mov|m4v)$/i.test(asset.name)).map(asset => [asset.name, asset])).values()];
  const totalVideoBytes = packagedVideos.reduce((sum, asset) => sum + bytes(asset.uncompressedSize), 0);
  if (totalVideoBytes > 500 * 1024 * 1024) {
    const message = `All videos combined exceed 500 MB (${formatBytes(totalVideoBytes)}).`;
    assets.filter(asset => /^(?:mp4|webm|mov|m4v)$/i.test(asset.extension)).forEach(asset => asset.validationErrors.push(message));
    budgetFinding("assets.total-video-size", "Combined video size exceeds 500 MB.", message);
  }
  if (packageSizeBytes != null && packageSizeBytes > MAX_PACKAGE_SIZE_BYTES)
    budgetFinding("assets.package-size", "ZIP/package exceeds 600 MB.", `ZIP/package is ${formatBytes(packageSizeBytes)}; maximum 600 MB.`);
  // Container timestamps can place a nominal 30-second clip a few frames
  // beyond the boundary (for example, 720 frames at 24000/1001 fps is 30.03s).
  // Keep a small allowance for metadata/frame rounding at the long-form limit.
  const videoDurationRoundingToleranceSeconds = 0.05;
  for (const asset of assets) {
    const base = asset.name.split("/").pop() || asset.name;
    if (/^(?:teaserLogo|peelLogo)(?:-\d+)?\.[a-z0-9]+$/i.test(base) && asset.uncompressedSize > 10 * 1024) {
      asset.validationErrors.push("Teaser logo exceeds 10 KB.");
      budgetFinding("assets.teaser-logo-size", "Teaser logo exceeds 10 KB.", `${asset.name}: ${asset.uncompressedSize} bytes; maximum 10240 bytes.`);
    }
    const videoValidation = primaryVideoNames.has(asset.name)
      ? { rulePrefix: "primary-video", label: "Primary video" }
      : isCtvOttVideo(asset.name)
        ? { rulePrefix: "ctv-ott-video", label: "CTV/OTT video" }
        : /\.(?:mp4|webm|mov|m4v)$/i.test(asset.name) ? { rulePrefix: "video", label: "Video" } : null;
    if (videoValidation) {
      const duration = asset.durationSeconds;
      const addVideoFinding = (ruleId: string, message: string, severity: Severity) => {
        (severity === "error" ? asset.validationErrors : asset.validationWarnings).push(message);
        findings.push({ ...makeFinding({ ruleId, title: message, message: `${asset.name}: ${message}`, severity, confidence: "high" }),
          category: "Assets", reason: message, suggestedFix: severity === "error" ? "Escalate videos longer than 4 minutes 30 seconds to the AdEx team." : "Optimize the video or confirm long-form handling." });
      };
      // The CTV/OTT renderer accepts its dedicated package video above the
      // banner-video limit. Duration validation still applies.
      if (!isCtvOttVideo(asset.name) && asset.uncompressedSize > 2.5 * 1024 * 1024)
        addVideoFinding(`assets.${videoValidation.rulePrefix}-size`, `${videoValidation.label} exceeds 2.5 MB.`, "warning");
      if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
        if (duration > 270) addVideoFinding(`assets.${videoValidation.rulePrefix}-duration`, `${videoValidation.label} exceeds 4 minutes 30 seconds. Escalate to the AdEx team.`, "error");
        else if (duration > 30 + videoDurationRoundingToleranceSeconds) addVideoFinding(`assets.${videoValidation.rulePrefix}-duration`, `${videoValidation.label} exceeds 30 seconds; confirm long-form handling.`, "warning");
      } else {
        addVideoFinding(`assets.${videoValidation.rulePrefix}-duration-unavailable`, "Video duration could not be verified.", "warning");
      }
    }
  }
  return { assets, videos, firstViews, findings };
}
