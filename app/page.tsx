"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, CircleAlert, Play, Camera, Download, FileSearch, Files, ImageIcon, LoaderCircle,
  MessageSquareWarning, Moon, MoreVertical, PackageOpen,
  ShieldCheck, Sparkles, Sun, Upload,
} from "lucide-react";
import { currentPreview } from "../preview/current-preview";
import { readPackage, type PackageContents } from "@/features/package-loading/read-package";
import { MAX_PACKAGE_SIZE_BYTES } from "@/config/package";
import { buildPreviewDocument } from "@/features/preview-bridge/preview-document";
import { usePreviewMessages } from "@/features/preview-bridge/use-preview-messages";
import type { CtvOttFormat } from "@/features/ctv-ott/render-package";
import { useCtvOttWorkflow } from "@/features/ctv-ott/use-ctv-ott-workflow";
import { preparePackageReview } from "@/features/package-workflow/prepare-package-review";
import { captureFeedbackPreview } from "@/features/feedback/capture-preview";
import type { FeedbackPackageData } from "@/features/feedback/types";
import { TeaserPreview } from "@/components/teaser-preview";
import { useTeaserWorkflow } from "@/features/teasers/use-teaser-workflow";
import { FeedbackDialog } from "@/features/feedback/feedback-dialog";
import { OverviewSection } from "@/features/overview/overview-section";
import { FindingsSection } from "@/features/findings/findings-section";
import { AssetsSection } from "@/features/assets/assets-section";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Finding, type PackageSummary, type Severity } from "@/lib/qa-engine";
import { setPreviewPlaybackActive } from "@/lib/preview-playback";
import { countFindings, filterAssets, filterFindings, getFindingFacets, groupFindings } from "@/features/findings/finding-view-model";

type Theme = "dark" | "light";
// Vite embeds this public token at build time for both local and static builds.
const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";
const PREVIEW_VERSION = currentPreview.version;
const previewSource = currentPreview.source;
const BRIDGE_TOKEN = `turbo-qa-preview-${PREVIEW_VERSION}`;
const THEME_STORAGE_KEY = "turbo-qa-studio-theme";
function savedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function setPreviewTheme(frame: HTMLIFrameElement | null, theme: Theme) {
  frame?.contentWindow?.postMessage({ type: "tqa:set-theme", token: BRIDGE_TOKEN, theme }, "*");
}

async function loadPreviewFile(frame: HTMLIFrameElement | null, file: File, buffer: ArrayBuffer) {
  if (!frame) return;
  // Construct the File and input event inside the preview's own realm.
  // Direct foreign-realm file/event assignment can silently miss its handler.
  frame.contentWindow?.postMessage({
    type: "tqa:load-package",
    token: BRIDGE_TOKEN,
    name: file.name,
    mimeType: file.type,
    buffer,
  }, "*", [buffer]);
}

