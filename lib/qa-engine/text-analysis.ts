import type { Finding } from "@/lib/qa-engine";
import type { Layer, LayerContext } from "@/lib/qa-engine/types";
import { makeFinding } from "@/lib/qa-engine/findings";

const DEFAULT_COPY = /^(?:lorem ipsum|headline goes here|subcopy goes here|button text|sample text|your text here)$/i;

export function normalizeLayerText(value: unknown) {
  return String(value ?? "").normalize("NFKC").replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/ *\n */g, "\n").trim();
}

export function getText(layer: Layer) {
  return normalizeLayerText(layer.textKey?.textKey);
}

function isOptical(layer: Layer) {
  const ranges = layer.textKey?.textStyleRange || [];
  return ranges.some(range => range?.textStyle?.autoKern?._value === "opticalKern");
}

function hasRaisedTrademark(layer: Layer, text: string) {
  const markIndices = Array.from(text.matchAll(/[®™]/g), match => match.index);
  if (!markIndices.length) return true;
  const ranges = layer.textKey?.textStyleRange || [];
  return markIndices.every(markIndex => ranges.some(range => {
    const from = range.from ?? Number.NaN;
    const to = range.to ?? Number.NaN;
    if (!(from <= markIndex && to > markIndex)) return false;
    const style = range.textStyle || {};
    return style.baseline?._value === "superScript" || Number(style.baselineShift?._value || 0) > 0;
  }));
}

