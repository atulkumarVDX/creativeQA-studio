/* Raw export.json descriptors are intentionally heterogeneous and versioned externally. */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
  findings: Finding[];
  assets: AssetRecord[];
  firstViews: { artboard: string; totalBytes: number; status: "over-limit" | "review" }[];
};

type Layer = Record<string, any> & {
  layerID?: number;
  parentLayerID?: number;
  name?: string;
  visible?: boolean;
};

type ZipAsset = {
  name: string;
  durationSeconds?: number;
  compressedSize?: number;
  uncompressedSize?: number;
};

const ARTBOARD_NAME = /^(?:\d+x\d+|mobile-instream)$/i;
const TAB_NAME = /^tab(?:Component[-_ ]?)?(\d+)$/i;
const SLIDE_NAME = /^slide(?:[-_ ]?)(\d+)$/i;
const DEFAULT_COPY = /^(?:lorem ipsum|headline goes here|subcopy goes here|button text|sample text|your text here)$/i;
const CTA_NAME = /(?:^|[-_\s])(cta|button|btn)(?:\d+|[-_\s]|$)/i;
// CTA folders have a different export contract from map image buttons,
// JumpTo buttons and logo actions. Retain the evidenced legacy "button" name.
const CTA_GROUP_NAME = /^button(?:[1-9]\d*)?$/i;

function ctaImageRole(name: unknown) {
  // Preserve the role before a documented Assets Generator expression and
  // retina suffix. Arbitrary display names must not become background roles.
  return String(name ?? "").split(/\s+\+\s+/, 1)[0].trim().replace(/ 2x(?:l)?$/i, "");
}

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function packagePath(value: unknown) {
  // The preview's asset map uses archive-relative strings exactly. Do not
  // collapse whitespace, case-fold, or otherwise make a broken reference
  // appear resolvable during QA.
  return String(value ?? "");
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
  const markIndices = Array.from(text.matchAll(/[®™]/g), match => match.index);
  if (!markIndices.length) return true;
  const ranges = layer.textKey?.textStyleRange || [];
  return markIndices.every(markIndex => ranges.some((range: any) => {
    if (!(range.from <= markIndex && range.to > markIndex)) return false;
    const style = range.textStyle || {};
    return style.baseline?._value === "superScript" || Number(style.baselineShift?._value || 0) > 0;
  }));
}

function paragraphSpaceAfter(style: Record<string, any>) {
  let current: any = style;
  while (current && typeof current === "object") {
    for (const key of ["impliedSpaceAfter", "spaceAfter"]) {
      if (!Object.prototype.hasOwnProperty.call(current, key) || current[key] == null) continue;
      const descriptor = current[key];
      const value = descriptor && typeof descriptor === "object" && "_value" in descriptor
        ? Number(descriptor._value)
        : Number(descriptor);
      return Number.isFinite(value) ? value : 0;
    }
    current = current.baseParentStyle;
  }
  return 0;
}

function softReturnParagraphSpacing(layer: Layer) {
  const rawText = String(layer.textKey?.textKey ?? "");
  const ranges = layer.textKey?.paragraphStyleRange || [];
  let count = 0;
  let maxSpacing = 0;
  for (const match of rawText.matchAll(/\u0003/g)) {
    const paragraphStart = (match.index ?? 0) + match[0].length;
    const range = ranges.find((candidate: any) => {
      const from = typeof candidate?.from === "number" ? candidate.from : 0;
      const to = typeof candidate?.to === "number" ? candidate.to : rawText.length;
      return paragraphStart >= from && paragraphStart < to;
    });
    const style = range?.paragraphStyle || ranges[0]?.paragraphStyle || {};
    const value = paragraphSpaceAfter(style);
    if (Number.isFinite(value) && Math.abs(value) > 0.01) {
      count += 1;
      maxSpacing = Math.max(maxSpacing, Math.abs(value));
    }
  }
  return { count, maxSpacing };
}

