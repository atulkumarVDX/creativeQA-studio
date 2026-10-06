"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { strFromU8, unzip } from "fflate";
import {
  AlertTriangle, Archive, CheckCircle2, ChevronRight, CircleAlert,
  Camera, Download, FileSearch, Files, ImageIcon, Info, LoaderCircle,
  Moon, MoreVertical, PackageOpen, Search, ShieldCheck, Sparkles, Sun, Upload,
} from "lucide-react";
import previewSource from "../preview/turbo-preview-7.8.4.html?raw";
import { TeaserPreview, type TeaserMedia, type TeaserPackageLayouts } from "@/components/teaser-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyzePackage, formatBytes, type Finding, type PackageSummary, type Severity } from "@/lib/qa-engine";
import { deriveTeaserGeometry } from "@/lib/teaser-layout";

type BridgeAsset = { name: string; compressedSize: number; uncompressedSize: number };
type Theme = "dark" | "light";
type TeaserBytes = Record<Exclude<keyof TeaserMedia, "generatedFrame">, Uint8Array | null>;
type PackageFile = readonly [string, Uint8Array];
type ExportLayer = { name?: unknown; bounds?: { width?: number | { _value?: number }; height?: number | { _value?: number } } };
const PREVIEW_VERSION = "7.8.4";
const BRIDGE_TOKEN = "turbo-qa-preview-7.8.4";
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

const bridgeScript = String.raw`
<script>
(() => {
  document.documentElement.dataset.tqaBridge = "ready";
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  window.addEventListener("message", async (event) => {
    if (!event.data || event.data.token !== "turbo-qa-preview-7.8.4") return;
    if (event.data.type === "tqa:ping") {
      window.parent.postMessage({ type: "tqa:preview-ready", token: "turbo-qa-preview-7.8.4" }, "*");
      return;
    }
    if (event.data.type === "tqa:open-screenshots") {
      document.getElementById("screenshotsBtn")?.click();
      return;
    }
    if (event.data.type === "tqa:set-theme") {
      if (event.data.theme === "dark" || event.data.theme === "light") {
        document.getElementById(event.data.theme === "dark" ? "darkModeBtn" : "lightModeBtn")?.click();
      }
      return;
    }
    if (event.data.type === "tqa:select-size") {
      const target = String(event.data.size || "").toLowerCase();
      if (document.querySelector('#sizePicker input[type="checkbox"]')) document.getElementById("previewModeBtn")?.click();
      const chip = Array.from(document.querySelectorAll("#sizePicker .chip")).find(node => node.textContent.trim().toLowerCase() === target);
      chip?.querySelector("input")?.click();
      return;
    }
    if (event.data.type === "tqa:capture-mobile-instream") {
      const requestId = String(event.data.requestId || "");
      try {
        const chip = Array.from(document.querySelectorAll("#sizePicker .chip")).find(node => node.textContent.trim().toLowerCase() === "mobile-instream");
        if (!chip) throw new Error("The package has no mobile-instream artboard.");
        const input = chip.querySelector('input[type="checkbox"], input[type="radio"]');
        if (input && !input.checked) input.click();
        await nextFrame(); await nextFrame();
        await new Promise(resolve => setTimeout(resolve, 120));
        const card = Array.from(document.querySelectorAll(".cp-artboard-card")).find(node => node.querySelector(".cp-artboard-label")?.textContent.trim().toLowerCase().startsWith("mobile-instream"));
        const stage = card?.querySelector(".cp-stage");
        if (!stage || !window.htmlToImage) throw new Error("The mobile-instream canvas could not be rendered.");
        const source = await window.htmlToImage.toCanvas(stage, { pixelRatio: 1, skipAutoScale: true, width: stage.offsetWidth, height: stage.offsetHeight });
        const output = document.createElement("canvas");
        output.width = 970; output.height = 546;
        output.getContext("2d").drawImage(source, 0, 0, output.width, output.height);
        window.parent.postMessage({ type: "tqa:mobile-instream-frame", token: "turbo-qa-preview-7.8.4", requestId, dataUrl: output.toDataURL("image/jpeg", .86) }, "*");
      } catch (error) {
        window.parent.postMessage({ type: "tqa:mobile-instream-frame-error", token: "turbo-qa-preview-7.8.4", requestId, message: error && error.message ? error.message : String(error) }, "*");
      }
      return;
    }
    if (event.data.type !== "tqa:load-package" || !event.data.buffer) return;
    const file = new File([event.data.buffer], event.data.name || "package.zip", { type: event.data.mimeType || "application/zip" });
    try {
      document.documentElement.dataset.tqaBridge = "received";
      const input = document.getElementById("fileInputZip");
      if (input) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        document.documentElement.dataset.tqaBridge = "dispatched";
      }
    } catch (error) {
      document.documentElement.dataset.tqaBridge = "error";
      window.parent.postMessage({ type: "tqa:preview-error", token: "turbo-qa-preview-7.8.4", message: error && error.message ? error.message : String(error) }, "*");
    }
  });
  window.addEventListener("csm:capture-state", (event) => {
    window.parent.postMessage({ type: "tqa:capture-state", token: "turbo-qa-preview-7.8.4", busy: Boolean(event.detail && event.detail.busy) }, "*");
  });
  const packageMeta = document.getElementById("pkgMeta");
  if (packageMeta && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      const sizeCount = Number.parseInt(packageMeta.textContent || "", 10);
      if (Number.isFinite(sizeCount)) window.parent.postMessage({ type: "tqa:package-meta", token: "turbo-qa-preview-7.8.4", sizeCount }, "*");
    }).observe(packageMeta, { childList: true, characterData: true, subtree: true });
  }
  window.parent.postMessage({ type: "tqa:preview-ready", token: "turbo-qa-preview-7.8.4" }, "*");
})();
</scr` + `ipt>`;

