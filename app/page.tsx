"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Archive, CheckCircle2, ChevronRight, CircleAlert,
  Download, FileSearch, Files, ImageIcon, Info, LoaderCircle,
  PackageOpen, Search, ShieldCheck, Sparkles, Upload,
} from "lucide-react";
import previewSource from "../legacy/turbo-preview-7.7.0.html?raw";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyzePackage, formatBytes, type Finding, type PackageSummary, type Severity } from "@/lib/qa-engine";

type BridgeAsset = { name: string; compressedSize: number; uncompressedSize: number };

const iframeBootstrap = `<script>window.global = window;</scr` + `ipt>`;

const bridgeScript = String.raw`
<script>
(() => {
  window.addEventListener("message", async (event) => {
    if (!event.data || event.data.type !== "tqa:load-package" || !event.data.file) return;
    const file = event.data.file;
    try {
      const input = document.getElementById("fileInputZip");
      if (input) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      const zip = await JSZip.loadAsync(file);
      const entries = Object.values(zip.files).filter(entry => !entry.dir);
      const exportEntry = entries.find(entry => /^export\.json$/i.test(entry.name.split("/").pop() || ""));
      if (!exportEntry) throw new Error("No export.json found inside this ZIP.");
      const exportData = JSON.parse(await exportEntry.async("string"));
      const assets = entries.map(entry => ({
        name: entry.name,
        compressedSize: Number(entry._data && entry._data.compressedSize || 0),
        uncompressedSize: Number(entry._data && entry._data.uncompressedSize || 0)
      }));
      window.parent.postMessage({ type: "tqa:package-ready", exportData, assets, sourceFile: file.name }, "*");
    } catch (error) {
      window.parent.postMessage({ type: "tqa:package-error", message: error && error.message ? error.message : String(error) }, "*");
    }
  });
  window.parent.postMessage({ type: "tqa:preview-ready" }, "*");
})();
</scr` + `ipt>`;

function buildPreviewDocument() {
  // The legacy source discusses literal </body> tags inside JavaScript
  // comments. Replacing the first match injects markup into that script and
  // breaks the srcdoc parser. Insert only before the document's final tag.
  const headStart = previewSource.indexOf("<head>");
  const bootstrapAt = headStart >= 0 ? headStart + "<head>".length : -1;
  const bootstrappedSource = bootstrapAt >= 0
    ? `${previewSource.slice(0, bootstrapAt)}${iframeBootstrap}${previewSource.slice(bootstrapAt)}`
    : `${iframeBootstrap}${previewSource}`;
  const bodyEnd = bootstrappedSource.lastIndexOf("</body>");
  return bodyEnd >= 0
    ? `${bootstrappedSource.slice(0, bodyEnd)}${bridgeScript}${bootstrappedSource.slice(bodyEnd)}`
    : `${bootstrappedSource}${bridgeScript}`;
}

function SeverityIcon({ level }: { level: Severity }) {
  if (level === "error") return <CircleAlert aria-hidden="true" />;
  if (level === "warning") return <AlertTriangle aria-hidden="true" />;
  return <Info aria-hidden="true" />;
}

