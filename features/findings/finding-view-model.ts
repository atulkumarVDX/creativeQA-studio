import type { AssetRecord, Finding, Severity } from "@/lib/qa-engine";

export type FindingFilters = {
  query: string;
  severity: Severity | "all";
  category: string;
  tab: string;
  size: string;
};

export type FindingGroup = {
  id: string;
  label: string;
  findings: Finding[];
};

export type FindingFacets = {
  categories: string[];
  tabs: string[];
  sizes: string[];
};

export function countFindings(findings: Finding[], severity: Severity) {
  return findings.filter(finding => finding.severity === severity).length;
}

export function formatFindingContextLabel(value: string) {
  return value
    .replace(/^tab(?:component)?[-_ ]?(\d+)$/i, "Tab $1")
    .replace(/^slide[-_ ]?(\d+)$/i, "Slide $1");
}

export function filterFindings(findings: Finding[], filters: FindingFilters) {
  const query = filters.query.trim().toLowerCase();
  return findings.filter(finding =>
    (filters.severity === "all" || finding.severity === filters.severity)
    && (filters.category === "all" || finding.category === filters.category)
    && (filters.tab === "all" || finding.tab === filters.tab)
    && (filters.size === "all" || finding.artboard === filters.size)
    && (!query || [finding.title, finding.message, finding.suggestedFix, finding.artboard, finding.tab, finding.slide, finding.layerName, finding.category]
      .some(value => String(value || "").toLowerCase().includes(query))),
  );
}

export function groupFindings(findings: Finding[]): FindingGroup[] {
  const groups = new Map<string, { label: string; findings: Finding[] }>();
  findings.forEach(finding => {
    const itemKey = finding.layerId != null
      ? `layer:${finding.tab || ""}:${finding.artboard || ""}:${finding.slide || ""}:${finding.layerId}`
      : finding.artboard || finding.tab || finding.slide
        ? `context:${finding.tab || ""}:${finding.artboard || ""}:${finding.slide || ""}:${finding.layerName || finding.title}`
        : `package:${finding.ruleId}:${finding.message}`;
    const label = finding.layerName || finding.artboard || finding.title;
    const current = groups.get(itemKey) || { label, findings: [] };
    current.findings.push(finding);
    groups.set(itemKey, current);
  });
  return Array.from(groups.entries()).map(([id, group]) => ({ id, ...group }));
}

export function getFindingFacets(findings: Finding[]): FindingFacets {
  return {
    categories: Array.from(new Set(findings.map(finding => finding.category))).sort(),
    tabs: Array.from(new Set(findings.map(finding => finding.tab).filter((value): value is string => Boolean(value)))).sort(),
    sizes: Array.from(new Set(findings.map(finding => finding.artboard).filter((value): value is string => Boolean(value)))).sort(),
  };
}

export function filterAssets(assets: AssetRecord[], queryValue: string, scope: string) {
  const query = queryValue.trim().toLowerCase();
  return assets.filter(asset =>
    (scope === "all" || (scope === "first-view" ? asset.firstViewScopes.length > 0 : asset.firstViewScopes.includes(scope)))
    && (!query || [asset.name, asset.extension, asset.status].some(value => value.toLowerCase().includes(query))),
  );
}