function paragraphSpaceAfter(style: Record<string, unknown>) {
  let current: Record<string, unknown> | undefined = style;
  while (current && typeof current === "object") {
    for (const key of ["impliedSpaceAfter", "spaceAfter"]) {
      if (!Object.prototype.hasOwnProperty.call(current, key) || current[key] == null) continue;
      const descriptor = current[key];
      const value = descriptor && typeof descriptor === "object" && "_value" in descriptor ? Number(descriptor._value) : Number(descriptor);
      return Number.isFinite(value) ? value : 0;
    }
    current = current.baseParentStyle as Record<string, unknown> | undefined;
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
    const range = ranges.find(candidate => {
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

function replacementCharacterMatch(text: string) {
  const index = text.indexOf("\uFFFD");
  return index >= 0 ? { index, count: Array.from(text).filter(character => character === "\uFFFD").length } : null;
}

function hasInternalSpacing(text: string) { return /\S[ \t\u00a0]{2,}(?=\S)|\S\t(?=\S)/.test(text); }
function hasLineEndSpacing(text: string) { return /[ \t\u00a0]+(?:\r|\n|\u0003|$)/.test(text); }
function visibleWhitespace(value: string) { return value.replace(/ /g, "·").replace(/\t/g, "⇥").replace(/\u00a0/g, "·").replace(/\r\n|\r|\n|\u0003/g, "↵"); }

function spacingHighlight(rawText: string, start: number, length: number) {
  const contextStart = Math.max(0, start - 42);
  const contextEnd = Math.min(rawText.length, start + length + 42);
  return {
    prefix: visibleWhitespace(rawText.slice(contextStart, start)),
    value: visibleWhitespace(rawText.slice(start, start + length)),
    suffix: visibleWhitespace(rawText.slice(start + length, contextEnd)),
  };
}

export function analyzeTextFindings(
  textContexts: LayerContext[],
  byId: Map<number, Layer>,
  isCtaGroup: (layer: Layer | undefined, context: LayerContext) => boolean,
): Finding[] {
  const findings: Finding[] = [];
  for (const context of textContexts) {
    const layer = context.layer;
    const text = getText(layer);
    const rawText = String(layer.textKey?.textKey ?? "");
    const parent = Number.isFinite(layer.parentLayerID) ? byId.get(layer.parentLayerID as number) : undefined;
    const location = {
      artboard: context.artboard || undefined,
      tab: context.tab || undefined,
      slide: context.slide || undefined,
      layerName: normalizeLayerText(layer.name) || "Untitled text layer",
      layerId: layer.layerID,
    };
    const textShape = layer.textKey?.textShape?.[0]?.char?._value;
    if (textShape === "box" && context.artboard.toLowerCase() === "mobile-instream" && isCtaGroup(parent, context)) {
      findings.push(makeFinding({ ruleId: "rendering.cta-mobile-label-review", severity: "info", confidence: "medium", title: "Verify this button label in Mobile Instream.", message: `Check that “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}” is visible in the published unit. This text setup matched a previous label omission; this check cannot confirm whether yours is affected.`, evidence: `CTA owner: ${normalizeLayerText(parent?.name)} [${parent?.layerID}] · Photoshop text shape: box · Observed Mobile Instream case; omission cause unconfirmed`, ...location }));
    }
    if (hasInternalSpacing(rawText)) {
      const spacingMatch = rawText.match(/\S([ \t\u00a0]{2,}|\t)(?=\S)/);
      findings.push(makeFinding({ ruleId: "copy.spacing", severity: "info", confidence: "high", title: "Extra spacing was found in this copy.", message: `“${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”`, highlight: spacingMatch?.index == null ? undefined : spacingHighlight(rawText, spacingMatch.index + 1, spacingMatch[1].length), ...location }));
    }
    if (hasLineEndSpacing(rawText)) {
      const lineEndMatch = rawText.match(/[ \t\u00a0]+(?=\r|\n|\u0003|$)/);
      const trailing = lineEndMatch?.[0] || "";
      findings.push(makeFinding({ ruleId: "copy.line-end-spacing", severity: "info", confidence: "medium", title: "Spacing before a line break may be intentional.", message: `Photoshop exported ${trailing.length} trailing space${trailing.length === 1 ? "" : "s"} before a line ending in “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`, evidence: "The whitespace is at the end of the line, so it may be layout padding rather than a visible copy error.", highlight: lineEndMatch?.index == null ? undefined : spacingHighlight(rawText, lineEndMatch.index, trailing.length), ...location }));
    }
    const softReturnSpacing = softReturnParagraphSpacing(layer);
    if (softReturnSpacing.count > 0) findings.push(makeFinding({ ruleId: "rendering.shift-enter-soft-return", severity: "warning", confidence: "medium", title: "Extra space may appear after this line.", message: `A Shift+Enter break is followed by paragraph spacing in this copy: “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`, evidence: `${softReturnSpacing.count} Shift+Enter break${softReturnSpacing.count === 1 ? "" : "s"} followed by nonzero paragraph spacing (maximum ${softReturnSpacing.maxSpacing} exported units)`, ...location }));
    const replacement = replacementCharacterMatch(rawText);
    if (replacement) findings.push(makeFinding({ ruleId: "copy.replacement-character", severity: "error", confidence: "high", title: "This copy contains a replacement character.", message: `The text contains ${replacement.count === 1 ? "a replacement" : `${replacement.count} replacement`} character${replacement.count === 1 ? "" : "s"} (�). It may appear as a black diamond with a question mark in the preview or published creative.`, evidence: `Unicode code point U+FFFD at exported text position ${replacement.index}. The original character is not recoverable from this text layer.`, highlight: spacingHighlight(rawText, replacement.index, 1), ...location }));
    if (/[\u0000-\u0002\u0004-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(rawText)) findings.push(makeFinding({ ruleId: "copy.unsupported-control-character", severity: "error", confidence: "high", title: "This copy contains a hidden character that may display incorrectly.", message: `Affected copy: “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”. It contains a ${describeControlCharacter(rawText)}.`, ...location }));
    if (DEFAULT_COPY.test(text)) findings.push(makeFinding({ ruleId: "copy.default-placeholder", severity: "warning", confidence: "high", title: "This text may still be placeholder copy.", message: `Found “${text}”. Confirm it or replace it with approved copy.`, ...location }));
    if (!hasRaisedTrademark(layer, rawText)) findings.push(makeFinding({ ruleId: "typography.trademark-superscript", severity: "warning", confidence: "medium", title: "The trademark mark may appear too low.", message: `Check the mark in “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`, ...location }));
    if (isOptical(layer)) findings.push(makeFinding({ ruleId: "typography.optical-kerning", severity: "info", confidence: "high", title: "Letter spacing may look different in the published showcase.", message: `This copy uses Optical kerning: “${text.slice(0, 100)}${text.length > 100 ? "…" : ""}”.`, ...location }));
  }
  return findings;
}
