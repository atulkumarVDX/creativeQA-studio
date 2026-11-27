import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, type AssetRecord, type PackageSummary } from "@/lib/qa-engine";

export type AssetsSectionProps = {
  filteredAssets: AssetRecord[];
  firstViews: PackageSummary["firstViews"];
  query: string;
  scope: string;
  onQueryChange: (query: string) => void;
  onScopeChange: (scope: string) => void;
};

export function AssetsSection({ filteredAssets, firstViews, query, scope, onQueryChange, onScopeChange }: AssetsSectionProps) {
  return (
    <div role="tabpanel" className="workspace-content">
      <section className="page-title"><span className="eyebrow">PACKAGE INVENTORY</span><h1>Assets</h1><p>Files, sizes, declared references, and potential package debris.</p></section>
      <div className="toolbar">
        <label className="search-field"><Search /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Filter by filename, type, or status…" /></label>
        <select aria-label="Asset scope" value={scope} onChange={event => onScopeChange(event.target.value)}>
          <option value="all">All assets</option>
          <option value="first-view">First view</option>
          {firstViews.map(view => <option key={view.artboard} value={view.artboard}>{view.artboard} first view</option>)}
        </select>
      </div>
      <div className="table-panel">
        <Table>
          <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Size</TableHead><TableHead>Validation</TableHead><TableHead>Status</TableHead><TableHead>References</TableHead></TableRow></TableHeader>
          <TableBody>{filteredAssets.map((asset, index) => <TableRow key={`${asset.name}-${index}`}>
            <TableCell className="asset-name">{asset.name}</TableCell>
            <TableCell>{asset.extension}</TableCell>
            <TableCell className="text-right font-mono">{formatBytes(asset.uncompressedSize)}</TableCell>
            <TableCell>{asset.validationErrors.length || asset.validationWarnings.length ? <>
              <span className={`asset-status ${asset.validationErrors.length ? "error" : "warning"}`}>{asset.validationErrors.length ? "Error" : "Warning"}</span>
              {[...asset.validationErrors, ...asset.validationWarnings].map(message => <p key={message}>{message}</p>)}
            </> : "—"}</TableCell>
            <TableCell><span className={`asset-status ${asset.status}`}>{asset.status}</span></TableCell>
            <TableCell>{asset.referenceCount || "—"}</TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </div>
    </div>
  );
}