function buildPreviewDocument() {
  // The legacy source discusses literal </body> tags inside JavaScript
  // comments. Replacing the first match injects markup into that script and
  // breaks the srcdoc parser. Insert only before the document's final tag.
  // JSZip's bundled Promise fallback can select a MutationObserver from a
  // different srcdoc realm. Force its MessageChannel fallback instead.
  const observerProbe = "var r,n,e=t.MutationObserver||t.WebKitMutationObserver;if(e){";
  const compatibleSource = previewSource.replace(observerProbe, "var r,n,e=null;if(e){");
  const bodyEnd = compatibleSource.lastIndexOf("</body>");
  const embeddedStyle = '<style id="tqa-embedded-shell">#topBar,.theme-toggle{display:none!important}#controlPanel{top:0!important}</style>';
  return bodyEnd >= 0
    ? `${compatibleSource.slice(0, bodyEnd)}${embeddedStyle}${bridgeScript}${compatibleSource.slice(bodyEnd)}`
    : `${compatibleSource}${embeddedStyle}${bridgeScript}`;
}

async function readPackage(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, (cause, result) => cause ? reject(cause) : resolve(result));
  });
  const files = Object.entries(entries).filter(([name]) => !name.endsWith("/"));
  const exportEntry = files.find(([name]) => name.split("/").pop()?.toLowerCase() === "export.json");
  if (!exportEntry) throw new Error("No export.json found inside this ZIP.");
  const exportData = JSON.parse(strFromU8(exportEntry[1]));
  const assets: BridgeAsset[] = files.map(([name, data]) => ({
    name,
    compressedSize: data.byteLength,
    uncompressedSize: data.byteLength,
  }));
  const pick = (pattern: RegExp) => files.filter(([name]) => pattern.test(name.split("/").pop() || ""))
    .sort(([a], [b]) => a.length - b.length)[0]?.[1] || null;
  // Turbo exports use peel-<id>.png; older custom packages may only have teaserLogo.png.
  const teaserLogo = pick(/^teaserLogo\.png$/i) || pick(/^teaserLogo-\d+\.png$/i);
  const teaserBytes: TeaserBytes = {
    video: pick(/^video1\.mp4$/i),
    instreamVideo: pick(/^teaserVideo\.mp4$/i),
    poster: pick(/^video1\.jpe?g$/i),
    instreamPoster: pick(/^teaserVideo\.jpe?g$/i),
    logo: teaserLogo,
    peelLogo: pick(/^peelLogo(?:-\d+)?\.png$/i),
    peel: pick(/^peel-\d+\.png$/i),
  };
  return { exportData, assets, teaserBytes, packageFiles: files as PackageFile[] };
}