function count(findings: Finding[], level: Severity) {
  return findings.filter(finding => finding.severity === level).length;
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="stat-card reg-card"><span className="reg-corner tl" /><span className="reg-corner br" /><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const summaryRef = useRef<PackageSummary | null>(null);
  const [summary, setSummary] = useState<PackageSummary | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [findingQuery, setFindingQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [activeTab, setActiveTab] = useState("overview");
  const srcDoc = useMemo(() => buildPreviewDocument(), []);

  useEffect(() => { summaryRef.current = summary; }, [summary]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "open_qa_section",
        title: "Open QA section",
        description: "Open Overview, Findings, Assets, or Preview in the visible Turbo QA Studio workspace.",
        inputSchema: {
          type: "object",
          properties: { section: { type: "string", enum: ["overview", "findings", "assets", "preview"] } },
          required: ["section"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const section = (input as { section?: string })?.section;
          if (!summaryRef.current) throw new Error("Open a Turbo ZIP package first.");
          if (!section || !["overview", "findings", "assets", "preview"].includes(section)) throw new Error("Unsupported QA section.");
          setActiveTab(section);
          return { section, creativeName: summaryRef.current.creativeName };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "tqa:preview-ready") {
        setPreviewReady(true);
        if (pendingFileRef.current) iframeRef.current?.contentWindow?.postMessage({ type: "tqa:load-package", file: pendingFileRef.current }, "*");
      } else if (event.data?.type === "tqa:package-ready") {
        try {
          setSummary(analyzePackage(event.data.exportData, event.data.assets as BridgeAsset[], event.data.sourceFile));
          setStatus("ready"); setError("");
        } catch (cause) {
          setStatus("error"); setError(cause instanceof Error ? cause.message : String(cause));
        }
      } else if (event.data?.type === "tqa:package-error") {
        setStatus("error"); setError(event.data.message || "The package could not be analyzed.");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  const openPackage = (file?: File) => {
    if (!file) return;
    if (!/\.zip$/i.test(file.name)) { setError("Choose a ZIP export package."); setStatus("error"); return; }
    pendingFileRef.current = file;
    setSummary(null); setStatus("loading"); setError(""); setActiveTab("overview");
    if (previewReady) iframeRef.current?.contentWindow?.postMessage({ type: "tqa:load-package", file }, "*");
  };

  const filteredFindings = useMemo(() => {
    if (!summary) return [];
    const query = findingQuery.trim().toLowerCase();
    return summary.findings.filter(finding => (severity === "all" || finding.severity === severity) && (!query || [finding.title, finding.message, finding.artboard, finding.tab, finding.slide, finding.layerName, finding.ruleId].some(value => String(value || "").toLowerCase().includes(query))));
  }, [summary, findingQuery, severity]);

  const filteredAssets = useMemo(() => {
    if (!summary) return [];
    const query = assetQuery.trim().toLowerCase();
    return summary.assets.filter(asset => !query || [asset.name, asset.extension, asset.status].some(value => value.toLowerCase().includes(query)));
  }, [summary, assetQuery]);

  const downloadReport = () => {
    if (!summary) return;
    const report = { generatedAt: new Date().toISOString(), previewEngine: "7.7.0", ...summary };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${summary.creativeName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "creative"}-qa-report.json`;
    link.click(); URL.revokeObjectURL(url);
  };

  const totalBytes = summary?.assets.reduce((sum, asset) => sum + asset.uncompressedSize, 0) || 0;
  const issueCount = summary ? count(summary.findings, "error") + count(summary.findings, "warning") : 0;

  return (
    <main className="studio-shell">
      <input ref={fileInputRef} className="sr-only" type="file" accept=".zip,application/zip" onChange={event => openPackage(event.target.files?.[0])} />
      <header className="studio-header">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><span /></span><div><strong>Turbo QA Studio</strong><span>Creative preflight</span></div></div>
        <div className="creative-context">{summary ? <><span>CREATIVE</span><strong>{summary.creativeName}</strong><small>{summary.sourceFile}</small></> : <span>NO PACKAGE OPEN</span>}</div>
        <div className="header-actions">
          <Badge variant="outline" className="engine-badge">Preview engine 7.7.0</Badge>
          {summary && <Button variant="outline" onClick={downloadReport}><Download /> Report</Button>}
          <Button onClick={() => fileInputRef.current?.click()}><PackageOpen /> {summary ? "Replace package" : "Open package"}</Button>
        </div>
      </header>

      {!summary && status !== "loading" ? (
        <section className="empty-workspace" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); openPackage(event.dataTransfer.files?.[0]); }}>
          <div className="drop-card reg-card"><span className="reg-corner tl" /><span className="reg-corner tr" /><span className="reg-corner bl" /><span className="reg-corner br" />
            <div className="drop-icon"><Upload /></div><span className="eyebrow">LOCAL CREATIVE ANALYSIS</span>
            <h1>Preflight a Turbo package before production.</h1>
            <p>Inspect structure, copy consistency, asset references, typography risks, and the full interactive preview from one ZIP.</p>
            <Button size="lg" onClick={() => fileInputRef.current?.click()}><Archive /> Choose ZIP package</Button>
            <div className="privacy-note"><ShieldCheck /> Processed locally in your browser. Nothing is uploaded.</div>
          </div>
          {status === "error" && <div className="error-banner"><CircleAlert /> {error}</div>}
        </section>
      ) : status === "loading" ? (
        <section className="loading-workspace"><LoaderCircle className="spin" /><strong>Opening package</strong><span>Building the creative index and running high-confidence checks…</span></section>
      ) : summary ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="workspace-tabs">
          <div className="workspace-nav"><TabsList variant="line">
            <TabsTrigger value="overview"><Sparkles /> Overview</TabsTrigger>
            <TabsTrigger value="findings"><FileSearch /> Findings <span className="nav-count">{summary.findings.length}</span></TabsTrigger>
            <TabsTrigger value="assets"><Files /> Assets <span className="nav-count">{summary.assets.length}</span></TabsTrigger>
            <TabsTrigger value="preview"><ImageIcon /> Preview</TabsTrigger>
          </TabsList><div className="scan-status"><CheckCircle2 /> Static analysis complete</div></div>

          <TabsContent value="overview" className="workspace-content">
            <section className="summary-hero"><div><span className="eyebrow">PACKAGE SUMMARY</span><h1>{summary.creativeName}</h1><p>{issueCount ? `${issueCount} issue${issueCount === 1 ? "" : "s"} need review before handoff.` : "No errors or warnings were found by the current rule set."}</p></div><Button variant="outline" onClick={() => setActiveTab("findings")}>Review findings <ChevronRight /></Button></section>
            <section className="stat-grid"><Stat label="Artboards" value={summary.artboards.length} detail={summary.artboards.join(" · ")} /><Stat label="Content states" value={`${summary.tabCount} / ${summary.slideCount}`} detail="Tabs / named slides" /><Stat label="Text layers" value={summary.textLayerCount} detail="Checked for typography risks" /><Stat label="Package assets" value={summary.assets.length} detail={`${formatBytes(totalBytes)} uncompressed`} /></section>
            <section className="severity-grid">{(["error", "warning", "info"] as Severity[]).map(level => <button key={level} className={`severity-card ${level}`} onClick={() => { setSeverity(level); setActiveTab("findings"); }}><span><SeverityIcon level={level} /></span><strong>{count(summary.findings, level)}</strong><div><b>{level === "info" ? "Notes" : `${level[0].toUpperCase()}${level.slice(1)}s`}</b><small>{level === "error" ? "Confirmed package defects" : level === "warning" ? "Needs designer review" : "Risks and limitations"}</small></div><ChevronRight /></button>)}</section>
            <section className="overview-grid"><article className="panel"><div className="panel-heading"><span className="eyebrow">COVERAGE</span><h2>Current analysis</h2></div><div className="coverage-list">{["Turbo structure and required artboards", "Asset references and package inventory", "Copy presence across artboards", "Tab-wide element presence", "Spacing, defaults, superscript and kerning"].map(item => <div key={item}><CheckCircle2 /><span>{item}</span></div>)}</div></article><article className="panel next-panel"><span className="eyebrow">NEXT ANALYSIS LAYER</span><h2>Rendered geometry</h2><p>Cropped copy, hanging lines, alignment and screenshot batches will use the same state index after fonts and assets settle.</p><Badge variant="outline">Foundation ready</Badge></article></section>
          </TabsContent>

          <TabsContent value="findings" className="workspace-content">
            <section className="page-title"><span className="eyebrow">CREATIVE ANALYSIS</span><h1>Findings</h1><p>Deterministic defects and review signals from the complete package structure.</p></section>
            <div className="toolbar"><label className="search-field"><Search /><input value={findingQuery} onChange={event => setFindingQuery(event.target.value)} placeholder="Search findings, layers, sizes…" /></label><div className="filter-group">{(["all", "error", "warning", "info"] as const).map(level => <button key={level} className={severity === level ? "active" : ""} onClick={() => setSeverity(level)}>{level === "all" ? "All" : level === "info" ? "Notes" : `${level[0].toUpperCase()}${level.slice(1)}s`}</button>)}</div></div>
            <div className="finding-list">{filteredFindings.length ? filteredFindings.map(finding => <article key={finding.id} className={`finding-row ${finding.severity}`}><div className="finding-icon"><SeverityIcon level={finding.severity} /></div><div className="finding-copy"><div className="finding-title"><strong>{finding.title}</strong><code>{finding.ruleId}</code></div><p>{finding.message}</p>{(finding.artboard || finding.tab || finding.slide || finding.layerName) && <div className="finding-location">{[finding.artboard, finding.tab, finding.slide, finding.layerName].filter(Boolean).map(value => <span key={value}>{value}</span>)}</div>}{finding.evidence && <small>{finding.evidence}</small>}</div><Badge variant="outline">{finding.confidence}</Badge></article>) : <div className="empty-results"><CheckCircle2 /><strong>No matching findings</strong><span>Adjust the search or severity filter.</span></div>}</div>
          </TabsContent>

          <TabsContent value="assets" className="workspace-content">
            <section className="page-title"><span className="eyebrow">PACKAGE INVENTORY</span><h1>Assets</h1><p>Files, sizes, declared references, and potential package debris.</p></section>
            <div className="toolbar"><label className="search-field"><Search /><input value={assetQuery} onChange={event => setAssetQuery(event.target.value)} placeholder="Filter by filename, type, or status…" /></label></div>
            <div className="table-panel"><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>References</TableHead><TableHead className="text-right">Size</TableHead></TableRow></TableHeader><TableBody>{filteredAssets.map(asset => <TableRow key={asset.name}><TableCell className="asset-name">{asset.name}</TableCell><TableCell>{asset.extension}</TableCell><TableCell><span className={`asset-status ${asset.status}`}>{asset.status}</span></TableCell><TableCell>{asset.referenceCount || "—"}</TableCell><TableCell className="text-right font-mono">{formatBytes(asset.uncompressedSize)}</TableCell></TableRow>)}</TableBody></Table></div>
          </TabsContent>

          <TabsContent value="preview" className="preview-content"><div className="preview-heading"><div><span className="eyebrow">REFERENCE RENDERER</span><strong>Turbo Preview 7.7.0</strong></div><span>The package remains inside this browser session.</span></div><div className="preview-placeholder" /></TabsContent>
        </Tabs>
      ) : null}

      <iframe ref={iframeRef} title="Turbo package preview" srcDoc={srcDoc} className={summary && activeTab === "preview" ? "preview-frame" : "analysis-frame"} />
    </main>
  );
}
