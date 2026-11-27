import { AlertTriangle, CheckCircle2, CircleAlert, Info, Play, Search } from "lucide-react";
import type { Finding, Severity } from "@/lib/qa-engine";
import { formatFindingContextLabel, type FindingGroup } from "@/features/findings/finding-view-model";

type SeverityFilter = Severity | "all";

export type FindingsSectionProps = {
  findingCount: number;
  sizeCount: number;
  tabCount: number;
  errorCount: number;
  warningCount: number;
  severity: SeverityFilter;
  query: string;
  category: string;
  tab: string;
  size: string;
  categories: string[];
  tabs: string[];
  sizes: string[];
  groups: FindingGroup[];
  onSeverityToggle: (severity: Severity) => void;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: string) => void;
  onTabChange: (tab: string) => void;
  onSizeChange: (size: string) => void;
  onFocusFinding: (finding: Finding) => void;
};

function SeverityIcon({ level }: { level: Severity }) {
  if (level === "error") return <CircleAlert aria-hidden="true" />;
  if (level === "warning") return <AlertTriangle aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

function SpacingHighlight({ finding }: { finding: Finding }) {
  if (!finding.highlight) return <p>{finding.message}</p>;
  return <p className="finding-highlight-copy"><span className="finding-highlight-label">Affected copy</span><span>{finding.highlight.prefix}</span><mark>{finding.highlight.value}</mark><span>{finding.highlight.suffix}</span></p>;
}

export function FindingsSection({
  findingCount,
  sizeCount,
  tabCount,
  errorCount,
  warningCount,
  severity,
  query,
  category,
  tab,
  size,
  categories,
  tabs,
  sizes,
  groups,
  onSeverityToggle,
  onQueryChange,
  onCategoryChange,
  onTabChange,
  onSizeChange,
  onFocusFinding,
}: FindingsSectionProps) {
  return (
    <div role="tabpanel" className="workspace-content">
      <section className="page-title"><span className="eyebrow">CREATIVE ANALYSIS</span><h1>Findings</h1><p>Deterministic defects and review signals from the complete package structure.</p></section>
      <div className="findings-summary-bar">
        <div className="findings-summary-count"><strong>{findingCount} {findingCount === 1 ? "finding" : "findings"}</strong><span>across {sizeCount} sizes and {tabCount} tabs</span></div>
        <div className="findings-summary-severity">
          {errorCount > 0 && <button type="button" className={`summary-severity critical ${severity === "error" ? "active" : ""}`} aria-pressed={severity === "error"} onClick={() => onSeverityToggle("error")}>{errorCount} critical</button>}
          {warningCount > 0 && <button type="button" className={`summary-severity review ${severity === "warning" ? "active" : ""}`} aria-pressed={severity === "warning"} onClick={() => onSeverityToggle("warning")}>{warningCount} need review</button>}
          <label className="summary-select"><span>Tab</span><select aria-label="Filter by tab" value={tab} onChange={event => onTabChange(event.target.value)}><option value="all">All tabs</option>{tabs.map(value => <option key={value} value={value}>{formatFindingContextLabel(value)}</option>)}</select></label>
          <label className="summary-select"><span>Size</span><select aria-label="Filter by size" value={size} onChange={event => onSizeChange(event.target.value)}><option value="all">All sizes</option>{sizes.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
      </div>
      <div className="toolbar findings-search"><label className="search-field"><Search /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search copy, element, or suggested fix…" /></label></div>
      <div className="finding-category-filters" aria-label="Filter findings by check">
        <button type="button" className={category === "all" ? "active" : ""} aria-pressed={category === "all"} onClick={() => onCategoryChange("all")}>All checks</button>
        {categories.map(value => <button type="button" key={value} className={category === value ? "active" : ""} aria-pressed={category === value} onClick={() => onCategoryChange(category === value ? "all" : value)}>{value}</button>)}
      </div>
      <div className="finding-list">
        {groups.length ? groups.map(group => <section key={group.id} className="finding-group">
          <header className="finding-group-heading"><strong>{group.label}</strong><span>{group.findings.length} {group.findings.length === 1 ? "finding" : "findings"}</span></header>
          {group.findings.map((finding, index) => <article key={`${finding.id}-${index}`} className={`finding-row ${finding.severity}`}>
            <div className="finding-icon"><SeverityIcon level={finding.severity} /></div>
            <div className="finding-copy">
              <div className="finding-title">
                <strong>{finding.title}</strong>
                <button type="button" className="finding-category-tag" aria-pressed={category === finding.category} onClick={() => onCategoryChange(category === finding.category ? "all" : finding.category)}>{finding.category}</button>
                <span className="finding-why"><button type="button" aria-label={`Why this was flagged: ${finding.reason}`} aria-describedby={`finding-why-${finding.id}`}><Info aria-hidden="true" /></button><span role="tooltip" id={`finding-why-${finding.id}`} className="finding-why-tip">{finding.reason}</span></span>
              </div>
              {finding.ruleId === "copy.spacing" ? <SpacingHighlight finding={finding} /> : <p>{finding.message}</p>}
              {finding.ruleId === "copy.line-end-spacing" && <SpacingHighlight finding={finding} />}
              <p className="finding-fix"><strong>Suggested fix</strong><span>{finding.suggestedFix}</span></p>
              {(finding.artboard || finding.tab || finding.slide) && <div className="finding-location">
                {[finding.artboard, finding.tab, finding.slide].filter((value): value is string => Boolean(value)).map((value, locationIndex) => <span key={`${value}-${locationIndex}`}>{formatFindingContextLabel(value)}</span>)}
                {finding.layerId != null && finding.artboard && <button type="button" className="finding-preview-button" aria-label="Show finding in preview" title="Show in preview" onClick={() => onFocusFinding(finding)}><Play aria-hidden="true" /></button>}
              </div>}
              {finding.evidence && (finding.ruleId.startsWith("assets.") || finding.ruleId === "copy.line-end-spacing") && <small>{finding.evidence}</small>}
            </div>
          </article>)}
        </section>) : <div className="empty-results"><CheckCircle2 /><strong>No matching findings</strong><span>Adjust the search or selected filters.</span></div>}
      </div>
    </div>
  );
}
