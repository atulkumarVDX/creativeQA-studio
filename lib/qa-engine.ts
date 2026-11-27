/* Raw export.json descriptors are intentionally heterogeneous and versioned externally. */
import type { PackageCustomAsset, PackageExportData, PackageFont } from "@/types/package";
import { makeFinding } from "@/lib/qa-engine/findings";
import { analyzeTextFindings, getText, normalizeLayerText } from "@/lib/qa-engine/text-analysis";
import { analyzeConsistencyFindings } from "@/lib/qa-engine/consistency-analysis";
import { analyzePackageAssets } from "@/lib/qa-engine/asset-analysis";
import type { Layer, LayerContext, ZipAsset } from "@/lib/qa-engine/types";

export { formatBytes } from "@/lib/qa-engine/format";

export type Severity = "error" | "warning" | "info";

export type FindingHighlight = {
  prefix: string;
  value: string;
  suffix: string;
};

export type Finding = {
  id: string;
  ruleId: string;
  severity: Severity;
  confidence: "high" | "medium" | "low";
  title: string;
  message: string;
  artboard?: string;
  tab?: string;
  slide?: string;
  layerName?: string;
  layerId?: number;
  evidence?: string;
  highlight?: FindingHighlight;
  category: string;
  suggestedFix: string;
  reason: string;
};

export type AssetRecord = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  extension: string;
  status: "referenced" | "unreferenced" | "system";
  referenceCount: number;
  firstViewScopes: string[];
  firstViewReason: string;
  validationErrors: string[];
  validationWarnings: string[];
  durationSeconds?: number;
  firstViewBudgetExcluded: boolean;
};

export type PackageSummary = {
  creativeName: string;
  sourceFile: string;
  templateVersion: string;
  pluginVersion: string;
  artboards: string[];
  tabCount: number;
  slideCount: number;
  textLayerCount: number;
  ctaCount: number | null;
  ctaReferenceArtboard: string | null;
  tabs: string[];
  components: { name: string; count: number }[];
  fonts: string[];
  colorCount: number;
  colors: { hex: string; count: number }[];
  videos: { name: string; path: string; size: number }[];
  findings: Finding[];
  assets: AssetRecord[];
  firstViews: { artboard: string; totalBytes: number; status: "over-limit" | "review" }[];
};

const ARTBOARD_NAME = /^(?:\d+x\d+|mobile-instream)$/i;
const TAB_NAME = /^tab(?:Component[-_ ]?)?(\d+)$/i;
const SLIDE_NAME = /^slide(?:[-_ ]?)(\d+)$/i;
// CTA folders have a different export contract from map image buttons,
// JumpTo buttons and logo actions. Retain the evidenced legacy "button" name.
const CTA_GROUP_NAME = /^button(?:[1-9]\d*)?$/i;

function ctaImageRole(name: unknown) {
  // Preserve the role before a documented Assets Generator expression and
  // retina suffix. Arbitrary display names must not become background roles.
  return String(name ?? "").split(/\s+\+\s+/, 1)[0].trim().replace(/ 2x(?:l)?$/i, "");
}

