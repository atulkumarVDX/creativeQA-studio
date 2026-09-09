/* Raw export.json descriptors are intentionally heterogeneous and versioned externally. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Severity = "error" | "warning" | "info";

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
};

export type AssetRecord = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  extension: string;
  status: "referenced" | "unreferenced" | "system";
  referenceCount: number;
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
  findings: Finding[];
  assets: AssetRecord[];
};

type Layer = Record<string, any> & {
  layerID?: number;
  parentLayerID?: number;
  name?: string;
  visible?: boolean;
};

type ZipAsset = {
  name: string;
  compressedSize?: number;
  uncompressedSize?: number;
};

const ARTBOARD_NAME = /^(?:\d+x\d+|mobile-instream)$/i;
const TAB_NAME = /^tab(?:Component[-_ ]?)?(\d+)$/i;
const SLIDE_NAME = /^slide(?:[-_ ]?)(\d+)$/i;
const DEFAULT_COPY = /^(?:lorem ipsum|headline goes here|subcopy goes here|button text|click here|learn more|read more|cta|sample text|your text here)$/i;
const CTA_NAME = /(?:^|[-_\s])(cta|button|btn)(?:\d+|[-_\s]|$)/i;

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function bytes(value: unknown) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** power;
  return `${amount >= 10 || power === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[power]}`;
}

function extension(name: string) {
  return (name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "file").toUpperCase();
}

function getText(layer: Layer) {
  return normalized(layer.textKey?.textKey);
}

function isOptical(layer: Layer) {
  const ranges = layer.textKey?.textStyleRange || [];
  return ranges.some((range: any) => range?.textStyle?.autoKern?._value === "opticalKern");
}

function hasRaisedTrademark(layer: Layer, text: string) {
  const markIndex = Math.max(text.indexOf("®"), text.indexOf("™"));
  if (markIndex < 0) return true;
  const ranges = layer.textKey?.textStyleRange || [];
  return ranges.some((range: any) => {
    if (!(range.from <= markIndex && range.to > markIndex)) return false;
    const style = range.textStyle || {};
    return style.baseline?._value === "superScript" || Number(style.baselineShift?._value || 0) > 0;
  });
}

function makeFinding(partial: Omit<Finding, "id">): Finding {
  const key = [partial.ruleId, partial.artboard, partial.tab, partial.slide, partial.layerId, partial.title]
    .filter(Boolean)
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return { ...partial, id: `f-${(hash >>> 0).toString(36)}` };
}

export function analyzePackage(data: Record<string, any>, zipAssets: ZipAsset[], sourceFile: string): PackageSummary {
  const layers: Layer[] = Array.isArray(data.rawLayers) ? data.rawLayers : [];
  const byId = new Map<number, Layer>();
  layers.forEach(layer => {
    if (Number.isFinite(layer.layerID)) byId.set(layer.layerID as number, layer);
  });

  const artboardLayers = layers.filter(layer => layer.artboard && ARTBOARD_NAME.test(normalized(layer.name)));
  const master = layers.find(layer => normalized(layer.name).toLowerCase() === "master" && layer.artboard);

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

  const contexts = layers.map(layer => {
    const path = pathFor(layer);
    const artboard = path.find(item => item.artboard && ARTBOARD_NAME.test(normalized(item.name)));
    const tab = path.find(item => TAB_NAME.test(normalized(item.name)));
    const slide = path.find(item => SLIDE_NAME.test(normalized(item.name)));
    return {
      layer,
      artboard: normalized(artboard?.name),
      tab: normalized(tab?.name).toLowerCase(),
      slide: normalized(slide?.name).toLowerCase(),
      path: path.map(item => normalized(item.name)).filter(Boolean),
    };
  });

  const findings: Finding[] = [];
  if (!master) {
    findings.push(makeFinding({
      ruleId: "turbo.master-required",
      severity: "error",
      confidence: "high",
      title: "Master artboard is missing",
      message: "Turbo packages require a master artboard for shared navigation and component definitions.",
    }));
  }
  if (!artboardLayers.length) {
    findings.push(makeFinding({
      ruleId: "turbo.artboards-required",
      severity: "error",
      confidence: "high",
      title: "No supported artboards found",
      message: "No size artboards matching WIDTHxHEIGHT or mobile-instream were found.",
    }));
  }

  const textContexts = contexts.filter(context => getText(context.layer));
  for (const context of textContexts) {
    const text = getText(context.layer);
    const location = {
      artboard: context.artboard || undefined,
      tab: context.tab || undefined,
      slide: context.slide || undefined,
      layerName: normalized(context.layer.name) || "Untitled text layer",
      layerId: context.layer.layerID,
    };
    if (/ {2,}|\t|\u00a0\u00a0/.test(String(context.layer.textKey?.textKey || ""))) {
      findings.push(makeFinding({
        ruleId: "copy.spacing",
        severity: "warning",
        confidence: "high",
        title: "Suspicious spacing",
        message: "Copy contains repeated spaces, a tab, or repeated non-breaking spaces.",
        ...location,
      }));
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
      findings.push(makeFinding({
        ruleId: "copy.unsupported-control-character",
        severity: "error",
        confidence: "high",
        title: "Unsupported control character",
        message: "Copy contains a non-printing control character that may render unpredictably.",
        ...location,
      }));
    }
    if (DEFAULT_COPY.test(text)) {
      findings.push(makeFinding({
        ruleId: "copy.default-placeholder",
        severity: "warning",
        confidence: "high",
        title: "Possible default copy",
        message: `“${text}” matches a known placeholder or default button label.`,
        ...location,
      }));
    }
    if (!hasRaisedTrademark(context.layer, text)) {
      findings.push(makeFinding({
        ruleId: "typography.trademark-superscript",
        severity: "warning",
        confidence: "medium",
        title: "Trademark may not be superscript",
        message: "The trademark character appears in a normal-baseline style run.",
        ...location,
      }));
    }
    if (isOptical(context.layer)) {
      findings.push(makeFinding({
        ruleId: "typography.optical-kerning",
        severity: "info",
        confidence: "high",
        title: "Optical kerning",
        message: "Photoshop Optical kerning cannot be reproduced exactly by a browser. Review this text in metric mode.",
        ...location,
      }));
    }
  }

  const tabNames = new Set(contexts.map(context => context.tab).filter(Boolean));
  const slideNames = new Set(contexts.map(context => context.slide).filter(Boolean));

  // Tab-wide presence: a component may move between slides, so slide is deliberately ignored.
  const inventories = new Map<string, Map<string, number>>();
  for (const context of contexts) {
    if (!context.artboard || !context.tab) continue;
    const layerName = normalized(context.layer.name);
    const text = getText(context.layer);
    let role = "";
    if (CTA_NAME.test(layerName)) role = "cta";
    else if (/^(?:background|bg)(?:[-_\s]|$)/i.test(layerName)) role = "background";
    else if (text && /(?:head|title)/i.test(layerName)) role = "heading";
    else if (text && /(?:subcopy|body|copy|description)/i.test(layerName)) role = "subcopy";
    if (!role) continue;
    const key = `${context.tab}|${role}`;
    if (!inventories.has(key)) inventories.set(key, new Map());
    const perArtboard = inventories.get(key)!;
    perArtboard.set(context.artboard, (perArtboard.get(context.artboard) || 0) + 1);
  }
  for (const [key, counts] of inventories) {
    const [tab, role] = key.split("|");
    const values = Array.from(counts.values()).sort((a, b) => b - a);
    const expected = values[Math.floor((values.length - 1) / 2)] || 0;
    if (!expected || counts.size < Math.max(2, Math.ceil(artboardLayers.length / 2))) continue;
    for (const artboard of artboardLayers.map(layer => normalized(layer.name))) {
      const actual = counts.get(artboard) || 0;
      if (actual < expected) {
        findings.push(makeFinding({
          ruleId: "consistency.element-presence",
          severity: role === "cta" ? "warning" : "info",
          confidence: "medium",
          title: `Possible missing ${role}`,
          message: `${tab} contains ${expected} ${role} element${expected === 1 ? "" : "s"} in the reference pattern, but ${artboard} contains ${actual}.`,
          artboard,
          tab,
          evidence: "Compared across the complete tab; slide placement is intentionally ignored.",
        }));
      }
    }
  }

  // Compare normalized text presence by tab, ignoring slide placement.
  const copyPresence = new Map<string, Set<string>>();
  for (const context of textContexts) {
    if (!context.artboard || !context.tab) continue;
    const text = getText(context.layer);
    if (text.length < 4) continue;
    const key = `${context.tab}|${text.toLocaleLowerCase()}`;
    if (!copyPresence.has(key)) copyPresence.set(key, new Set());
    copyPresence.get(key)!.add(context.artboard);
  }
  for (const [key, present] of copyPresence) {
    if (present.size < Math.max(2, Math.ceil(artboardLayers.length / 2))) continue;
    const separator = key.indexOf("|");
    const tab = key.slice(0, separator);
    const text = key.slice(separator + 1);
    for (const artboard of artboardLayers.map(layer => normalized(layer.name))) {
      if (!present.has(artboard)) {
        findings.push(makeFinding({
          ruleId: "consistency.copy-presence",
          severity: "warning",
          confidence: "medium",
          title: "Copy differs across artboards",
          message: `Copy used by most ${tab} artboards is absent from ${artboard}.`,
          artboard,
          tab,
          evidence: text.length > 90 ? `${text.slice(0, 87)}…` : text,
        }));
      }
    }
  }

  const declaredReferences = new Map<string, number>();
  const addReference = (name: unknown) => {
    const value = normalized(name);
    if (value) declaredReferences.set(value.toLowerCase(), (declaredReferences.get(value.toLowerCase()) || 0) + 1);
  };
  (data.customAssets || []).forEach((asset: any) => addReference(asset.fileName));
  (data.fonts || []).forEach((font: any) => addReference(font.fileName));
  layers.forEach(layer => {
    const match = /^v\d+\s*:\s*([^\[]+)/i.exec(normalized(layer.name));
    if (match) addReference(match[1]);
    const linked = layer.smartObject?.linked === true
      ? layer.smartObject.fileReference || layer.smartObject.link?._path
      : null;
    if (linked) addReference(String(linked).split(/[\\/]/).pop());
  });
  addReference("disclaimer.html");

  const available = new Set(zipAssets.map(asset => asset.name.split("/").pop()!.toLowerCase()));
  // Ordinary raster layers are referenced by the renderer's name-layerID convention.
  layers.forEach(layer => {
    if (!layer.name || !Number.isFinite(layer.layerID) || layer.textKey) return;
    const oneX = `${layer.name}-${layer.layerID}.png`.toLowerCase();
    const twoX = `${layer.name}-${layer.layerID}-2x.png`.toLowerCase();
    if (available.has(oneX)) addReference(oneX);
    if (available.has(twoX)) addReference(twoX);
  });
  for (const [name] of declaredReferences) {
    if (!available.has(name)) {
      findings.push(makeFinding({
        ruleId: "assets.declared-missing",
        severity: "error",
        confidence: "high",
        title: "Declared asset is missing",
        message: `${name} is referenced by export.json but is not present in the package.`,
      }));
    }
  }

  const assets = zipAssets
    .filter(asset => !/(^|\/)export\.json$/i.test(asset.name))
    .map(asset => {
      const baseName = asset.name.split("/").pop() || asset.name;
      const key = baseName.toLowerCase();
      const referenceCount = declaredReferences.get(key) || 0;
      const isSystem = /^(?:export\.log|errors\.txt|\.ds_store)$/i.test(baseName);
      return {
        name: baseName,
        compressedSize: bytes(asset.compressedSize),
        uncompressedSize: bytes(asset.uncompressedSize),
        extension: extension(baseName),
        status: isSystem ? "system" : referenceCount ? "referenced" : "unreferenced",
        referenceCount,
      } as AssetRecord;
    })
    .sort((a, b) => b.uncompressedSize - a.uncompressedSize);

  const documentName = normalized(data.document?.title || data.document?.name).replace(/\.psd$/i, "");
  const packageName = sourceFile.replace(/\.zip$/i, "");
  const creativeName = documentName && !/^(?:turbo|template|untitled)$/i.test(documentName)
    ? documentName
    : packageName;

  const severityOrder = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.title.localeCompare(b.title));

  return {
    creativeName,
    sourceFile,
    templateVersion: normalized(data.templateVersion) || "Unknown",
    pluginVersion: normalized(data.pluginVersion) || "Unknown",
    artboards: artboardLayers.map(layer => normalized(layer.name)),
    tabCount: tabNames.size,
    slideCount: slideNames.size,
    textLayerCount: textContexts.length,
    findings,
    assets,
  };
}
