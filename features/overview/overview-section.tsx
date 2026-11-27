import { ChevronRight, FileSearch, ImageIcon, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CtvOttFormat } from "@/features/ctv-ott/render-package";
import type { PackageSummary, Severity } from "@/lib/qa-engine";
import { formatBytes } from "@/lib/qa-engine";

export type OverviewSectionProps = {
  summary: PackageSummary;
  packageSizeBytes: number;
  teaserAvailable: boolean;
  ctvOttFormats: CtvOttFormat[];
  errorCount: number;
  warningCount: number;
  issueCount: number;
  onOpenMainUnit: () => void;
  onOpenTeasers: () => void;
  onOpenCtvOtt: () => void;
  onOpenFindings: () => void;
  onShowSeverity: (severity: Severity) => void;
  onOpenAssets: () => void;
  onOpenAssetFindings: (assetPath: string) => void;
};

export function OverviewSection({
  summary,
  packageSizeBytes,
  teaserAvailable,
  ctvOttFormats,
  errorCount,
  warningCount,
  issueCount,
  onOpenMainUnit,
  onOpenTeasers,
  onOpenCtvOtt,
  onOpenFindings,
  onShowSeverity,
  onOpenAssets,
  onOpenAssetFindings,
}: OverviewSectionProps) {
  return (
    <div role="tabpanel" className="workspace-content">
      <section className="summary-hero">
        <div>
          <span className="eyebrow">PACKAGE SUMMARY</span>
          <h1>{summary.creativeName}</h1>
          <p>{issueCount ? `${issueCount} issue${issueCount === 1 ? "" : "s"} need review before handoff.` : "No errors or warnings were found by the current rule set."}</p>
        </div>
        <Button variant="outline" onClick={onOpenFindings}>See all {summary.findings.length} findings <ChevronRight /></Button>
      </section>
      <section className="stat-grid overview-action-grid" aria-label="Quick access">
        <button className="quick-link overview-action-card" onClick={onOpenMainUnit}>
          <span className="quick-link-icon"><ImageIcon /></span>
          <span><strong>Main Unit</strong><small>{summary.artboards.length} sizes · {summary.tabs.length} tabs</small></span>
          <ChevronRight />
        </button>
        {teaserAvailable && <button className="quick-link overview-action-card" onClick={onOpenTeasers}>
          <span className="quick-link-icon"><Play /></span>
          <span><strong>Teaser preview</strong><small>Open teaser formats</small></span>
          <ChevronRight />
        </button>}
        {ctvOttFormats.length > 0 && <button className="quick-link overview-action-card" onClick={onOpenCtvOtt}>
          <span className="quick-link-icon"><Play /></span>
          <span><strong>CTV/OTT view</strong><small>{ctvOttFormats.map(format => format.toUpperCase()).join(" + ")} ready</small></span>
          <ChevronRight />
        </button>}
        <button className="quick-link overview-action-card findings-link" onClick={onOpenFindings}>
          <span className="quick-link-icon"><FileSearch /></span>
          <span><strong>Review findings</strong><small>{summary.findings.length} items · highest priority first</small></span>
          <ChevronRight />
        </button>
      </section>
      <section className="overview-grid overview-details">
        <article className="panel package-at-glance">
          <div className="panel-heading"><div><span className="eyebrow">PACKAGE DETAILS</span><h2>Package at a glance</h2></div></div>
          <div className="snapshot-row">
            <strong>Videos ({summary.videos.length})</strong>
            <div className="snapshot-content">
              {summary.videos.length ? summary.videos.map((video, index) => {
                const asset = summary.assets.find(item => item.name === video.path);
                const hasValidationFinding = Boolean(asset?.validationErrors.length || asset?.validationWarnings.length);
                return <div className="video-summary" key={`${video.path}-${video.size}-${index}`}>
                  <span>{video.name} · {formatBytes(video.size)}</span>
                  {hasValidationFinding && <button type="button" className="asset-status warning" onClick={() => onOpenAssetFindings(video.path)} aria-label={`Show findings for ${video.name}`}>Warning</button>}
                </div>;
              }) : <span className="muted">None found</span>}
            </div>
          </div>
          <div className="snapshot-row"><strong>Tabs ({summary.tabs.length})</strong><span>{summary.tabs.length ? summary.tabs.join(" · ") : "No named tabs found"}</span></div>
          <div className="snapshot-row"><strong>Components ({summary.components.reduce((total, item) => total + item.count, 0)})</strong><span>{summary.components.length ? summary.components.map(item => `${item.name} (${item.count})`).join(" · ") : "No recognized components found"}</span></div>
          <div className="snapshot-row"><strong>Fonts ({summary.fonts.length})</strong><span>{summary.fonts.length ? summary.fonts.join(" · ") : "No font metadata found"}</span></div>
          <div className="snapshot-row"><strong>Colors ({summary.colorCount})</strong><span className="color-summary">{summary.colors.map(color => <span key={color.hex} title={`${color.hex} · ${color.count} uses`}><i style={{ backgroundColor: color.hex }} />{color.hex}</span>)}</span></div>
        </article>
        <article className="panel review-summary">
          <div className="panel-heading"><div><span className="eyebrow">PACKAGE REVIEW</span><h2>Review summary</h2></div></div>
          <section className="stat-grid overview-metrics review-summary-metrics">
            <button className="stat-card metric-error" onClick={() => onShowSeverity("error")}><p>Errors</p><strong>{errorCount}</strong><span>Critical issues to fix</span></button>
            <button className="stat-card metric-warning" onClick={() => onShowSeverity("warning")}><p>Warnings</p><strong>{warningCount}</strong><span>Items for designer review</span></button>
            <div className="stat-card metric-cta" title={summary.ctaReferenceArtboard ? `Counts CTA instances across tabs and slides in the Desktop Expandable reference size (${summary.ctaReferenceArtboard}). Repeated groups in other ad sizes are counted once.` : "Desktop Expandable (970x546) was not found, so CTAs cannot be calculated."}>
              <p>CTAs</p><strong>{summary.ctaCount ?? "—"}</strong><span>{summary.ctaReferenceArtboard ? `Desktop Expandable · ${summary.ctaReferenceArtboard}` : "Desktop Expandable unavailable"}</span>
            </div>
            <button className="stat-card metric-assets" onClick={onOpenAssets}><p>Package size</p><strong>{formatBytes(packageSizeBytes)}</strong><span>{summary.assets.length} files</span></button>
          </section>
        </article>
      </section>
    </div>
  );
}