export function analyzePackage(data: PackageExportData, zipAssets: ZipAsset[], sourceFile: string, packageSizeBytes?: number): PackageSummary {
  const layers: Layer[] = Array.isArray(data.rawLayers) ? data.rawLayers : [];
  const fontsData: PackageFont[] = Array.isArray(data.fonts) ? data.fonts as PackageFont[] : [];
  const customAssets: PackageCustomAsset[] = Array.isArray(data.customAssets) ? data.customAssets as PackageCustomAsset[] : [];
  const byId = new Map<number, Layer>();
  layers.forEach(layer => {
    if (Number.isFinite(layer.layerID)) byId.set(layer.layerID as number, layer);
  });

  const artboardSequence = new Map<number, number>(
    (Array.isArray(data.document?.artboards) ? data.document.artboards : [])
      .map((id: unknown, index: number) => [Number(id), index]),
  );
  const artboardLayers = layers
    .filter(layer => layer.artboard && ARTBOARD_NAME.test(normalizeLayerText(layer.name)))
    .sort((a, b) => (artboardSequence.get(Number(a.layerID)) ?? Number.MAX_SAFE_INTEGER)
      - (artboardSequence.get(Number(b.layerID)) ?? Number.MAX_SAFE_INTEGER));
  const master = layers.find(layer => normalizeLayerText(layer.name).toLowerCase() === "master" && layer.artboard);

  function pathFor(layer: Layer) {
    const path: Layer[] = [];
    const visited = new Set<number>();
    let current: Layer | undefined = layer;
    while (current) {
      if (current.layerID && visited.has(current.layerID)) break;
      if (current.layerID) visited.add(current.layerID);
      path.unshift(current);
      current = Number.isFinite(current.parentLayerID) ? byId.get(current.parentLayerID as number) : undefined;
    }
    return path;
  }

  const contexts: LayerContext[] = layers.map(layer => {
    const path = pathFor(layer);
    const artboard = path.find(item => item.artboard && ARTBOARD_NAME.test(normalizeLayerText(item.name)));
    const tab = path.find(item => TAB_NAME.test(normalizeLayerText(item.name)));
    const slide = path.find(item => SLIDE_NAME.test(normalizeLayerText(item.name)));
    return {
      layer,
      artboard: normalizeLayerText(artboard?.name),
      tab: normalizeLayerText(tab?.name).toLowerCase(),
      slide: normalizeLayerText(slide?.name).toLowerCase(),
      path: path.map(item => normalizeLayerText(item.name)).filter(Boolean),
      excluded: path.some(item => String(item.name ?? "").startsWith(".")),
    };
  });

  const findings: Finding[] = [];
  if (!master) {
    findings.push(makeFinding({
      ruleId: "turbo.master-required",
      severity: "error",
      confidence: "high",
      title: "Master Artboard is missing. (critical issue)",
      message: "The creative cannot be published without the Master artboard.",
    }));
  }
  if (!artboardLayers.length) {
    findings.push(makeFinding({
      ruleId: "turbo.artboards-required",
      severity: "error",
      confidence: "high",
      title: "No supported creative sizes were found.",
      message: "Add at least one supported ad size to the package.",
    }));
  }

  function isCtaGroup(layer: Layer | undefined, context: typeof contexts[number]) {
    return Boolean(layer && layer.layerSection?._value === "layerSectionStart"
      && CTA_GROUP_NAME.test(String(layer.name ?? "").trim())
      && context.artboard && !context.excluded
      && !context.path.some(name => /^(?:locationMap|plugShareMap)/i.test(name)));
  }

  for (const context of contexts) {
    const parent = Number.isFinite(context.layer.parentLayerID)
      ? byId.get(context.layer.parentLayerID as number) : undefined;
    if (!isCtaGroup(parent, context) || context.layer.textKey
      || ![1, 5].includes(context.layer.layerKind ?? -1)) continue;
    const role = ctaImageRole(context.layer.name);
    if (role === "frame" || role === "background") continue;
    findings.push(makeFinding({
      ruleId: "structure.cta-ignored-image",
      severity: "warning",
      confidence: "high",
      title: `“${normalizeLayerText(context.layer.name)}” will not be included in this button.`,
      message: "The button export keeps text, frame, and background layers. This image is ignored.",
      evidence: `CTA owner: ${normalizeLayerText(parent?.name)} [${parent?.layerID}] · Image layer: ${context.layer.layerID} · PSD export guide: CTA Button, page 6`,
      artboard: context.artboard,
      tab: context.tab || undefined,
      slide: context.slide || undefined,
      layerName: normalizeLayerText(context.layer.name),
      layerId: context.layer.layerID,
    }));
  }

  const textContexts = contexts.filter(context => getText(context.layer));
  findings.push(...analyzeTextFindings(textContexts, byId, isCtaGroup));

  const tabNames = new Set(contexts.map(context => context.tab).filter(Boolean));
  const slideNames = new Set(contexts.map(context => context.slide).filter(Boolean));
  const tabs = [...tabNames].sort((a, b) => Number(a.match(/\d+/)?.[0] || 0) - Number(b.match(/\d+/)?.[0] || 0)).map((tab, index) => {
    const tabNumber = tab.match(/\d+/)?.[0] || String(index + 1);
    const labelLayer = layers.find(layer => new RegExp(`^title${tabNumber}_(?:normal|active|hover)$`, "i").test(normalizeLayerText(layer.name)) && layer.textKey?.textKey);
    return normalizeLayerText(labelLayer?.textKey?.textKey) || `Tab ${tabNumber}`;
  });
  // 970x546 is the Desktop Expandable reference state in the supported
  // package format. Count its CTA instances across tabs and slides only, so
  // the same CTA repeated at other ad sizes is not inflated in the overview.
  const ctaReferenceArtboard = artboardLayers
    .map(layer => normalizeLayerText(layer.name))
    .find(name => name.toLowerCase() === "970x546") || null;
  const ctaCount = ctaReferenceArtboard
    ? contexts.filter(context => context.artboard === ctaReferenceArtboard && isCtaGroup(context.layer, context)).length
    : null;
  const componentPattern = /^(tabComponent|videoComponent|rmGallery|colorPickerGallery|hotSpotGallery|categoryGallery|dotterGallery|locationMap|plugShareMap|view360|comparisonSlider|productGallery|staticProductGallery|countdown|dynamicCopy|scrollPane)(?:[-_ ]?\d+)?$/i;
  const componentCounts = new Map<string, number>();
  contexts.forEach(context => {
    if (context.layer.layerSection?._value !== "layerSectionStart" || context.excluded || !context.artboard) return;
    const match = normalizeLayerText(context.layer.name).match(componentPattern);
    if (match) componentCounts.set(match[1], (componentCounts.get(match[1]) || 0) + 1);
  });
  const fonts = new Set<string>();
  fontsData.forEach(font => { if (font.fontFamily) fonts.add(normalizeLayerText(font.fontFamily)); });
  textContexts.forEach(context => (context.layer.textKey?.textStyleRange || []).forEach(range => {
    const family = normalizeLayerText(range?.textStyle?.fontName || range?.textStyle?.fontPostScriptName);
    if (family) fonts.add(family);
  }));
  const colorCounts = new Map<string, number>();
  const visitColors = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const red = record.redFloat ?? record.red, green = record.greenFloat ?? record.grainFloat ?? record.grain ?? record.green, blue = record.blueFloat ?? record.blue;
    if ([red, green, blue].every(channel => Number.isFinite(Number(channel)))) {
      const channels = [red, green, blue].map(channel => Math.round(Math.max(0, Math.min(1, Number(channel) > 1 ? Number(channel) / 255 : Number(channel))) * 255));
      const hex = `#${channels.map(channel => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
    Object.values(record).forEach(visitColors);
  };
  layers.forEach(visitColors);

  findings.push(...analyzeConsistencyFindings(
    contexts,
    textContexts,
    artboardLayers.map(layer => normalizeLayerText(layer.name)),
  ));

  const assetAnalysis = analyzePackageAssets({ layers, contexts, customAssets, fontsData, artboardLayers, zipAssets, packageSizeBytes });
  findings.push(...assetAnalysis.findings);
  const { assets, videos, firstViews } = assetAnalysis;
  const documentName = normalizeLayerText(data.document?.title || data.document?.name).replace(/\.psd$/i, "");
  const packageName = sourceFile.replace(/\.zip$/i, "");
  const creativeName = documentName && !/^(?:turbo|template|untitled)$/i.test(documentName)
    ? documentName
    : packageName;

  const severityOrder = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title));

  return {
    creativeName,
    sourceFile,
    templateVersion: normalizeLayerText(data.templateVersion) || "Unknown",
    pluginVersion: normalizeLayerText(data.pluginVersion) || "Unknown",
    artboards: artboardLayers.map(layer => normalizeLayerText(layer.name)),
    tabCount: tabNames.size,
    slideCount: slideNames.size,
    textLayerCount: textContexts.length,
    ctaCount,
    ctaReferenceArtboard,
    tabs,
    components: [...componentCounts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
    fonts: [...fonts].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    colorCount: colorCounts.size,
    colors: [...colorCounts].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count).slice(0, 8),
    videos,
    findings,
    assets,
    firstViews,
  };
}
