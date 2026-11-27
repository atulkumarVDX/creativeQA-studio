import type { Finding } from "@/lib/qa-engine";
import { makeFinding } from "@/lib/qa-engine/findings";
import { getText, normalizeLayerText } from "@/lib/qa-engine/text-analysis";
import type { LayerContext } from "@/lib/qa-engine/types";

const CTA_NAME = /(?:^|[-_\s])(cta|button|btn)(?:\d+|[-_\s]|$)/i;

export function analyzeConsistencyFindings(contexts: LayerContext[], textContexts: LayerContext[], artboards: string[]): Finding[] {
  const findings: Finding[] = [];
  const inventories = new Map<string, Map<string, number>>();
  for (const context of contexts) {
    if (!context.artboard || !context.tab) continue;
    const layerName = normalizeLayerText(context.layer.name);
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
    if (!expected || counts.size < Math.max(2, Math.ceil(artboards.length / 2))) continue;
    for (const artboard of artboards) {
      const actual = counts.get(artboard) || 0;
      if (actual < expected) findings.push(makeFinding({
        ruleId: "consistency.element-presence", severity: "info", confidence: "medium",
        title: `This ${role} may be missing at this size.`,
        message: `It appears on most sizes in ${tab}, but not ${artboard}. This difference may be intentional.`,
        artboard, tab, evidence: "Compared across the complete tab; slide placement is intentionally ignored.",
      }));
    }
  }

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
    if (present.size < Math.max(2, Math.ceil(artboards.length / 2))) continue;
    const separator = key.indexOf("|");
    const tab = key.slice(0, separator);
    const text = key.slice(separator + 1);
    for (const artboard of artboards) if (!present.has(artboard)) findings.push(makeFinding({
      ruleId: "consistency.copy-presence", severity: "info", confidence: "medium",
      title: "This copy may be missing at this size.",
      message: `It appears on most sizes in ${tab}, but not ${artboard}. This difference may be intentional.`,
      artboard, tab, evidence: text.length > 90 ? `${text.slice(0, 87)}…` : text,
    }));
  }
  return findings;
}
