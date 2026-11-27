import { strFromU8 } from "fflate";
import { deriveTeaserGeometry } from "@/lib/teaser-layout";
import type { PackageFile, TeaserBytes } from "@/types/package";
import type { TeaserMedia, TeaserPackageLayouts } from "./types";

type ExportLayer = {
  name?: unknown;
  bounds?: {
    width?: number | { _value?: number };
    height?: number | { _value?: number };
  };
};

export function createTeaserPackageLayouts(exportData: Record<string, unknown>, files: PackageFile[]) {
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
      disclaimerSrcDoc: isi && disclaimer
        ? createTeaserDisclaimerDocument(disclaimer, size, files, urls, disclaimerEntry?.[0] || "disclaimer.html")
        : null,
      prequal: plain?.url || null,
      prequalWithIsi: withIsi?.url || null,
    };
  }
  return { layouts, urls };
}

function createTeaserDisclaimerDocument(raw: string, size: string, files: PackageFile[], assetUrls: string[], disclaimerPath: string) {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  doc.querySelectorAll("script, base").forEach(node => node.remove());
  const titleSource = doc.body.querySelector("#titleHtml, .title");
  const titleText = titleSource?.textContent?.trim() || "Important Safety Information and Prescribing Information";
  titleSource?.remove();
  const byPath = new Map(files.map(([name, data]) => [name.replace(/^.*?export\.json\/?/i, "").toLowerCase(), data]));
  const disclaimerDirectory = disclaimerPath.replace(/[^/]*$/, "");
  const resolvePackageAsset = (source: string) => {
    const rawPath = source.replace(/^\$LOC\$/i, "").replace(/^\/+/, "");
    const resolvedPath = new URL(rawPath, `https://package.invalid/${disclaimerDirectory}`).pathname.slice(1).toLowerCase();
    const candidates = [resolvedPath, resolvedPath.replace(/^assets\//, ""), rawPath.toLowerCase()];
    for (const candidate of candidates) {
      const exact = byPath.get(candidate);
      if (exact) return exact;
    }
    const basename = resolvedPath.split("/").pop() || "";
    const matches = files.filter(([name]) => name.split("/").pop()?.toLowerCase() === basename);
    return matches.length === 1 ? matches[0][1] : null;
  };
  const packageUrl = (source: string) => {
    const bytes = resolvePackageAsset(source);
    if (!bytes) return null;
    const extension = source.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
    const mime = extension === "woff2" ? "font/woff2" : extension === "woff" ? "font/woff" : extension === "ttf" ? "font/ttf" : extension === "otf" ? "font/otf" : extension === "svg" ? "image/svg+xml" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "gif" ? "image/gif" : "image/png";
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
    assetUrls.push(url);
    return url;
  };
  for (const image of doc.body.querySelectorAll("img")) {
    const source = image.getAttribute("src") || "";
    image.removeAttribute("srcset");
    if (/^(?:data:|blob:)/i.test(source)) continue;
    const url = packageUrl(source);
    if (!url) { image.remove(); continue; }
    image.src = url;
  }
  for (const style of doc.head.querySelectorAll("style")) {
    style.textContent = style.textContent.replace(/url\((['\"]?)([^)'\"]+)\1\)/gi, (match, quote, rawSource) => {
      const source = String(rawSource).trim();
      if (/^(?:data:|blob:|https?:|\/\/|#)/i.test(source)) return match;
      const url = packageUrl(source);
      return url ? `url("${url}")` : match;
    });
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

export function createTeaserMedia(bytes: TeaserBytes): TeaserMedia {
  const url = (data: Uint8Array | null, type: string) => data ? URL.createObjectURL(new Blob([new Uint8Array(data)], { type })) : null;
  return {
    video: url(bytes.video, "video/mp4"),
    instreamVideo: url(bytes.instreamVideo, "video/mp4"),
    poster: url(bytes.poster, "image/jpeg"),
    instreamPoster: url(bytes.instreamPoster, "image/jpeg"),
    generatedFrame: null,
    generatedVideoTarget: null,
    logo: url(bytes.logo, "image/png"),
    peelLogo: url(bytes.peelLogo, "image/png"),
    peel: url(bytes.peel, "image/png"),
  };
}