function ctvOttViewLabel(formats: CtvOttFormat[]) {
  return formats.length === 2 ? "View CTV/OTT" : `View ${formats[0]?.toUpperCase() || "CTV/OTT"}`;
}

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const mapPreviewConfigRef = useRef<PackageContents["mapPreviewConfig"]>(null);
  const summaryRef = useRef<PackageSummary | null>(null);
  const captureBusyRef = useRef(false);
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const themeRef = useRef(theme);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [previewSizeCount, setPreviewSizeCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<PackageSummary | null>(null);
  const [sourcePackage, setSourcePackage] = useState<File | null>(null);
  const generationRequestRef = useRef("");
  const ctvOttWorkflow = useCtvOttWorkflow({ generationRequestRef });
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const teaserWorkflow = useTeaserWorkflow({ bridgeToken: BRIDGE_TOKEN, iframeRef, sourcePackage, generationRequestRef, setError });
  const [findingQuery, setFindingQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetScope, setAssetScope] = useState("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [findingCategory, setFindingCategory] = useState("all");
  const [findingTab, setFindingTab] = useState("all");
  const [findingSize, setFindingSize] = useState("all");
  const [activeTab, setActiveTabState] = useState("overview");
  const setActiveTab = (section: string) => {
    // Resume inside the navigation gesture so audible playback is permitted.
    setPreviewPlaybackActive(iframeRef.current, section === "preview");
    setActiveTabState(section);
    if (section === "teasers") void teaserWorkflow.loadTeaserAssets();
  };
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackPackageData, setFeedbackPackageData] = useState<FeedbackPackageData>(null);
  const srcDoc = useMemo(() => buildPreviewDocument(previewSource, BRIDGE_TOKEN), []);
  useEffect(() => { summaryRef.current = summary; }, [summary]);
  useEffect(() => {
    setPreviewPlaybackActive(iframeRef.current, Boolean(summary) && activeTab === "preview");
  }, [activeTab, summary]);

  useEffect(() => {
    themeRef.current = theme;
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
    setPreviewTheme(iframeRef.current, theme);
  }, [theme]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "open_qa_section",
        title: "Open QA section",
        description: "Open Overview, Findings, Assets, Teasers, or Main Unit in the visible Turbo QA Studio workspace.",
        inputSchema: {
          type: "object",
          properties: { section: { type: "string", enum: ["overview", "findings", "assets", "teasers", "ctvOtt", "preview"] } },
          required: ["section"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const section = (input as { section?: string })?.section;
          if (!summaryRef.current) throw new Error("Open a Turbo ZIP package first.");
          if (!section || !["overview", "findings", "assets", "teasers", "ctvOtt", "preview"].includes(section)) throw new Error("Unsupported QA section.");
          setActiveTab(section);
          return { section, creativeName: summaryRef.current.creativeName };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);

  usePreviewMessages({
    bridgeToken: BRIDGE_TOKEN,
    iframeRef,
    mapPreviewConfigRef,
    captureBusyRef,
    themeRef,
    generationRequestRef,
    generationNeededRef: teaserWorkflow.generationNeededRef,
    pendingGeneratedFrameRef: teaserWorkflow.pendingGeneratedFrameRef,
    teaserMediaRef: teaserWorkflow.teaserMediaRef,
    setCaptureBusy,
    setPreviewSizeCount,
    setTeaserMedia: teaserWorkflow.setTeaserMedia,
    setTeaserGenerationStatus: teaserWorkflow.setTeaserGenerationStatus,
    setError,
    setPreviewTheme,
  });

  const openPackage = async (file?: File) => {
    if (!file) return;
    if (captureBusyRef.current || iframeRef.current?.contentDocument?.documentElement.dataset.captureBusy === "true") {
      setError("Finish or cancel screenshot capture before replacing the package.");
      return;
    }
    if (!/\.zip$/i.test(file.name)) { setError("Choose a ZIP export package."); setStatus("error"); return; }
    pendingFileRef.current = file;
    mapPreviewConfigRef.current = null;
    setFeedbackPackageData(null);
    setSourcePackage(file);
    generationRequestRef.current = `${file.name}:${file.size}:${file.lastModified}`;
    teaserWorkflow.beginPackage();
    ctvOttWorkflow.beginPackage();
    setSummary(null); setPreviewSizeCount(null); setStatus("loading"); setError(""); setActiveTab("overview");
    if (file.size > MAX_PACKAGE_SIZE_BYTES) {
      setStatus("error"); setError("ZIP/package exceeds the maximum 600 MB size."); return;
    }
    try {
      const packageData = await readPackage(file, MAPBOX_ACCESS_TOKEN);
      teaserWorkflow.setPackageSource({ file, exportData: packageData.exportData, assets: packageData.assets });
      setFeedbackPackageData({ exportData: packageData.exportData, assets: packageData.assets });
      mapPreviewConfigRef.current = packageData.mapPreviewConfig;
      iframeRef.current?.contentWindow?.postMessage({
        type: "tqa:map-config",
        token: BRIDGE_TOKEN,
        config: packageData.mapPreviewConfig,
      }, "*");
      const prepared = preparePackageReview(packageData, file.name, file.size);
      const { summary: analyzed, ctvOttFormats: detectedCtvOttFormats, teaserMedia: nextMedia, teaserLayouts: nextLayouts, teaserLayoutUrls: nextLayoutUrls, needsTeaserGeneration: needsGeneration } = prepared;
      teaserWorkflow.applyPreparedPackage({
        media: nextMedia,
        layouts: nextLayouts,
        layoutUrls: nextLayoutUrls,
        needsGeneration,
        hasVideo: Boolean(packageData.teaserBytes.video),
      });
      setSummary(analyzed);
      setStatus("ready"); setError("");
      void loadPreviewFile(iframeRef.current, file, packageData.previewBuffer);
      void ctvOttWorkflow.renderPackage(file, detectedCtvOttFormats, generationRequestRef.current);
    } catch (cause) {
      setStatus("error"); setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const filteredFindings = useMemo(() => filterFindings(summary?.findings || [], {
    query: findingQuery, severity, category: findingCategory, tab: findingTab, size: findingSize,
  }), [summary, findingQuery, severity, findingCategory, findingTab, findingSize]);
  const findingGroups = useMemo(() => groupFindings(filteredFindings), [filteredFindings]);
  const findingFacets = useMemo(() => getFindingFacets(summary?.findings || []), [summary]);
  const { categories: findingCategories, tabs: findingTabs, sizes: findingSizes } = findingFacets;
  const filteredAssets = useMemo(() => filterAssets(summary?.assets || [], assetQuery, assetScope), [summary, assetQuery, assetScope]);

  const downloadReport = () => {
    if (!summary) return;
    const report = { generatedAt: new Date().toISOString(), previewEngine: PREVIEW_VERSION, ...summary };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${summary.creativeName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "creative"}-qa-report.json`;
    link.click(); URL.revokeObjectURL(url);
  };

  const totalBytes = summary?.assets.reduce((sum, asset) => sum + asset.uncompressedSize, 0) || 0;
  const issueCount = summary ? countFindings(summary.findings, "error") + countFindings(summary.findings, "warning") : 0;
  const openScreenshots = () => {
    setActiveTab("preview");
    window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:open-screenshots", token: BRIDGE_TOKEN }, "*"), 0);
  };
  const openMainUnit = (size: string) => {
    setActiveTab("preview");
    window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:select-size", token: BRIDGE_TOKEN, size }, "*"), 0);
  };
  const focusFinding = (finding: Finding) => {
    if (!finding.layerId || !finding.artboard) return;
    setActiveTab("preview");
    window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:focus-finding", token: BRIDGE_TOKEN, finding }, "*"), 0);
  };
  const showSeverityFindings = (nextSeverity: Severity | "all") => {
    setSeverity(nextSeverity);
    setFindingCategory("all"); setFindingTab("all"); setFindingSize("all"); setFindingQuery("");
    setActiveTab("findings");
  };
  const toggleFindingSeverity = (target: Severity) => {
    showSeverityFindings(severity === target ? "all" : target);
  };
  const openAssetFindings = (assetPath: string) => {
    setSeverity("all"); setFindingCategory("Assets"); setFindingTab("all"); setFindingSize("all"); setFindingQuery(assetPath); setActiveTab("findings");
  };
  const openCtvOtt = () => {
    setActiveTab("ctvOtt");
    ctvOttWorkflow.retry(pendingFileRef.current);
  };

  const openFeedback = () => setFeedbackOpen(true);

  return (
    <main className="studio-shell">
      <input ref={fileInputRef} className="sr-only" disabled={captureBusy} type="file" accept=".zip,application/zip" onChange={event => openPackage(event.target.files?.[0])} />
      <header className="studio-header">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true"><span /></span><div><strong>Turbo QA Studio</strong><span>Creative preflight</span></div></div>
        <div className="creative-context">{summary ? <span title={`${summary.sourceFile} · ${previewSizeCount ?? summary.artboards.length} sizes`}>{summary.sourceFile} · {previewSizeCount ?? summary.artboards.length} sizes</span> : <span>NO PACKAGE OPEN</span>}</div>
        <div className="header-actions">
          <Button disabled={captureBusy} title={captureBusy ? "Finish or cancel screenshot capture first" : undefined} onClick={() => fileInputRef.current?.click()}><PackageOpen /> {summary ? "Replace package" : "Open package"}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button className="more-actions" variant="outline" size="icon" aria-label="App menu"><MoreVertical /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="package-menu">
              {summary && <>
                <DropdownMenuItem onSelect={downloadReport}><Download /> Generate report</DropdownMenuItem>
                <DropdownMenuItem disabled={captureBusy} onSelect={openScreenshots}><Camera /> Screenshots</DropdownMenuItem>
              </>}
              <DropdownMenuItem onSelect={openFeedback}><MessageSquareWarning /> Report feedback</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme} onValueChange={value => { if (value === "dark" || value === "light") setTheme(value); }}>
                <DropdownMenuRadioItem value="dark"><Moon /> Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="light"><Sun /> Light</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {!summary && status !== "loading" ? (
        <section className="empty-workspace" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); openPackage(event.dataTransfer.files?.[0]); }}>
          <div className="drop-card reg-card"><span className="reg-corner tl" /><span className="reg-corner tr" /><span className="reg-corner bl" /><span className="reg-corner br" />
            <div className="drop-icon"><Upload /></div><span className="eyebrow">LOCAL CREATIVE ANALYSIS</span>
            <h1>Preflight a Turbo package before production.</h1>
            <p>Inspect structure, copy consistency, asset references, typography risks, and the full interactive preview from one ZIP.</p>
            <Button size="lg" onClick={() => fileInputRef.current?.click()}><Archive /> Choose ZIP package</Button>
            <div className="privacy-note"><ShieldCheck /> Creative files stay in your browser. Review status and notes are saved locally and sent to Notion only when you save the review.</div>
          </div>
          {status === "error" && <div className="error-banner"><CircleAlert /> {error}</div>}
        </section>
      ) : status === "loading" ? (
        <section className="loading-workspace"><LoaderCircle className="spin" /><strong>Opening package</strong><span>Building the creative index and running high-confidence checks…</span></section>
      ) : summary ? (
        <div className="workspace-tabs">
          <div className="workspace-nav"><div data-slot="tabs-list" className="native-tabs-list" role="tablist" aria-label="QA workspace">
            <button type="button" role="tab" data-slot="tabs-trigger" data-state={activeTab === "overview" ? "active" : "inactive"} aria-selected={activeTab === "overview"} onClick={() => setActiveTab("overview")}><Sparkles /> Overview</button>
            <button type="button" role="tab" data-slot="tabs-trigger" data-state={activeTab === "findings" ? "active" : "inactive"} aria-selected={activeTab === "findings"} onClick={() => setActiveTab("findings")}><FileSearch /> Findings <span className="nav-count">{summary.findings.length}</span></button>
            <button type="button" role="tab" data-slot="tabs-trigger" data-state={activeTab === "assets" ? "active" : "inactive"} aria-selected={activeTab === "assets"} onClick={() => setActiveTab("assets")}><Files /> Assets <span className="nav-count">{summary.assets.length}</span></button>
            <button type="button" role="tab" data-slot="tabs-trigger" data-state={activeTab === "teasers" ? "active" : "inactive"} aria-selected={activeTab === "teasers"} onClick={() => setActiveTab("teasers")}><ImageIcon /> Teasers</button>
            <button type="button" role="tab" data-slot="tabs-trigger" data-state={activeTab === "preview" ? "active" : "inactive"} aria-selected={activeTab === "preview"} onClick={() => setActiveTab("preview")}><ImageIcon /> Main Unit <span className="preview-version">{PREVIEW_VERSION}</span></button>
          </div></div>

          <div className="ctv-ott-subnav" role="navigation" aria-label="CTV and OTT teaser navigation">
            {ctvOttWorkflow.formats.length > 0 && <button type="button" className={activeTab === "ctvOtt" ? "active" : ""} onClick={openCtvOtt}><Play /> {ctvOttViewLabel(ctvOttWorkflow.formats)}</button>}
            {ctvOttWorkflow.status === "rendering" && <span role="status"><LoaderCircle className="spin" /> Generating teaser preview…</span>}
            {ctvOttWorkflow.status === "error" && <span className="ctv-ott-subnav-error" role="alert"><CircleAlert /> {ctvOttWorkflow.error}</span>}
            {ctvOttWorkflow.status === "missing" && <span className="ctv-ott-subnav-error" role="alert"><CircleAlert /> {ctvOttWorkflow.error}</span>}
          </div>

          {activeTab === "overview" && <OverviewSection
            summary={summary}
            packageSizeBytes={sourcePackage?.size || totalBytes}
            teaserAvailable={Boolean(teaserWorkflow.teaserMedia)}
            ctvOttFormats={ctvOttWorkflow.formats}
            errorCount={countFindings(summary.findings, "error")}
            warningCount={countFindings(summary.findings, "warning")}
            issueCount={issueCount}
            onOpenMainUnit={() => setActiveTab("preview")}
            onOpenTeasers={() => setActiveTab("teasers")}
            onOpenCtvOtt={openCtvOtt}
            onOpenFindings={() => setActiveTab("findings")}
            onShowSeverity={showSeverityFindings}
            onOpenAssets={() => setActiveTab("assets")}
            onOpenAssetFindings={openAssetFindings}
          />}

          {activeTab === "findings" && <FindingsSection
            findingCount={summary.findings.length}
            sizeCount={summary.artboards.length}
            tabCount={summary.tabCount}
            errorCount={countFindings(summary.findings, "error")}
            warningCount={countFindings(summary.findings, "warning")}
            severity={severity}
            query={findingQuery}
            category={findingCategory}
            tab={findingTab}
            size={findingSize}
            categories={findingCategories}
            tabs={findingTabs}
            sizes={findingSizes}
            groups={findingGroups}
            onSeverityToggle={toggleFindingSeverity}
            onQueryChange={setFindingQuery}
            onCategoryChange={setFindingCategory}
            onTabChange={setFindingTab}
            onSizeChange={setFindingSize}
            onFocusFinding={focusFinding}
          />}

          {activeTab === "assets" && <AssetsSection
            filteredAssets={filteredAssets}
            firstViews={summary.firstViews}
            query={assetQuery}
            scope={assetScope}
            onQueryChange={setAssetQuery}
            onScopeChange={setAssetScope}
          />}

          {activeTab === "ctvOtt" && <div role="tabpanel" className="workspace-content ctv-ott-page">
            <section className="page-title"><span className="eyebrow">TEASER PREVIEW</span><h1>{ctvOttViewLabel(ctvOttWorkflow.formats)}</h1><p>Automatically generated from the detected package theme.</p></section>
            {ctvOttWorkflow.status === "rendering" && <section className="ctv-ott-state" role="status"><LoaderCircle className="spin" /><strong>Generating CTV/OTT teaser preview…</strong></section>}
            {ctvOttWorkflow.status === "error" && <section className="ctv-ott-state error" role="alert"><CircleAlert /><div><strong>CTV/OTT preview unavailable</strong><span>{ctvOttWorkflow.error}</span></div></section>}
            {ctvOttWorkflow.status === "missing" && <section className="ctv-ott-state error" role="alert"><CircleAlert /><div><strong>CTV/OTT assets missing</strong><span>{ctvOttWorkflow.error}</span></div></section>}
            {ctvOttWorkflow.status === "ready" && <div className="ctv-ott-video-grid">{ctvOttWorkflow.formats.map(format => <article key={format} className="ctv-ott-video-card"><h2>{format.toUpperCase()} preview</h2><video src={ctvOttWorkflow.videos[format]} controls autoPlay muted loop playsInline controlsList="nodownload" aria-label={`${format.toUpperCase()} teaser preview`} /></article>)}</div>}
          </div>}

          {activeTab === "teasers" && teaserWorkflow.teaserMedia && <div role="tabpanel"><TeaserPreview artboards={summary.artboards} media={teaserWorkflow.teaserMedia} layouts={teaserWorkflow.teaserLayouts} generationStatus={teaserWorkflow.teaserGenerationStatus} onOpen={openMainUnit} /></div>}
          {activeTab === "preview" && <div role="tabpanel" className="preview-content"><div className="preview-placeholder" /></div>}
        </div>
      ) : null}

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} summary={summary} sourcePackage={sourcePackage} packageData={feedbackPackageData} activeTab={activeTab} theme={theme} build={PREVIEW_VERSION} capturePreview={() => captureFeedbackPreview(iframeRef.current, BRIDGE_TOKEN)} />

      <iframe ref={iframeRef} title="Turbo package preview" allow="autoplay" srcDoc={srcDoc} onLoad={() => {
        setPreviewPlaybackActive(iframeRef.current, Boolean(summary) && activeTab === "preview");
      }} className={summary && activeTab === "preview" ? "preview-frame" : "analysis-frame"} />
    </main>
  );
}