function describeControlCharacter(text: string) {
  const character = text.match(/[\u0000-\u0002\u0004-\u0008\u000B\u000C\u000E-\u001F\u007F]/)?.[0];
  if (character === "\u0000") return "null character";
  if (character === "\u0008") return "backspace character";
  if (character === "\u000B") return "vertical tab";
  if (character === "\u000C") return "page break character";
  if (character === "\u007F") return "delete character";
  return "hidden control character";
}

function hasInternalSpacing(text: string) {
  // Only flag a spacing run between visible characters. Whitespace at the
  // beginning or end of a line can be intentional Photoshop layout padding.
  return /\S[ \t\u00a0]{2,}(?=\S)|\S\t(?=\S)/.test(text);
}

function hasLineEndSpacing(text: string) {
  // Keep a low-priority note for trailing padding, but do not treat it like a
  // broken word gap. A line ending may be CR, LF, Shift+Enter, or the end of
  // the exported text value.
  return /[ \t\u00a0]+(?:\r|\n|\u0003|$)/.test(text);
}

function visibleWhitespace(value: string) {
  return value.replace(/ /g, "·").replace(/\t/g, "⇥").replace(/\u00a0/g, "·").replace(/\r\n|\r|\n|\u0003/g, "↵");
}

function spacingHighlight(rawText: string, start: number, length: number): FindingHighlight {
  const contextStart = Math.max(0, start - 42);
  const contextEnd = Math.min(rawText.length, start + length + 42);
  return {
    prefix: visibleWhitespace(rawText.slice(contextStart, start)),
    value: visibleWhitespace(rawText.slice(start, start + length)),
    suffix: visibleWhitespace(rawText.slice(start + length, contextEnd)),
  };
}

function findingGuidance(ruleId: string, title: string, message: string) {
  if (ruleId.startsWith("assets.")) return { category: "Assets", suggestedFix: "Add the missing file to the package, then reopen the ZIP and check the preview." };
  if (ruleId.startsWith("consistency.")) return { category: "Consistency", suggestedFix: "Compare this size with the others in the same tab. Add or update the element if the difference is not intentional." };
  if (ruleId.includes("optical-kerning")) return { category: "Typography", suggestedFix: "In Photoshop, change the text to Metrics kerning. Check the preview and adjust the spacing if needed." };
  if (ruleId.includes("trademark")) return { category: "Typography", suggestedFix: "In Photoshop, use Superscript or adjust the mark to match the approved design, then check it at the final display size." };
  if (ruleId === "structure.cta-ignored-image") return { category: "Assets", suggestedFix: "In Photoshop, name button artwork background. If this is the label, restore the lettering as a text layer inside the button group. Re-export and check the published button." };
  if (ruleId === "rendering.cta-mobile-label-review") return { category: "Browser compatibility", suggestedFix: "If the label is missing in production, convert it to point text in Photoshop. Keep the approved copy and styling, then re-export and check the published Mobile Instream unit." };
  if (ruleId.includes("soft-return")) return { category: "Typography", suggestedFix: "Check Space After in Photoshop. If the gap is unintended, adjust it, re-export, and compare with production." };
  if (ruleId.includes("control-character")) return { category: "Hidden characters", suggestedFix: "Replace the hidden character with the intended character in Photoshop, then check the copy in Preview." };
  if (ruleId === "copy.spacing") return { category: "Copy", suggestedFix: "Check the spacing in Photoshop and remove extra spaces or tabs if they are not intentional." };
  if (ruleId === "copy.line-end-spacing") return { category: "Copy", suggestedFix: "In Photoshop, keep the spaces if they help align the line. Otherwise remove the trailing spaces and re-export." };
  if (ruleId.includes("placeholder")) return { category: "Copy", suggestedFix: "Replace this with approved copy, or confirm that the placeholder is intentional." };
  if (ruleId === "turbo.master-required") return { category: "Package setup", suggestedFix: "Restore the Master artboard from the approved template, then re-export the package." };
  if (ruleId === "turbo.artboards-required") return { category: "Package setup", suggestedFix: "Add at least one supported ad size artboard, then re-export the package." };
  return { category: title.toLowerCase().includes("copy") ? "Copy" : "Package setup", suggestedFix: message };
}