function teaserDisclaimerDocument(raw: string, size: string, files: PackageFile[], assetUrls: string[]) {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  doc.querySelectorAll("script, base").forEach(node => node.remove());
  const titleSource = doc.body.querySelector("#titleHtml, .title");
  const titleText = titleSource?.textContent?.trim() || "Important Safety Information and Prescribing Information";
  titleSource?.remove();
  const byPath = new Map(files.map(([name, data]) => [name.replace(/^.*?export\.json\/?/i, "").toLowerCase(), data]));
  for (const image of doc.body.querySelectorAll("img")) {
    const source = image.getAttribute("src") || "";
    image.removeAttribute("srcset");
    if (/^(?:data:|blob:)/i.test(source)) continue;
    const normalized = source.replace(/^\$LOC\$/i, "").replace(/^\/+/, "").toLowerCase();
    const basename = normalized.split("/").pop() || "";
    const exact = byPath.get(normalized) || byPath.get(normalized.replace(/^assets\//, ""));
    const matches = files.filter(([name]) => name.split("/").pop()?.toLowerCase() === basename);
    const bytes = exact || (matches.length === 1 ? matches[0][1] : null);
    if (!bytes) { image.remove(); continue; }
    const extension = basename.split(".").pop();
    const mime = extension === "svg" ? "image/svg+xml" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "gif" ? "image/gif" : "image/png";
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
    assetUrls.push(url);
    image.src = url;
  }
  const content = doc.createElement("div");
  content.className = "content";
  content.append(...Array.from(doc.body.childNodes));
  const title = doc.createElement("div");
  title.className = "title";
  title.textContent = titleText;
  const notice = doc.createElement("div");
  notice.className = `notice size_${size}`;
  notice.append(title, content);
  doc.body.className = "pVdxDesktopExpandable";
  doc.body.replaceChildren(notice);
  const override = doc.createElement("style");
  override.textContent = "html,body{margin:0!important;width:100%;height:100%;overflow:hidden;background:#fff;color:#231f20}body>.notice{position:absolute!important;inset:0!important;display:flex!important;flex-direction:column-reverse!important;width:100%!important;height:100%!important;box-sizing:border-box!important;background:#fff!important}.notice>.content{display:block!important;flex:1 1 auto!important;min-height:0!important;box-sizing:border-box!important;overflow-x:hidden!important;overflow-y:auto!important}.notice>.title{display:flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:center!important;width:100%!important;min-height:16px!important;box-sizing:border-box!important}img{max-width:100%}";
  doc.head.append(override);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}

function createTeaserPackageLayouts(exportData: Record<string, unknown>, files: PackageFile[]) {
  const urls: string[] = [];
  const layouts: TeaserPackageLayouts = {};
  const boundValue = (value: number | { _value?: number } | undefined) => Number(typeof value === "number" ? value : value?._value ?? 0);
  const layers = Array.isArray(exportData.rawLayers) ? exportData.rawLayers as ExportLayer[] : [];
  const disclaimerEntry = files.find(([name]) => /(^|\/)disclaimer\.html$/i.test(name));
  const disclaimer = disclaimerEntry ? strFromU8(disclaimerEntry[1]) : null;
  const fileByName = new Map(files.map(([name, data]) => [name.split("/").pop()?.toLowerCase() || "", data]));
  const candidates = layers.flatMap(layer => {
    const match = /^(ISI_)?preQual_(\d+x\d+)\.png$/i.exec(String(layer.name || ""));
    if (!match) return [];
    const bytes = fileByName.get(String(layer.name).toLowerCase());
    if (!bytes) return [];
    const width = boundValue(layer.bounds?.width);
    const height = boundValue(layer.bounds?.height);
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    urls.push(url);
    return [{ size: match[2].toLowerCase(), withIsi: Boolean(match[1]), width, height, url }];
  });
  for (const size of new Set(candidates.map(candidate => candidate.size))) {
    const [fullWidth, fullHeight] = size.split("x").map(Number);
    const plain = candidates.find(candidate => candidate.size === size && !candidate.withIsi);
    const withIsi = candidates.find(candidate => candidate.size === size && candidate.withIsi);
    const geometry = withIsi && disclaimer
      ? deriveTeaserGeometry(fullWidth, fullHeight, withIsi.width, withIsi.height)
      : deriveTeaserGeometry(fullWidth, fullHeight, fullWidth, fullHeight);
    const { creative, isi } = geometry;
    layouts[size] = {
      isi,
      creative,
      disclaimerSrcDoc: isi && disclaimer ? teaserDisclaimerDocument(disclaimer, size, files, urls) : null,
      prequal: plain?.url || null,
      prequalWithIsi: withIsi?.url || null,
    };
  }
  return { layouts, urls };
}

function createTeaserMedia(bytes: TeaserBytes): TeaserMedia {
  const url = (data: Uint8Array | null, type: string) => data ? URL.createObjectURL(new Blob([new Uint8Array(data)], { type })) : null;
  return {
    video: url(bytes.video, "video/mp4"),
    instreamVideo: url(bytes.instreamVideo, "video/mp4"),
    poster: url(bytes.poster, "image/jpeg"),
    instreamPoster: url(bytes.instreamPoster, "image/jpeg"),
    generatedFrame: null,
    logo: url(bytes.logo, "image/png"),
    peelLogo: url(bytes.peelLogo, "image/png"),
    peel: url(bytes.peel, "image/png"),
  };
}

async function loadPreviewFile(frame: HTMLIFrameElement | null, file: File) {
  if (!frame) return;
  // Construct the File and input event inside the preview's own realm.
  // Direct foreign-realm file/event assignment can silently miss its handler.
  const buffer = await file.arrayBuffer();
  frame.contentWindow?.postMessage({
    type: "tqa:load-package",
    token: BRIDGE_TOKEN,
    name: file.name,
    mimeType: file.type,
    buffer,
  }, "*", [buffer]);
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
  const captureBusyRef = useRef(false);
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const themeRef = useRef(theme);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [previewSizeCount, setPreviewSizeCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<PackageSummary | null>(null);
  const [teaserMedia, setTeaserMedia] = useState<TeaserMedia | null>(null);
  const teaserMediaRef = useRef<TeaserMedia | null>(null);
  const [teaserLayouts, setTeaserLayouts] = useState<TeaserPackageLayouts>({});
  const teaserLayoutUrlsRef = useRef<string[]>([]);
  const generationRequestRef = useRef("");
  const generationNeededRef = useRef(false);
  const pendingGeneratedFrameRef = useRef<{ requestId: string; dataUrl: string } | null>(null);
  const [teaserGenerationStatus, setTeaserGenerationStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [findingQuery, setFindingQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [activeTab, setActiveTab] = useState("overview");
  const srcDoc = useMemo(() => buildPreviewDocument(), []);

  useEffect(() => { summaryRef.current = summary; }, [summary]);

  useEffect(() => () => {
    if (teaserMediaRef.current) Object.values(teaserMediaRef.current).forEach(url => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); });
    teaserLayoutUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

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
          properties: { section: { type: "string", enum: ["overview", "findings", "assets", "teasers", "preview"] } },
          required: ["section"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          const section = (input as { section?: string })?.section;
          if (!summaryRef.current) throw new Error("Open a Turbo ZIP package first.");
          if (!section || !["overview", "findings", "assets", "teasers", "preview"].includes(section)) throw new Error("Unsupported QA section.");
          setActiveTab(section);
          return { section, creativeName: summaryRef.current.creativeName };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.data?.token !== BRIDGE_TOKEN) return;
      if (event.data.type === "tqa:capture-state") {
        captureBusyRef.current = Boolean(event.data.busy);
        setCaptureBusy(captureBusyRef.current);
        return;
      }
      if (event.data.type === "tqa:package-meta") {
        setPreviewSizeCount(Number.isFinite(event.data.sizeCount) ? event.data.sizeCount : null);
        const requestId = generationRequestRef.current;
        if (requestId) window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:capture-mobile-instream", token: BRIDGE_TOKEN, requestId }, "*"), 0);
        return;
      }
      if (event.data.type === "tqa:mobile-instream-frame") {
        const requestId = String(event.data.requestId || "");
        if (requestId !== generationRequestRef.current || typeof event.data.dataUrl !== "string") return;
        pendingGeneratedFrameRef.current = { requestId, dataUrl: event.data.dataUrl };
        if (generationNeededRef.current) {
          setTeaserMedia(current => {
            if (!current) return current;
            const next = { ...current, generatedFrame: event.data.dataUrl };
            teaserMediaRef.current = next;
            return next;
          });
          setTeaserGenerationStatus("ready");
        }
        return;
      }
      if (event.data.type === "tqa:mobile-instream-frame-error") {
        if (String(event.data.requestId || "") === generationRequestRef.current && generationNeededRef.current) setTeaserGenerationStatus("error");
        return;
      }
      if (event.data?.type === "tqa:preview-ready") {
        setPreviewTheme(iframeRef.current, themeRef.current);
        if (pendingFileRef.current) void loadPreviewFile(iframeRef.current, pendingFileRef.current);
      } else if (event.data?.type === "tqa:preview-error") {
        setError(event.data.message || "The package could not be opened in Preview.");
      }
    };
    window.addEventListener("message", listener);
    iframeRef.current?.contentWindow?.postMessage({ type: "tqa:ping", token: BRIDGE_TOKEN }, "*");
    return () => window.removeEventListener("message", listener);
  }, []);

  const openPackage = async (file?: File) => {
    if (!file) return;
    if (captureBusyRef.current || iframeRef.current?.contentDocument?.documentElement.dataset.captureBusy === "true") {
      setError("Finish or cancel screenshot capture before replacing the package.");
      return;
    }
    if (!/\.zip$/i.test(file.name)) { setError("Choose a ZIP export package."); setStatus("error"); return; }
    pendingFileRef.current = file;
    generationRequestRef.current = `${file.name}:${file.size}:${file.lastModified}`;
    generationNeededRef.current = false;
    pendingGeneratedFrameRef.current = null;
    setTeaserGenerationStatus("idle");
    setSummary(null); setPreviewSizeCount(null); setStatus("loading"); setError(""); setActiveTab("overview");
    void loadPreviewFile(iframeRef.current, file);
    try {
      const packageData = await readPackage(file);
      const analyzed = analyzePackage(packageData.exportData, packageData.assets, file.name);
      if (teaserMediaRef.current) Object.values(teaserMediaRef.current).forEach(url => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); });
      teaserLayoutUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      const nextMedia = createTeaserMedia(packageData.teaserBytes);
      const needsGeneration = analyzed.artboards.some(name => name.toLowerCase() === "mobile-instream") && !packageData.teaserBytes.instreamVideo;
      generationNeededRef.current = Boolean(needsGeneration && packageData.teaserBytes.video);
      const pendingFrame = pendingGeneratedFrameRef.current as { requestId: string; dataUrl: string } | null;
      if (generationNeededRef.current && pendingFrame?.requestId === generationRequestRef.current) nextMedia.generatedFrame = pendingFrame.dataUrl;
      const nextLayouts = createTeaserPackageLayouts(packageData.exportData, packageData.packageFiles);
      teaserMediaRef.current = nextMedia;
      teaserLayoutUrlsRef.current = nextLayouts.urls;
      setTeaserMedia(nextMedia);
      setTeaserGenerationStatus(!needsGeneration ? "idle" : !packageData.teaserBytes.video ? "error" : nextMedia.generatedFrame ? "ready" : "rendering");
      setTeaserLayouts(nextLayouts.layouts);
      setSummary(analyzed);
      setStatus("ready"); setError("");
    } catch (cause) {
      setStatus("error"); setError(cause instanceof Error ? cause.message : String(cause));
    }
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
    const report = { generatedAt: new Date().toISOString(), previewEngine: PREVIEW_VERSION, ...summary };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${summary.creativeName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "creative"}-qa-report.json`;
    link.click(); URL.revokeObjectURL(url);
  };

  const totalBytes = summary?.assets.reduce((sum, asset) => sum + asset.uncompressedSize, 0) || 0;
  const issueCount = summary ? count(summary.findings, "error") + count(summary.findings, "warning") : 0;
  const openScreenshots = () => {
    setActiveTab("preview");
    window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:open-screenshots", token: BRIDGE_TOKEN }, "*"), 0);
  };
  const openMainUnit = (size: string) => {
    setActiveTab("preview");
    window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:select-size", token: BRIDGE_TOKEN, size }, "*"), 0);
  };

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
                <DropdownMenuSeparator />
              </>}
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
            <div className="privacy-note"><ShieldCheck /> Processed locally in your browser. Nothing is uploaded.</div>
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
          </div><div className="scan-status"><CheckCircle2 /> Static analysis complete</div></div>

          {activeTab === "overview" && <div role="tabpanel" className="workspace-content">
            <section className="summary-hero"><div><span className="eyebrow">PACKAGE SUMMARY</span><h1>{summary.creativeName}</h1><p>{issueCount ? `${issueCount} issue${issueCount === 1 ? "" : "s"} need review before handoff.` : "No errors or warnings were found by the current rule set."}</p></div><Button variant="outline" onClick={() => setActiveTab("findings")}>Review findings <ChevronRight /></Button></section>
            <section className="stat-grid"><Stat label="Artboards" value={summary.artboards.length} detail={summary.artboards.join(" · ")} /><Stat label="Content states" value={`${summary.tabCount} / ${summary.slideCount}`} detail="Tabs / named slides" /><Stat label="Text layers" value={summary.textLayerCount} detail="Checked for typography risks" /><Stat label="Package assets" value={summary.assets.length} detail={`${formatBytes(totalBytes)} uncompressed`} /></section>
            <section className="severity-grid">{(["error", "warning", "info"] as Severity[]).map(level => <button key={level} className={`severity-card ${level}`} onClick={() => { setSeverity(level); setActiveTab("findings"); }}><span><SeverityIcon level={level} /></span><strong>{count(summary.findings, level)}</strong><div><b>{level === "info" ? "Notes" : `${level[0].toUpperCase()}${level.slice(1)}s`}</b><small>{level === "error" ? "Confirmed package defects" : level === "warning" ? "Needs designer review" : "Risks and limitations"}</small></div><ChevronRight /></button>)}</section>
            <section className="overview-grid"><article className="panel"><div className="panel-heading"><span className="eyebrow">COVERAGE</span><h2>Current analysis</h2></div><div className="coverage-list">{["Turbo structure and required artboards", "Asset references and package inventory", "Copy presence across artboards", "Tab-wide element presence", "CTA text mode and production rendering risks", "Shift+Enter soft-return production errors", "Spacing, defaults, superscript and kerning"].map(item => <div key={item}><CheckCircle2 /><span>{item}</span></div>)}</div></article><article className="panel next-panel"><span className="eyebrow">NEXT ANALYSIS LAYER</span><h2>Rendered geometry</h2><p>Cropped copy, hanging lines, alignment and screenshot batches will use the same state index after fonts and assets settle.</p><Badge variant="outline">Foundation ready</Badge></article></section>
          </div>}

          {activeTab === "findings" && <div role="tabpanel" className="workspace-content">
            <section className="page-title"><span className="eyebrow">CREATIVE ANALYSIS</span><h1>Findings</h1><p>Deterministic defects and review signals from the complete package structure.</p></section>
            <div className="toolbar"><label className="search-field"><Search /><input value={findingQuery} onChange={event => setFindingQuery(event.target.value)} placeholder="Search findings, layers, sizes…" /></label><div className="filter-group">{(["all", "error", "warning", "info"] as const).map(level => <button key={level} className={severity === level ? "active" : ""} onClick={() => setSeverity(level)}>{level === "all" ? "All" : level === "info" ? "Notes" : `${level[0].toUpperCase()}${level.slice(1)}s`}</button>)}</div></div>
            <div className="finding-list">{filteredFindings.length ? filteredFindings.map((finding, index) => <article key={`${finding.id}-${index}`} className={`finding-row ${finding.severity}`}><div className="finding-icon"><SeverityIcon level={finding.severity} /></div><div className="finding-copy"><div className="finding-title"><strong>{finding.title}</strong><code>{finding.ruleId}</code></div><p>{finding.message}</p>{(finding.artboard || finding.tab || finding.slide || finding.layerName) && <div className="finding-location">{[finding.artboard, finding.tab, finding.slide, finding.layerName].filter(Boolean).map((value, locationIndex) => <span key={`${value}-${locationIndex}`}>{value}</span>)}</div>}{finding.evidence && <small>{finding.evidence}</small>}</div><Badge variant="outline">{finding.confidence}</Badge></article>) : <div className="empty-results"><CheckCircle2 /><strong>No matching findings</strong><span>Adjust the search or severity filter.</span></div>}</div>
          </div>}

          {activeTab === "assets" && <div role="tabpanel" className="workspace-content">
            <section className="page-title"><span className="eyebrow">PACKAGE INVENTORY</span><h1>Assets</h1><p>Files, sizes, declared references, and potential package debris.</p></section>
            <div className="toolbar"><label className="search-field"><Search /><input value={assetQuery} onChange={event => setAssetQuery(event.target.value)} placeholder="Filter by filename, type, or status…" /></label></div>
            <div className="table-panel"><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead><TableHead>References</TableHead><TableHead className="text-right">Size</TableHead></TableRow></TableHeader><TableBody>{filteredAssets.map((asset, index) => <TableRow key={`${asset.name}-${index}`}><TableCell className="asset-name">{asset.name}</TableCell><TableCell>{asset.extension}</TableCell><TableCell><span className={`asset-status ${asset.status}`}>{asset.status}</span></TableCell><TableCell>{asset.referenceCount || "—"}</TableCell><TableCell className="text-right font-mono">{formatBytes(asset.uncompressedSize)}</TableCell></TableRow>)}</TableBody></Table></div>
          </div>}

          {activeTab === "teasers" && teaserMedia && <div role="tabpanel"><TeaserPreview artboards={summary.artboards} media={teaserMedia} layouts={teaserLayouts} generationStatus={teaserGenerationStatus} onOpen={openMainUnit} /></div>}
          {activeTab === "preview" && <div role="tabpanel" className="preview-content"><div className="preview-placeholder" /></div>}
        </div>
      ) : null}

      <iframe ref={iframeRef} title="Turbo package preview" srcDoc={srcDoc} onLoad={() => {
        if (pendingFileRef.current) void loadPreviewFile(iframeRef.current, pendingFileRef.current);
      }} className={summary && activeTab === "preview" ? "preview-frame" : "analysis-frame"} />
    </main>
  );
}