function findingReason(ruleId: string, message: string) {
  if (ruleId === "turbo.master-required") return "No artboard named Master was found in the package.";
  if (ruleId === "turbo.artboards-required") return "No artboard name matched a supported creative size, such as 300x250, or mobile-instream.";
  if (ruleId.startsWith("assets.")) return "The creative refers to this file, but the file was not found in the package.";
  if (ruleId === "structure.cta-ignored-image") return "The PSD export guide (CTA Button, page 6) keeps text, frame, and background layers inside a button. This direct image or Smart Object has another role name and is ignored. Assets Generator and retina suffixes are accounted for.";
  if (ruleId === "rendering.cta-mobile-label-review") return "This is paragraph text directly inside a Mobile Instream button. That setup matched a published label omission with a reported point-text repair. It is a review signal, not proof of disappearance; paragraph-text buttons can work in production.";
  if (ruleId === "rendering.shift-enter-soft-return") return "A paragraph with Space After follows a Shift+Enter break, so production may add an unintended gap between these lines.";
  if (ruleId === "copy.unsupported-control-character") return "The copy contains a non-printing character that could affect how it appears.";
  if (ruleId === "copy.spacing") return "The text contains repeated spaces, a tab, or repeated non-breaking spaces.";
  if (ruleId === "copy.line-end-spacing") return "Photoshop exported whitespace before a line ending. This may be intentional layout padding, so it is a low-priority review note.";
  if (ruleId === "copy.default-placeholder") return "The text matches a common placeholder phrase, such as “Headline goes here” or “Button text.”";
  if (ruleId === "typography.trademark-superscript") return "The ® or ™ mark is not set to Superscript or raised in its Photoshop text style.";
  if (ruleId === "typography.optical-kerning") return "Photoshop Optical kerning is applied here; browsers may space these letters differently.";
  if (ruleId === "consistency.element-presence") return "This size has fewer matching elements than the most common pattern across sizes in this tab.";
  if (ruleId === "consistency.copy-presence") return "This copy appears on most sizes in this tab, but was not found on this one.";
  return message;
}

function makeFinding(partial: Omit<Finding, "id" | "category" | "suggestedFix" | "reason">): Finding {
  const key = [partial.ruleId, partial.artboard, partial.tab, partial.slide, partial.layerId, partial.title, partial.message]
    .filter(Boolean)
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
  return { ...partial, ...findingGuidance(partial.ruleId, partial.title, partial.message), reason: findingReason(partial.ruleId, partial.message), id: `f-${(hash >>> 0).toString(36)}` };
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
      || ![1, 5].includes(context.layer.layerKind)) continue;
    const role = ctaImageRole(context.layer.name);
    if (role === "frame" || role === "background") continue;
    findings.push(makeFinding({
      ruleId: "structure.cta-ignored-image",
      severity: "warning",
      confidence: "high",
      title: `“${normalized(context.layer.name)}” will not be included in this button.`,
      message: "The button export keeps text, frame, and background layers. This image is ignored.",
      evidence: `CTA owner: ${normalized(parent?.name)} [${parent?.layerID}] · Image layer: ${context.layer.layerID} · PSD export guide: CTA Button, page 6`,
      artboard: context.artboard,
      tab: context.tab || undefined,
      slide: context.slide || undefined,
      layerName: normalized(context.layer.name),
      layerId: context.layer.layerID,
    }));
  }

  const textContexts = contexts.filter(context => getText(context.layer));
  for (const context of textContexts) {
    const text = getText(context.layer);
    const rawText = String(context.layer.textKey?.textKey ?? "");
    const parent = Number.isFinite(context.layer.parentLayerID)
      ? byId.get(context.layer.parentLayerID as number)
      : undefined;
    const location = {
      artboard: context.artboard || undefined,
      tab: context.tab || undefined,
      slide: context.slide || undefined,
      layerName: normalized(context.layer.name) || "Untitled text layer",
      layerId: context.layer.layerID,
    };
    const textShape = context.layer.textKey?.textShape?.[0]?.char?._value;
    if (textShape === "box" && context.artboard.toLowerCase() === "mobile-instream"
      && isCtaGroup(parent, context)) {
      findings.push(makeFinding({
        ruleId: "rendering.cta-mobile-label-review",
        severity: "info",
        confidence: "medium",
        title: "Verify this button label in Mobile Instream.",
        message: `Check that “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}” is visible in the published unit. This text setup matched a previous label omission; this check cannot confirm whether yours is affected.`,
        evidence: `CTA owner: ${normalized(parent?.name)} [${parent?.layerID}] · Photoshop text shape: box · Observed Mobile Instream case; omission cause unconfirmed`,
        ...location,
      }));
    }
    if (hasInternalSpacing(rawText)) {
      const spacingMatch = rawText.match(/\S([ \t\u00a0]{2,}|\t)(?=\S)/);
      findings.push(makeFinding({
        ruleId: "copy.spacing",
        severity: "info",
        confidence: "high",
        title: "Extra spacing was found in this copy.",
        message: `“${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”`,
        highlight: spacingMatch?.index == null ? undefined : spacingHighlight(rawText, spacingMatch.index + 1, spacingMatch[1].length),
        ...location,
      }));
    }
    if (hasLineEndSpacing(rawText)) {
      const lineEndMatch = rawText.match(/[ \t\u00a0]+(?=\r|\n|\u0003|$)/);
      const trailing = lineEndMatch?.[0] || "";
      findings.push(makeFinding({
        ruleId: "copy.line-end-spacing",
        severity: "info",
        confidence: "medium",
        title: "Spacing before a line break may be intentional.",
        message: `Photoshop exported ${trailing.length} trailing space${trailing.length === 1 ? "" : "s"} before a line ending in “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`,
        evidence: "The whitespace is at the end of the line, so it may be layout padding rather than a visible copy error.",
        highlight: lineEndMatch?.index == null ? undefined : spacingHighlight(rawText, lineEndMatch.index, trailing.length),
        ...location,
      }));
    }
    const softReturnSpacing = softReturnParagraphSpacing(context.layer);
    if (softReturnSpacing.count > 0) {
      findings.push(makeFinding({
        ruleId: "rendering.shift-enter-soft-return",
        severity: "warning",
        confidence: "medium",
        title: "Extra space may appear after this line.",
        message: `A Shift+Enter break is followed by paragraph spacing in this copy: “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`,
        evidence: `${softReturnSpacing.count} Shift+Enter break${softReturnSpacing.count === 1 ? "" : "s"} followed by nonzero paragraph spacing (maximum ${softReturnSpacing.maxSpacing} exported units)`,
        ...location,
      }));
    }
    if (/[\u0000-\u0002\u0004-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(rawText)) {
      findings.push(makeFinding({
        ruleId: "copy.unsupported-control-character",
        severity: "error",
        confidence: "high",
        title: "This copy contains a hidden character that may display incorrectly.",
        message: `Affected copy: “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”. It contains a ${describeControlCharacter(rawText)}.`,
        ...location,
      }));
    }
    if (DEFAULT_COPY.test(text)) {
      findings.push(makeFinding({
        ruleId: "copy.default-placeholder",
        severity: "warning",
        confidence: "high",
        title: "This text may still be placeholder copy.",
        message: `Found “${text}”. Confirm it or replace it with approved copy.`,
        ...location,
      }));
    }
    // Photoshop style ranges index the unmodified source string. Using normalized
    // text here shifts indices whenever spaces surround a line break.
    if (!hasRaisedTrademark(context.layer, rawText)) {
      findings.push(makeFinding({
        ruleId: "typography.trademark-superscript",
        severity: "warning",
        confidence: "medium",
        title: "The trademark mark may appear too low.",
        message: `Check the mark in “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`,
        ...location,
      }));
    }
    if (isOptical(context.layer)) {
      findings.push(makeFinding({
        ruleId: "typography.optical-kerning",
        severity: "info",
        confidence: "high",
        title: "Letter spacing may look different in the published showcase.",
        message: `This copy uses Optical kerning: “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`,
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
          severity: "info",
          confidence: "medium",
          title: `This ${role} may be missing at this size.`,
          message: `It appears on most sizes in ${tab}, but not ${artboard}. This difference may be intentional.`,
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
          severity: "info",
          confidence: "medium",
          title: "This copy may be missing at this size.",
          message: `It appears on most sizes in ${tab}, but not ${artboard}. This difference may be intentional.`,
          artboard,
          tab,
          evidence: text.length > 90 ? `${text.slice(0, 87)}…` : text,
        }));
      }
    }
  }

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
  (data.customAssets || []).forEach((asset: any) => addReference(asset.fileName, true));
  (data.fonts || []).forEach((font: any) => addReference(font.fileName));
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
  const hasIsi = contexts.some(context => Boolean(context.artboard) && normalized(context.layer.name).toLowerCase() === "isi")
    || layers.some(layer => /^ISI_preQual_\d+x\d+\.png$/i.test(packagePath(layer.name)));

  const exportEntry = zipAssets.find(asset => /(^|\/)export\.json$/i.test(packagePath(asset.name)));
  const exportPath = packagePath(exportEntry?.name);
  const basePrefix = exportPath ? exportPath.slice(0, exportPath.length - "export.json".length) : "";
  const relativeAssets = zipAssets
    .map(asset => ({ asset, path: packagePath(asset.name) }))
    .filter(item => !basePrefix || item.path.startsWith(basePrefix))
    .map(item => ({ asset: item.asset, path: item.path.slice(basePrefix.length) }))
    .filter(item => item.path && !/(^|\/)export\.json$/i.test(item.path));
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
  const custom = new Map((data.customAssets || []).map((item: any) => [String(item.layerID), item.fileName]));
  const resolve = (name: string) => available.has(name) ? name
    : /\.png$/i.test(name) && available.has(name.replace(/\.png$/i, "-2x.png"))
      ? name.replace(/\.png$/i, "-2x.png") : "";
  for (const artboard of artboardLayers) {
    const scope = normalized(artboard.name);
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
  for (const asset of assets) {
    const base = asset.name.split("/").pop() || asset.name;
    if (/^(?:teaserLogo|peelLogo)(?:-\d+)?\.[a-z0-9]+$/i.test(base) && asset.uncompressedSize > 10 * 1024) {
      asset.validationErrors.push("Teaser logo exceeds 10 KB.");
      budgetFinding("assets.teaser-logo-size", "Teaser logo exceeds 10 KB.", `${asset.name}: ${asset.uncompressedSize} bytes; maximum 10240 bytes.`);
    }
    if (primaryVideoNames.has(asset.name)) {
      const duration = asset.durationSeconds;
      const addVideoFinding = (ruleId: string, message: string, severity: Severity) => {
        (severity === "error" ? asset.validationErrors : asset.validationWarnings).push(message);
        findings.push({ ...makeFinding({ ruleId, title: message, message: `${asset.name}: ${message}`, severity, confidence: "high" }),
          category: "Assets", reason: message, suggestedFix: severity === "error" ? "Shorten the primary video to at most 4 minutes 30 seconds." : "Optimize the video or confirm long-form handling." });
      };
      if (asset.uncompressedSize > 2.5 * 1024 * 1024)
        addVideoFinding("assets.primary-video-size", "Primary video exceeds 2.5 MB.", "warning");
      if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) {
        if (duration > 270) addVideoFinding("assets.primary-video-duration", "Primary video exceeds 4 minutes 30 seconds.", "error");
        else if (duration > 30) addVideoFinding("assets.primary-video-duration", "Primary video exceeds 30 seconds; confirm long-form handling.", "warning");
      } else {
        addVideoFinding("assets.primary-video-duration-unavailable", "Video duration could not be verified.", "warning");
      }
    }
  }
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
    firstViews,
  };
}
