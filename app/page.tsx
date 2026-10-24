"use client";

import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { strFromU8, strToU8, unzip, zipSync } from "fflate";
import {
  AlertTriangle, Archive, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Play,
  Camera, Download, FileSearch, Files, ImageIcon, Info, LoaderCircle,
  Link2, MessageSquareWarning, Moon, MoreVertical, PackageOpen, Paperclip,
  Search, ShieldCheck, Sparkles, Sun, Upload,
} from "lucide-react";
import { currentPreview } from "../preview/current-preview";
import { TeaserPreview, type TeaserMedia, type TeaserPackageLayouts } from "@/components/teaser-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { analyzePackage, formatBytes, type Finding, type PackageSummary, type Severity } from "@/lib/qa-engine";
import { deriveTeaserGeometry } from "@/lib/teaser-layout";
import { buildMapPreviewConfig } from "@/lib/map-preview";

type BridgeAsset = { durationSeconds?: number; name: string; compressedSize: number; uncompressedSize: number };
type Theme = "dark" | "light";
type TeaserBytes = Record<Exclude<keyof TeaserMedia, "generatedFrame" | "generatedVideoTarget">, Uint8Array | null>;
type PackageFile = readonly [string, Uint8Array];
const MAPBOX_ACCESS_TOKEN = import.meta.env.DEV ? import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "" : "";
type ExportLayer = { name?: unknown; bounds?: { width?: number | { _value?: number }; height?: number | { _value?: number } } };
type CtvOttFormat = "ctv" | "ott";
type CtvOttVideos = Partial<Record<CtvOttFormat, string>>;
type CtvOttArtboardLayer = { layerID?: number; name?: unknown; visible?: boolean };
type CtvOttExportData = Record<string, unknown> & { document?: { artboards?: unknown } };
type FeedbackType = "visual-mismatch" | "finding-issue" | "asset-validation" | "package-loading" | "preview-interaction" | "screenshot-export" | "app-ui" | "suggestion" | "other";
type FeedbackImageContext = "description" | "actual" | "expected";
type FeedbackInlineImage = { id: string; context: FeedbackImageContext; file: File; previewUrl: string };
type ProductionReference = { type: "ccrv" | "showcase"; url: string; creativeId: string; variant: string | null };
type FeedbackCapture = {
  dataUrl: string;
  state: {
    artboard: string;
    selectedSizes: string[];
    tab: string | null;
    slide: string | null;
    viewMode: "preview" | "compare";
    scale: string | null;
    theme: string | null;
  };
};
const PREVIEW_VERSION = currentPreview.version;
const previewSource = currentPreview.source;
const BRIDGE_TOKEN = `turbo-qa-preview-${PREVIEW_VERSION}`;
const THEME_STORAGE_KEY = "turbo-qa-studio-theme";

function parseProductionReference(raw: string): ProductionReference | null {
  try {
    const url = new URL(raw.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const hashParts = url.hash.slice(1).split("/").filter(Boolean);
    if (url.protocol !== "https:" || hostname !== "showcase.vdx.tv" || !hashParts[0]) return null;
    const type = /^\/cc(?:\/|$)/i.test(url.pathname) ? "ccrv" : "showcase";
    if (type === "showcase" && url.pathname === "/") return null;
    return {
      type,
      url: url.href,
      creativeId: hashParts[0],
      variant: hashParts[1] || null,
    };
  } catch {
    return null;
  }
}

function safeFilePart(value: string, fallback: string) {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 100) || fallback;
}

function dataUrlToBytes(dataUrl: string) {
  const encoded = dataUrl.split(",", 2)[1];
  if (!encoded) throw new Error("The preview screenshot was empty.");
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function captureFeedbackPreview(frame: HTMLIFrameElement | null): Promise<FeedbackCapture> {
  return new Promise((resolve, reject) => {
    if (!frame?.contentWindow) { reject(new Error("The active preview is unavailable.")); return; }
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(new Error("The active preview did not finish capturing."));
    }, 15000);
    function receive(event: MessageEvent) {
      if (event.data?.token !== BRIDGE_TOKEN || event.data?.requestId !== requestId) return;
      if (event.data.type !== "tqa:feedback-capture" && event.data.type !== "tqa:feedback-capture-error") return;
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
      if (event.data.type === "tqa:feedback-capture-error") {
        reject(new Error(event.data.message || "The active preview could not be captured."));
        return;
      }
      resolve({ dataUrl: event.data.dataUrl, state: event.data.state } as FeedbackCapture);
    }
    window.addEventListener("message", receive);
    frame.contentWindow.postMessage({ type: "tqa:capture-feedback", token: BRIDGE_TOKEN, requestId }, "*");
  });
}

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

const bridgeScript = (String.raw`
<script>
(() => {
  document.documentElement.dataset.tqaBridge = "ready";
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  let mapConfig = null;
  let leafletLoadPromise = null;
  const mapPaints = new Map();
  const mapInstances = new WeakMap();
  function loadLeaflet() {
    if (window.L && window.L.mapbox) return Promise.resolve(window.L);
    if (leafletLoadPromise) return leafletLoadPromise;
    leafletLoadPromise = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-tqa-leaflet-css]')) {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://api.mapbox.com/mapbox.js/v3.3.1/mapbox.css';
        css.dataset.tqaLeafletCss = 'true';
        document.head.appendChild(css);
      }
      if (!document.querySelector('style[data-tqa-mapbox-popup]')) {
        const popupStyle = document.createElement('style');
        popupStyle.dataset.tqaMapboxPopup = 'true';
        popupStyle.textContent = '.leaflet-container { font:12px/20px "Helvetica Neue",Arial,Helvetica,sans-serif; }' +
          '.leaflet-pane.leaflet-popup-pane { z-index:800 !important; } .leaflet-pane.leaflet-marker-pane { z-index:600 !important; }' +
          '.leaflet-popup { margin-bottom:0; } .leaflet-popup-content-wrapper { position:relative; overflow:visible !important; border-radius:8px 8px 8px 0; background:#fff; padding:1px; box-shadow:none; }' +
          '.leaflet-popup-content { box-sizing:border-box; width:251px !important; margin:0; padding:10px 10px 15px; color:#252525; font:12px/20px "Helvetica Neue",Arial,Helvetica,sans-serif; }' +
          '.leaflet-popup-tip-container { display:none; } .leaflet-popup-content-wrapper::after { content:""; position:absolute; z-index:2; left:0; bottom:-10px; width:0; height:0; border-top:10px solid #fff; border-right:20px solid transparent; pointer-events:none; }' +
          '.leaflet-popup-close-button { z-index:3; width:20px !important; height:20px !important; padding:0 !important; color:#33415b !important; font:18px/20px Arial,sans-serif !important; }' +
          '.leaflet-popup-content a, .leaflet-marker-icon { cursor:pointer; } .tqa-leaflet-marker { background:transparent; border:0; }' +
          '.tqa-map-fallback-pin { display:block; width:18px; height:18px; border-radius:50% 50% 50% 0; background:#d8323b; border:2px solid #fff; box-shadow:0 1px 4px #0006; transform:translateY(-2px) rotate(-45deg); }';
        document.head.appendChild(popupStyle);
      }
      const script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox.js/v3.3.1/mapbox.js';
      script.async = true;
      script.onload = () => window.L && window.L.mapbox ? resolve(window.L) : reject(new Error('Leaflet Mapbox did not initialize.'));
      script.onerror = () => reject(new Error('Leaflet Mapbox could not be loaded. Check your internet connection.'));
      document.head.appendChild(script);
    });
    return leafletLoadPromise;
  }
  function showMapFallback(container, message) {
    container.replaceChildren();
    container.style.display = 'grid';
    container.style.placeItems = 'center';
    container.style.background = '#eef1f4';
    container.style.color = '#364152';
    container.style.padding = '12px';
    container.style.boxSizing = 'border-box';
    container.style.font = '12px/1.4 Arial, sans-serif';
    container.style.textAlign = 'center';
    container.textContent = message;
  }
  function showMapStateImage(container, source) {
    if (!source) return null;
    const image = document.createElement('img');
    image.src = source;
    image.alt = '';
    image.dataset.tqaMapState = 'true';
    image.style.cssText = 'position:absolute;z-index:20;left:50%;top:50%;transform:translate(-50%,-50%);max-width:100%;max-height:100%;object-fit:contain;pointer-events:none';
    container.appendChild(image);
    return image;
  }
  function clearMapOverlays(stage) {
    if (!stage) return;
    stage.querySelectorAll('[data-tqa-map-layer]').forEach(node => {
      const map = mapInstances.get(node);
      if (map) map.remove();
      node.remove();
    });
  }
  function addStorePopup(store, component) {
    const content = document.createElement('div');
    content.style.cssText = 'box-sizing:border-box;width:231px;min-height:86px;padding:0;color:#252525;text-align:center;font:12px/20px "Helvetica Neue",Arial,Helvetica,sans-serif';
    const title = document.createElement('strong');
    title.textContent = store.label || 'Store';
    title.style.cssText = 'display:block;margin:0;font-size:12px;font-weight:400';
    content.appendChild(title);
    const address = document.createElement('div');
    address.textContent = [store.address, [store.city, store.state, store.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    address.style.cssText = 'color:#252525;font-size:12px;line-height:20px';
    content.appendChild(address);
    if (store.phone) {
      const phone = document.createElement('div');
      phone.textContent = store.phone;
      content.appendChild(phone);
    }
    try {
      const cta = new URL(store.cta || '');
      if (cta.protocol === 'https:') {
        const link = document.createElement('a');
        link.href = cta.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.cssText = 'display:inline-block;margin-top:5px;line-height:0;cursor:pointer';
        const buttonImage = mapConfig.buttonImages?.[String(component.rootLayerId)];
        if (buttonImage) {
          const image = document.createElement('img');
          image.src = buttonImage; image.alt = 'Learn more'; image.style.cssText = 'display:block;width:100px;height:auto';
          link.appendChild(image);
        } else {
          link.textContent = 'LEARN MORE';
          link.style.cssText += ';padding:6px 17px;background:#f2cf37;color:#191919;font-size:11px;font-weight:700';
        }
        content.appendChild(link);
      }
    } catch { /* Ignore malformed campaign links. */ }
    return content;
  }
  function renderMapOverlays(entry, activeTab, activeSlide) {
    if (!mapConfig || !entry?.stageEl || !entry?.byId || !entry?.childrenOf) return;
    const stage = entry.stageEl;
    if (!stage.isConnected) return;
    clearMapOverlays(stage);
    for (const component of mapConfig.components || []) {
      const root = entry.byId.get(component.rootLayerId);
      const target = entry.byId.get(component.defaultLayerId);
      const frameTarget = component.frameLayerId == null ? null : entry.byId.get(component.frameLayerId);
      if (!root || !target) continue;
      const defaultElement = stage.querySelector('[data-structure-layer-id="' + component.defaultLayerId + '"]');
      if (!defaultElement) continue;
      const frameElement = component.frameLayerId == null ? null : stage.querySelector('[data-structure-layer-id="' + component.frameLayerId + '"]');
      const geometryElement = frameElement || defaultElement;
      const geometryTarget = frameTarget || target;
      const parent = defaultElement.parentElement;
      if (!parent) continue;
      const mapElement = document.createElement('div');
      mapElement.dataset.tqaMapLayer = String(component.rootLayerId);
      mapElement.setAttribute('aria-label', 'Interactive store map');
      mapElement.style.position = 'absolute';
      for (const property of ['left', 'top', 'right', 'bottom', 'width', 'height', 'transform', 'transformOrigin', 'clipPath', 'borderRadius']) {
        if (geometryElement.style[property]) mapElement.style[property] = geometryElement.style[property];
      }
      mapElement.style.zIndex = defaultElement.style.zIndex || String(target.itemIndex || 0);
      mapElement.style.pointerEvents = 'auto';
      mapElement.style.overflow = 'visible';
      parent.appendChild(mapElement);
      defaultElement.style.display = 'none';
      if (frameElement) frameElement.style.display = 'none';
      for (const layerId of [component.pinLayerId, component.loadingLayerId, component.noDataLayerId, component.popupLayerId, component.buttonLayerId, component.logoLayerId, component.dataMarkerLayerId]) {
        if (layerId == null) continue;
        const layerElement = stage.querySelector('[data-structure-layer-id="' + layerId + '"]');
        if (layerElement) layerElement.style.display = 'none';
      }
      if (!mapConfig.accessToken) {
        showMapFallback(mapElement, 'Map preview needs a Mapbox public token. Add VITE_MAPBOX_ACCESS_TOKEN to your local .env.local file.');
        showMapStateImage(mapElement, mapConfig.defaultImages?.[String(component.rootLayerId)]);
        continue;
      }
      const loadingImageSource = mapConfig.loadingImages?.[String(component.rootLayerId)];
      loadLeaflet().then(L => {
        if (!mapElement.isConnected) return;
        L.mapbox.accessToken = mapConfig.accessToken;
        const points = (mapConfig.stores || []).filter(store => Number.isFinite(store.lat) && Number.isFinite(store.long));
        if (!points.length) {
          showMapStateImage(mapElement, mapConfig.noDataImages?.[String(component.rootLayerId)] || mapConfig.defaultImages?.[String(component.rootLayerId)]);
          return;
        }
        const first = points[0];
        const map = L.map(mapElement, {
          zoomControl: mapConfig.settings?.zoomControl === true,
          attributionControl: mapConfig.settings?.attributionControl === true,
          minZoom: mapConfig.settings?.minZoom ?? 2, maxZoom: mapConfig.settings?.maxZoom ?? 19,
          tap: mapConfig.settings?.twoFingersEnabled !== false,
        }).setView([first.lat, first.long], mapConfig.settings?.zoomLevel ?? 12);
        // Leaflet projects a 256px world; 512px tiles need one lower URL zoom
        // so their geographic bounds match the markers (map zoom 12 => tile z11).
        const tileLayer = L.tileLayer(mapConfig.tileUrl, { tileSize: 512, zoomOffset: -1, maxZoom: mapConfig.settings?.maxZoom ?? 19, attribution: '© Mapbox © OpenStreetMap' });
        let tilesLoaded = false;
        tileLayer.once('load', () => {
          tilesLoaded = true;
          if (loadingImage?.isConnected) loadingImage.remove();
        });
        tileLayer.addTo(map);
        const logoControl = L.control({ position: 'bottomleft' });
        logoControl.onAdd = () => {
          const logo = L.DomUtil.create('div', 'mapbox-logo leaflet-control mapbox-logo-true');
          logo.setAttribute('aria-label', 'Mapbox');
          return logo;
        };
        logoControl.addTo(map);
        const loadingImage = showMapStateImage(mapElement, loadingImageSource);
        mapInstances.set(mapElement, map);
        map.whenReady(() => {
          points.forEach((store, index) => {
            const pinImage = mapConfig.pinImages?.[String(component.pinLayerId)];
            const iconWidth = Math.max(14, 22 * (entry.scale || 1));
            const iconHeight = Math.max(20, 33 * (entry.scale || 1));
            const iconOptions = { iconSize: [iconWidth, iconHeight], iconAnchor: [iconWidth / 2, iconHeight - 2], popupAnchor: [Math.round((mapConfig.settings?.popupWidth ?? 253) / 2), 2 - iconHeight - 10], className: 'tqa-leaflet-marker' };
            const icon = pinImage
              ? L.icon({ ...iconOptions, iconUrl: pinImage })
              : L.divIcon({ ...iconOptions, html: '<span class="tqa-map-fallback-pin"></span>' });
            const storeMarker = L.marker([store.lat, store.long], { icon }).addTo(map);
            storeMarker.bindPopup(addStorePopup(store, component), { maxWidth: mapConfig.settings?.popupWidth ?? 253, offset: [0, 0], closeButton: mapConfig.settings?.showCloseBtn !== false, autoClose: true, closeOnClick: false });
            if (index === 0 && mapConfig.settings?.openPopByDefault !== false) storeMarker.openPopup();
          });
          map.invalidateSize();
        });
        tileLayer.on('tileerror', () => {
          window.setTimeout(() => {
            if (!tilesLoaded && mapElement.isConnected && !mapElement.querySelector('.leaflet-tile-loaded')) {
              showMapFallback(mapElement, 'Mapbox could not load this map. Check the token and its localhost URL restrictions.');
            }
          }, 1500);
        });
      }).catch(error => { if (mapElement.isConnected) showMapFallback(mapElement, error?.message || 'Leaflet Mapbox could not be loaded.'); });
    }
  }
  const previewApi = window.CSM_PREVIEW;
  if (previewApi && typeof previewApi.paintArtboard === 'function') {
    const paintArtboard = previewApi.paintArtboard;
    previewApi.paintArtboard = function(entry, activeTab, activeSlide) {
      clearMapOverlays(entry?.stageEl);
      const result = paintArtboard.call(this, entry, activeTab, activeSlide);
      mapPaints.set(entry.stageEl, { entry, activeTab, activeSlide });
      mapPaints.forEach((paint, stage) => { if (!stage.isConnected) mapPaints.delete(stage); });
      requestAnimationFrame(() => renderMapOverlays(entry, activeTab, activeSlide));
      return result;
    };
  }
  window.addEventListener("message", async (event) => {
    if (!event.data || event.data.token !== "__TQA_BRIDGE_TOKEN__") return;
    if (event.data.type === "tqa:map-config") {
      mapConfig = event.data.config || null;
      if (mapConfig) {
        loadLeaflet().then(() => mapPaints.forEach(paint => renderMapOverlays(paint.entry, paint.activeTab, paint.activeSlide))).catch(() => {
          mapPaints.forEach(paint => renderMapOverlays(paint.entry, paint.activeTab, paint.activeSlide));
        });
      }
      return;
    }
    if (event.data.type === "tqa:ping") {
      window.parent.postMessage({ type: "tqa:preview-ready", token: "__TQA_BRIDGE_TOKEN__" }, "*");
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
    if (event.data.type === "tqa:focus-finding") {
      if (event.data.finding && typeof window.openQaFinding === "function") window.openQaFinding(event.data.finding);
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
      const selectedSize = Array.from(document.querySelectorAll("#sizePicker .chip"))
        .find(node => node.querySelector("input")?.checked)
        ?.textContent.trim().toLowerCase() || "";
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
        // Main Unit presents this authored 970x546 stage at 50% through a CSS
        // transform. Capturing that transform would bake the half-size preview
        // into the generated frame, then Teasers would scale it a second time.
        // Capture the authored stage at full size and let Teasers own the only
        // presentation-scale transform.
        const previousTransform = stage.style.transform;
        stage.style.transform = "none";
        await nextFrame();
        const stageRect = stage.getBoundingClientRect();
        const videoLayer = Array.from(stage.querySelectorAll(".cp-video")).find(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
        const videoRect = videoLayer?.getBoundingClientRect();
        const videoTarget = videoRect ? {
          left: videoRect.left - stageRect.left,
          top: videoRect.top - stageRect.top,
          width: videoRect.width,
          height: videoRect.height,
        } : null;
        let source;
        try {
          source = await window.htmlToImage.toCanvas(stage, { pixelRatio: 1, skipAutoScale: true, width: stage.offsetWidth, height: stage.offsetHeight });
        } finally {
          stage.style.transform = previousTransform;
        }
        const output = document.createElement("canvas");
        output.width = 970; output.height = 546;
        output.getContext("2d").drawImage(source, 0, 0, output.width, output.height);
        window.parent.postMessage({ type: "tqa:mobile-instream-frame", token: "__TQA_BRIDGE_TOKEN__", requestId, dataUrl: output.toDataURL("image/jpeg", .86), videoTarget }, "*");
      } catch (error) {
        window.parent.postMessage({ type: "tqa:mobile-instream-frame-error", token: "__TQA_BRIDGE_TOKEN__", requestId, message: error && error.message ? error.message : String(error) }, "*");
      } finally {
        // Teaser generation temporarily selects mobile-instream because the
        // renderer captures the live artboard. Restore the user's visible
        // size so background generation cannot change Main Unit selection.
        if (selectedSize && selectedSize !== "mobile-instream") {
          const restore = Array.from(document.querySelectorAll("#sizePicker .chip"))
            .find(node => node.textContent.trim().toLowerCase() === selectedSize);
          const input = restore?.querySelector("input");
          if (input && !input.checked) input.click();
        }
      }
      return;
    }
    if (event.data.type === "tqa:capture-feedback") {
      const requestId = String(event.data.requestId || "");
      try {
        const selectedSizes = Array.from(document.querySelectorAll('#sizePicker .chip'))
          .filter(node => node.querySelector('input')?.checked)
          .map(node => node.textContent.trim());
        const cards = Array.from(document.querySelectorAll('.cp-artboard-card'));
        const selectedName = selectedSizes[0]?.toLowerCase() || "";
        const card = cards.find(node => node.querySelector('.cp-artboard-label')?.textContent.trim().toLowerCase().startsWith(selectedName)) || cards[0];
        const stage = card?.querySelector('.cp-stage');
        if (!stage || !window.htmlToImage) throw new Error("No rendered artboard is available to capture.");
        await nextFrame(); await nextFrame();
        const source = await window.htmlToImage.toCanvas(stage, {
          pixelRatio: 1,
          skipAutoScale: true,
          width: stage.offsetWidth,
          height: stage.offsetHeight,
        });
        const activeText = selector => document.querySelector(selector)?.textContent?.trim() || null;
        const label = card.querySelector('.cp-artboard-label');
        const scale = label?.querySelector('.seg-btn.active')?.textContent?.trim() || null;
        window.parent.postMessage({
          type: "tqa:feedback-capture",
          token: "__TQA_BRIDGE_TOKEN__",
          requestId,
          dataUrl: source.toDataURL("image/png"),
          state: {
            artboard: selectedSizes[0] || label?.firstChild?.textContent?.trim() || "unknown",
            selectedSizes,
            tab: activeText('#tabButtons .active'),
            slide: activeText('#slideButtons .active'),
            viewMode: document.getElementById('previewModeBtn')?.classList.contains('active') ? "preview" : "compare",
            scale,
            theme: document.documentElement.dataset.theme || null,
          },
        }, "*");
      } catch (error) {
        window.parent.postMessage({ type: "tqa:feedback-capture-error", token: "__TQA_BRIDGE_TOKEN__", requestId, message: error && error.message ? error.message : String(error) }, "*");
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
      window.parent.postMessage({ type: "tqa:preview-error", token: "__TQA_BRIDGE_TOKEN__", message: error && error.message ? error.message : String(error) }, "*");
    }
  });
  window.addEventListener("csm:capture-state", (event) => {
  window.parent.postMessage({ type: "tqa:capture-state", token: "__TQA_BRIDGE_TOKEN__", busy: Boolean(event.detail && event.detail.busy) }, "*");
  });
  const packageMeta = document.getElementById("pkgMeta");
  if (packageMeta && typeof MutationObserver !== "undefined") {
    new MutationObserver(() => {
      const sizeCount = Number.parseInt(packageMeta.textContent || "", 10);
      if (Number.isFinite(sizeCount)) window.parent.postMessage({ type: "tqa:package-meta", token: "__TQA_BRIDGE_TOKEN__", sizeCount }, "*");
    }).observe(packageMeta, { childList: true, characterData: true, subtree: true });
  }
  window.parent.postMessage({ type: "tqa:preview-ready", token: "__TQA_BRIDGE_TOKEN__" }, "*");
})();
</scr` + `ipt>`).replaceAll("__TQA_BRIDGE_TOKEN__", BRIDGE_TOKEN);

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

async function readVideoDuration(data: Uint8Array): Promise<number | undefined> {
  return new Promise(resolve => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: "video/mp4" }));
    const finish = (value?: number) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(), 8000);
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined);
    video.onerror = () => finish();
    video.src = url;
  });
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
  await Promise.all(assets.filter(asset => /\.(?:mp4|webm|mov|m4v)$/i.test(asset.name)).map(async asset => {
    const data = files.find(([name]) => name === asset.name)?.[1];
    if (data) asset.durationSeconds = await readVideoDuration(data);
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
  const mapPreviewConfig = import.meta.env.DEV
    ? buildMapPreviewConfig(exportData.rawLayers, files as PackageFile[], MAPBOX_ACCESS_TOKEN)
    : null;
  return { exportData, assets, teaserBytes, packageFiles: files as PackageFile[], mapPreviewConfig };
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
    generatedVideoTarget: null,
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

function SpacingHighlight({ finding }: { finding: Finding }) {
  if (!finding.highlight) return <p>{finding.message}</p>;
  return <p className="finding-highlight-copy"><span className="finding-highlight-label">Affected copy</span><span>{finding.highlight.prefix}</span><mark>{finding.highlight.value}</mark><span>{finding.highlight.suffix}</span></p>;
}

function count(findings: Finding[], level: Severity) {
  return findings.filter(finding => finding.severity === level).length;
}

function findingContextLabel(value: string) {
  return value
    .replace(/^tab(?:component)?[-_ ]?(\d+)$/i, "Tab $1")
    .replace(/^slide[-_ ]?(\d+)$/i, "Slide $1");
}

function detectCtvOttFormats(exportData: CtvOttExportData): CtvOttFormat[] {
  const layers = Array.isArray(exportData.rawLayers) ? exportData.rawLayers as CtvOttArtboardLayer[] : [];
  const byId = new Map(layers.map(layer => [layer.layerID, layer]));
  const names: string[] = (Array.isArray(exportData.document?.artboards) ? exportData.document.artboards : [])
    .map((id: unknown) => byId.get(Number(id)))
    .filter((layer: CtvOttArtboardLayer | undefined): layer is CtvOttArtboardLayer => layer != null && layer.visible !== false)
    .map((layer: CtvOttArtboardLayer) => String(layer.name || "").trim());
  return [...new Set<CtvOttFormat>(names
    .filter(name => /^(ctv|ott|ctvott)(?:_|$)/i.test(name))
    .map(name => /^ctv/i.test(name) ? "ctv" : "ott") as CtvOttFormat[])];
}

function ctvOttViewLabel(formats: CtvOttFormat[]) {
  return formats.length === 2 ? "View CTV/OTT" : `View ${formats[0]?.toUpperCase() || "CTV/OTT"}`;
}

function Stat({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <article className="stat-card reg-card"><span className="reg-corner tl" /><span className="reg-corner br" /><p>{label}</p><strong>{value}</strong><span>{detail}</span></article>;
}

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFileRef = useRef<File | null>(null);
  const mapPreviewConfigRef = useRef<ReturnType<typeof buildMapPreviewConfig>>(null);
  const summaryRef = useRef<PackageSummary | null>(null);
  const captureBusyRef = useRef(false);
  const [theme, setTheme] = useState<Theme>(savedTheme);
  const themeRef = useRef(theme);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [previewSizeCount, setPreviewSizeCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<PackageSummary | null>(null);
  const [sourcePackage, setSourcePackage] = useState<File | null>(null);
  const [teaserMedia, setTeaserMedia] = useState<TeaserMedia | null>(null);
  const teaserMediaRef = useRef<TeaserMedia | null>(null);
  const [teaserLayouts, setTeaserLayouts] = useState<TeaserPackageLayouts>({});
  const teaserLayoutUrlsRef = useRef<string[]>([]);
  const generationRequestRef = useRef("");
  const generationNeededRef = useRef(false);
  const targetRefreshRequestRef = useRef("");
  const pendingGeneratedFrameRef = useRef<{ requestId: string; dataUrl: string; videoTarget: TeaserMedia["generatedVideoTarget"] } | null>(null);
  const [teaserGenerationStatus, setTeaserGenerationStatus] = useState<"idle" | "rendering" | "ready" | "error">("idle");
  const [ctvOttFormats, setCtvOttFormats] = useState<CtvOttFormat[]>([]);
  const [ctvOttVideos, setCtvOttVideos] = useState<CtvOttVideos>({});
  const [ctvOttStatus, setCtvOttStatus] = useState<"idle" | "rendering" | "ready" | "error" | "missing">("idle");
  const [ctvOttError, setCtvOttError] = useState("");
  const ctvOttObjectUrlsRef = useRef<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [findingQuery, setFindingQuery] = useState("");
  const [assetQuery, setAssetQuery] = useState("");
  const [assetScope, setAssetScope] = useState("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [findingCategory, setFindingCategory] = useState("all");
  const [findingTab, setFindingTab] = useState("all");
  const [findingSize, setFindingSize] = useState("all");
  const [activeTab, setActiveTab] = useState("overview");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("visual-mismatch");
  const [feedbackReferenceUrl, setFeedbackReferenceUrl] = useState("");
  const [feedbackSummary, setFeedbackSummary] = useState("");
  const [feedbackActual, setFeedbackActual] = useState("");
  const [feedbackExpected, setFeedbackExpected] = useState("");
  const [feedbackSteps, setFeedbackSteps] = useState("");
  const [feedbackIncludeScreenshot, setFeedbackIncludeScreenshot] = useState(true);
  const [feedbackIncludePackage, setFeedbackIncludePackage] = useState(true);
  const [feedbackAttachments, setFeedbackAttachments] = useState<File[]>([]);
  const [feedbackInlineImages, setFeedbackInlineImages] = useState<FeedbackInlineImage[]>([]);
  const feedbackInlineImagesRef = useRef<FeedbackInlineImage[]>([]);
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");
  const [feedbackPreparing, setFeedbackPreparing] = useState(false);
  const srcDoc = useMemo(() => buildPreviewDocument(), []);
  const productionReference = useMemo(() => parseProductionReference(feedbackReferenceUrl), [feedbackReferenceUrl]);
  const showComparisonFields = feedbackType === "visual-mismatch";
  const requiresProductionReference = feedbackType === "visual-mismatch";
  const hasProductionReferenceInput = feedbackReferenceUrl.trim().length > 0;
  const productionReferenceInvalid = hasProductionReferenceInput && !productionReference;
  const canCreateFeedbackBundle = !feedbackPreparing && !feedbackSuccess && !productionReferenceInvalid && (!requiresProductionReference || Boolean(productionReference));

  useEffect(() => { summaryRef.current = summary; }, [summary]);
  useEffect(() => { feedbackInlineImagesRef.current = feedbackInlineImages; }, [feedbackInlineImages]);

  useEffect(() => () => {
    if (teaserMediaRef.current) Object.values(teaserMediaRef.current).forEach(url => { if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url); });
    teaserLayoutUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    ctvOttObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    feedbackInlineImagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl));
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

  const clearCtvOttVideos = () => {
    ctvOttObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    ctvOttObjectUrlsRef.current = [];
    setCtvOttVideos({});
  };

  const renderCtvOttPackage = async (file: File, formats: CtvOttFormat[], requestId: string) => {
    clearCtvOttVideos();
    setCtvOttFormats(formats);
    setCtvOttError("");
    if (!formats.length) {
      setCtvOttStatus("missing");
      setCtvOttError("No supported CTV/OTT artboard was found in this package.");
      return;
    }
    setCtvOttStatus("rendering");
    try {
      const rendererBase = "/api/ctv-ott";
      const health = await fetch(`${rendererBase}/health`, { cache: "no-store" });
      if (!health.ok) throw new Error("The local FFmpeg renderer is unavailable.");
      const rendered = await Promise.all(formats.map(async format => {
        const response = await fetch(`${rendererBase}/render?format=${format}`, {
          method: "POST",
          headers: { "Content-Type": "application/zip", "X-Package-Name": file.name },
          body: file,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(`${format.toUpperCase()} render failed: ${body.error || "the package did not contain the required CTV/OTT assets."}`);
        }
        return [format, URL.createObjectURL(await response.blob())] as const;
      }));
      if (requestId !== generationRequestRef.current) {
        rendered.forEach(([, url]) => URL.revokeObjectURL(url));
        return;
      }
      const nextVideos = Object.fromEntries(rendered) as CtvOttVideos;
      ctvOttObjectUrlsRef.current = Object.values(nextVideos).filter((url): url is string => Boolean(url));
      setCtvOttVideos(nextVideos);
      setCtvOttStatus("ready");
    } catch (cause) {
      if (requestId !== generationRequestRef.current) return;
      setCtvOttStatus("error");
      const message = cause instanceof TypeError || /NetworkError|Failed to fetch/i.test(String(cause))
        ? "The local FFmpeg renderer is unavailable. Start QA Studio with npm run dev, then reopen the package."
        : cause instanceof Error ? cause.message : String(cause);
      setCtvOttError(message);
    }
  };

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
        const videoTarget = event.data.videoTarget && ["left", "top", "width", "height"].every(key => Number.isFinite(event.data.videoTarget[key]))
          ? event.data.videoTarget as TeaserMedia["generatedVideoTarget"]
          : null;
        pendingGeneratedFrameRef.current = { requestId, dataUrl: event.data.dataUrl, videoTarget };
        if (generationNeededRef.current) {
          setTeaserMedia(current => {
            if (!current) return current;
            const next = { ...current, generatedFrame: event.data.dataUrl, generatedVideoTarget: videoTarget };
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
        iframeRef.current?.contentWindow?.postMessage({
          type: "tqa:map-config",
          token: BRIDGE_TOKEN,
          config: mapPreviewConfigRef.current,
        }, "*");
        if (pendingFileRef.current) void loadPreviewFile(iframeRef.current, pendingFileRef.current);
      } else if (event.data?.type === "tqa:preview-error") {
        setError(event.data.message || "The package could not be opened in Preview.");
      }
    };
    window.addEventListener("message", listener);
    iframeRef.current?.contentWindow?.postMessage({ type: "tqa:ping", token: BRIDGE_TOKEN }, "*");
    return () => window.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    const requestId = generationRequestRef.current;
    if (!sourcePackage || !generationNeededRef.current || !teaserMedia?.generatedFrame || teaserMedia.generatedVideoTarget || targetRefreshRequestRef.current === requestId) return;
    targetRefreshRequestRef.current = requestId;
    iframeRef.current?.contentWindow?.postMessage({ type: "tqa:capture-mobile-instream", token: BRIDGE_TOKEN, requestId }, "*");
  }, [sourcePackage, teaserMedia?.generatedFrame, teaserMedia?.generatedVideoTarget]);

  const openPackage = async (file?: File) => {
    if (!file) return;
    if (captureBusyRef.current || iframeRef.current?.contentDocument?.documentElement.dataset.captureBusy === "true") {
      setError("Finish or cancel screenshot capture before replacing the package.");
      return;
    }
    if (!/\.zip$/i.test(file.name)) { setError("Choose a ZIP export package."); setStatus("error"); return; }
    pendingFileRef.current = file;
    mapPreviewConfigRef.current = null;
    setSourcePackage(file);
    generationRequestRef.current = `${file.name}:${file.size}:${file.lastModified}`;
    generationNeededRef.current = false;
    targetRefreshRequestRef.current = "";
    pendingGeneratedFrameRef.current = null;
    clearCtvOttVideos();
    setCtvOttFormats([]);
    setCtvOttStatus("idle");
    setCtvOttError("");
    setTeaserGenerationStatus("idle");
    setSummary(null); setPreviewSizeCount(null); setStatus("loading"); setError(""); setActiveTab("overview");
    void loadPreviewFile(iframeRef.current, file);
    try {
      const packageData = await readPackage(file);
      mapPreviewConfigRef.current = packageData.mapPreviewConfig;
      iframeRef.current?.contentWindow?.postMessage({
        type: "tqa:map-config",
        token: BRIDGE_TOKEN,
        config: packageData.mapPreviewConfig,
      }, "*");
      const analyzed = analyzePackage(packageData.exportData, packageData.assets, file.name);
      const detectedCtvOttFormats = detectCtvOttFormats(packageData.exportData);
      if (teaserMediaRef.current) Object.values(teaserMediaRef.current).forEach(url => { if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url); });
      teaserLayoutUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      const nextMedia = createTeaserMedia(packageData.teaserBytes);
      const needsGeneration = analyzed.artboards.some(name => name.toLowerCase() === "mobile-instream") && !packageData.teaserBytes.instreamVideo;
      generationNeededRef.current = Boolean(needsGeneration && packageData.teaserBytes.video);
      const pendingFrame = pendingGeneratedFrameRef.current as { requestId: string; dataUrl: string; videoTarget: TeaserMedia["generatedVideoTarget"] } | null;
      if (generationNeededRef.current && pendingFrame?.requestId === generationRequestRef.current) {
        nextMedia.generatedFrame = pendingFrame.dataUrl;
        nextMedia.generatedVideoTarget = pendingFrame.videoTarget;
      }
      const nextLayouts = createTeaserPackageLayouts(packageData.exportData, packageData.packageFiles);
      teaserMediaRef.current = nextMedia;
      teaserLayoutUrlsRef.current = nextLayouts.urls;
      setTeaserMedia(nextMedia);
      setTeaserGenerationStatus(!needsGeneration ? "idle" : !packageData.teaserBytes.video ? "error" : nextMedia.generatedFrame ? "ready" : "rendering");
      setTeaserLayouts(nextLayouts.layouts);
      setSummary(analyzed);
      setStatus("ready"); setError("");
      void renderCtvOttPackage(file, detectedCtvOttFormats, generationRequestRef.current);
    } catch (cause) {
      setStatus("error"); setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const filteredFindings = useMemo(() => {
    if (!summary) return [];
    const query = findingQuery.trim().toLowerCase();
    return summary.findings.filter(finding =>
      (severity === "all" || finding.severity === severity)
      && (findingCategory === "all" || finding.category === findingCategory)
      && (findingTab === "all" || finding.tab === findingTab)
      && (findingSize === "all" || finding.artboard === findingSize)
      && (!query || [finding.title, finding.message, finding.suggestedFix, finding.artboard, finding.tab, finding.slide, finding.layerName, finding.category].some(value => String(value || "").toLowerCase().includes(query))),
    );
  }, [summary, findingQuery, severity, findingCategory, findingTab, findingSize]);

  const findingGroups = useMemo(() => {
    const groups = new Map<string, { label: string; findings: Finding[] }>();
    filteredFindings.forEach(finding => {
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
  }, [filteredFindings]);

  const findingCategories = useMemo(() => Array.from(new Set(summary?.findings.map(finding => finding.category) || [])).sort(), [summary]);
  const findingTabs = useMemo(() => Array.from(new Set(summary?.findings.map(finding => finding.tab).filter((value): value is string => Boolean(value)) || [])).sort(), [summary]);
  const findingSizes = useMemo(() => Array.from(new Set(summary?.findings.map(finding => finding.artboard).filter((value): value is string => Boolean(value)) || [])).sort(), [summary]);

  const filteredAssets = useMemo(() => {
    if (!summary) return [];
    const query = assetQuery.trim().toLowerCase();
    return summary.assets.filter(asset => (assetScope === "all" || (assetScope === "first-view" ? asset.firstViewScopes.length > 0 : asset.firstViewScopes.includes(assetScope))) && (!query || [asset.name, asset.extension, asset.status].some(value => value.toLowerCase().includes(query))));
  }, [summary, assetQuery, assetScope]);

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
  const focusFinding = (finding: Finding) => {
    if (!finding.layerId || !finding.artboard) return;
    setActiveTab("preview");
    window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:focus-finding", token: BRIDGE_TOKEN, finding }, "*"), 0);
  };
  const openCtvOtt = () => {
    setActiveTab("ctvOtt");
    if (ctvOttStatus === "error" && pendingFileRef.current && ctvOttFormats.length) {
      void renderCtvOttPackage(pendingFileRef.current, ctvOttFormats, generationRequestRef.current);
    }
  };

  const openFeedback = () => {
    setFeedbackError("");
    setFeedbackSuccess("");
    setFeedbackOpen(true);
  };

  const pasteFeedbackImages = (context: FeedbackImageContext, event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.items)
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!images.length) return;
    event.preventDefault();
    setFeedbackInlineImages(current => {
      const existingCount = current.filter(image => image.context === context).length;
      const pasted = images.map((image, index) => {
        const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : image.type === "image/gif" ? "gif" : "png";
        const file = new File([image], `${context}-pasted-${existingCount + index + 1}.${extension}`, { type: image.type, lastModified: Date.now() });
        return { id: crypto.randomUUID(), context, file, previewUrl: URL.createObjectURL(file) };
      });
      return [...current, ...pasted];
    });
  };

  const removeFeedbackImage = (id: string) => {
    setFeedbackInlineImages(current => {
      const removed = current.find(image => image.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter(image => image.id !== id);
    });
  };

  const submitFeedback = async () => {
    const referenceInput = feedbackReferenceUrl.trim();
    const reference = referenceInput ? parseProductionReference(referenceInput) : null;
    if (referenceInput && !reference) {
      setFeedbackError("Enter a valid CCRV or Showcase URL from showcase.vdx.tv, including its # creative ID.");
      return;
    }
    if (requiresProductionReference && !reference) {
      setFeedbackError("Add a CCRV or Showcase URL to compare this visual mismatch with production.");
      return;
    }
    setFeedbackPreparing(true);
    setFeedbackError("");
    setFeedbackSuccess("");
    try {
      const capture = feedbackIncludeScreenshot && summary
        ? await captureFeedbackPreview(iframeRef.current).catch(cause => ({ error: cause instanceof Error ? cause.message : String(cause) }))
        : null;
      const captureResult = capture && "dataUrl" in capture ? capture : null;
      const captureError = capture && "error" in capture ? capture.error : null;
      const packageFile = feedbackIncludePackage ? sourcePackage : null;
      const generatedAt = new Date().toISOString();
      const files: Record<string, Uint8Array> = {};
      const feedback = {
        schemaVersion: 1,
        generatedAt,
        build: PREVIEW_VERSION,
        type: feedbackType,
        productionReference: reference,
        report: {
          description: feedbackSummary.trim() || null,
          actualResult: feedbackActual.trim() || null,
          expectedResult: feedbackExpected.trim() || null,
          reproductionSteps: feedbackSteps.trim() || null,
        },
        appState: {
          section: activeTab,
          theme,
          preview: captureResult?.state || null,
          previewCaptureError: captureError,
        },
        environment: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
        },
        package: summary ? {
          sourceFile: summary.sourceFile,
          creativeName: summary.creativeName,
          included: Boolean(packageFile),
          size: packageFile?.size || null,
          artboards: summary.artboards,
          findings: summary.findings,
        } : null,
        evidence: {
          activePreviewScreenshot: Boolean(captureResult),
          screenshotRequested: feedbackIncludeScreenshot,
          sourcePackage: Boolean(packageFile),
          pastedImages: feedbackInlineImages.map(image => ({ context: image.context, name: image.file.name, size: image.file.size, type: image.file.type || null })),
          attachments: feedbackAttachments.map(file => ({ name: file.name, size: file.size, type: file.type || null })),
        },
      };
      files["feedback.json"] = strToU8(JSON.stringify(feedback, null, 2));
      if (captureResult) files["evidence/active-preview.png"] = dataUrlToBytes(captureResult.dataUrl);
      for (const image of feedbackInlineImages) {
        const folder = image.context === "description" ? "description" : `${image.context}-result`;
        files[`evidence/${folder}/${safeFilePart(image.file.name, `${image.context}-pasted.png`)}`] = new Uint8Array(await image.file.arrayBuffer());
      }
      if (packageFile) files[`package/${safeFilePart(packageFile.name, "source-package.zip")}`] = new Uint8Array(await packageFile.arrayBuffer());
      const usedAttachmentNames = new Set<string>();
      for (const attachment of feedbackAttachments) {
        const baseName = safeFilePart(attachment.name, "attachment");
        let name = baseName;
        let suffix = 2;
        while (usedAttachmentNames.has(name.toLowerCase())) {
          const dot = baseName.lastIndexOf(".");
          name = dot > 0 ? `${baseName.slice(0, dot)}-${suffix}${baseName.slice(dot)}` : `${baseName}-${suffix}`;
          suffix += 1;
        }
        usedAttachmentNames.add(name.toLowerCase());
        files[`attachments/${name}`] = new Uint8Array(await attachment.arrayBuffer());
      }
      const archive = zipSync(files, { level: 6 });
      const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
      const stamp = generatedAt.replace(/[:.]/g, "-");
      const creative = safeFilePart(summary?.creativeName || "turbo", "turbo").toLowerCase();
      const filename = `${creative}-feedback-${stamp}.zip`;
      const response = await fetch("/api/ctv-ott/feedback/upload", {
        method: "POST",
        headers: { "Content-Type": "application/zip", "X-Feedback-Filename": encodeURIComponent(filename) },
        body: archiveBuffer,
      });
      const result = await response.json().catch(() => null) as { error?: string; name?: string } | null;
      if (!response.ok) throw new Error(result?.error || `Box submission failed (${response.status}).`);
      setFeedbackSuccess(`Submitted ${result?.name || filename} to Box.`);
    } catch (cause) {
      setFeedbackError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setFeedbackPreparing(false);
    }
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
            <button type="button" role="tab" data-slot="tabs-trigger" data-state={activeTab === "preview" ? "active" : "inactive"} aria-selected={activeTab === "preview"} onClick={() => openMainUnit("970x546")}><ImageIcon /> Main Unit <span className="preview-version">{PREVIEW_VERSION}</span></button>
          </div><div className="scan-status"><CheckCircle2 /> Static analysis complete</div></div>

          <div className="ctv-ott-subnav" role="navigation" aria-label="CTV and OTT teaser navigation">
            {ctvOttFormats.length > 0 && <button type="button" className={activeTab === "ctvOtt" ? "active" : ""} onClick={openCtvOtt}><Play /> {ctvOttViewLabel(ctvOttFormats)}</button>}
            {ctvOttStatus === "rendering" && <span role="status"><LoaderCircle className="spin" /> Generating teaser preview…</span>}
            {ctvOttStatus === "error" && <span className="ctv-ott-subnav-error" role="alert"><CircleAlert /> {ctvOttError}</span>}
            {ctvOttStatus === "missing" && <span className="ctv-ott-subnav-error" role="alert"><CircleAlert /> {ctvOttError}</span>}
          </div>

          {activeTab === "overview" && <div role="tabpanel" className="workspace-content">
            <section className="summary-hero"><div><span className="eyebrow">PACKAGE SUMMARY</span><h1>{summary.creativeName}</h1><p>{issueCount ? `${issueCount} issue${issueCount === 1 ? "" : "s"} need review before handoff.` : "No errors or warnings were found by the current rule set."}</p></div><Button variant="outline" onClick={() => setActiveTab("findings")}>Review findings <ChevronRight /></Button></section>
            <section className="stat-grid"><Stat label="Artboards" value={summary.artboards.length} detail={summary.artboards.join(" · ")} /><Stat label="Content states" value={`${summary.tabCount} / ${summary.slideCount}`} detail="Tabs / named slides" /><Stat label="Text layers" value={summary.textLayerCount} detail="Checked for typography risks" /><Stat label="Package assets" value={summary.assets.length} detail={`${formatBytes(totalBytes)} uncompressed`} /></section>
            <section className="severity-grid">{(["error", "warning", "info"] as Severity[]).map(level => <button key={level} className={`severity-card ${level}`} onClick={() => { setSeverity(level); setFindingCategory("all"); setFindingTab("all"); setFindingSize("all"); setFindingQuery(""); setActiveTab("findings"); }}><span><SeverityIcon level={level} /></span><strong>{count(summary.findings, level)}</strong><div><b>{level === "info" ? "Notes" : `${level[0].toUpperCase()}${level.slice(1)}s`}</b><small>{level === "error" ? "Critical issues" : level === "warning" ? "Needs designer review" : "Risks and limitations"}</small></div><ChevronRight /></button>)}</section>
            <section className="overview-grid"><article className="panel"><div className="panel-heading"><span className="eyebrow">COVERAGE</span><h2>Current analysis</h2></div><div className="coverage-list">{["Turbo structure and required artboards", "Asset references and package inventory", "Copy presence across artboards", "Tab-wide element presence", "CTA text mode and production rendering risks", "Shift+Enter soft-return production errors", "Spacing, defaults, superscript and kerning"].map(item => <div key={item}><CheckCircle2 /><span>{item}</span></div>)}</div></article><article className="panel next-panel"><span className="eyebrow">NEXT ANALYSIS LAYER</span><h2>Rendered geometry</h2><p>Cropped copy, hanging lines, alignment and screenshot batches will use the same state index after fonts and assets settle.</p><Badge variant="outline">Foundation ready</Badge></article></section>
          </div>}

          {activeTab === "findings" && <div role="tabpanel" className="workspace-content">
            <section className="page-title"><span className="eyebrow">CREATIVE ANALYSIS</span><h1>Findings</h1><p>Deterministic defects and review signals from the complete package structure.</p></section>
            <div className="findings-summary-bar">
              <div className="findings-summary-count"><strong>{summary.findings.length} {summary.findings.length === 1 ? "finding" : "findings"}</strong><span>across {summary.artboards.length} sizes and {summary.tabCount} tabs</span></div>
              <div className="findings-summary-severity">
                {count(summary.findings, "error") > 0 && <button type="button" className={`summary-severity critical ${severity === "error" ? "active" : ""}`} aria-pressed={severity === "error"} onClick={() => { setSeverity(severity === "error" ? "all" : "error"); setFindingCategory("all"); setFindingTab("all"); setFindingSize("all"); setFindingQuery(""); }}>{count(summary.findings, "error")} critical</button>}
                {count(summary.findings, "warning") > 0 && <button type="button" className={`summary-severity review ${severity === "warning" ? "active" : ""}`} aria-pressed={severity === "warning"} onClick={() => { setSeverity(severity === "warning" ? "all" : "warning"); setFindingCategory("all"); setFindingTab("all"); setFindingSize("all"); setFindingQuery(""); }}>{count(summary.findings, "warning")} need review</button>}
                <label className="summary-select"><span>Tab</span><select aria-label="Filter by tab" value={findingTab} onChange={event => setFindingTab(event.target.value)}><option value="all">All tabs</option>{findingTabs.map(value => <option key={value} value={value}>{findingContextLabel(value)}</option>)}</select></label>
                <label className="summary-select"><span>Size</span><select aria-label="Filter by size" value={findingSize} onChange={event => setFindingSize(event.target.value)}><option value="all">All sizes</option>{findingSizes.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
              </div>
            </div>
            <div className="toolbar findings-search"><label className="search-field"><Search /><input value={findingQuery} onChange={event => setFindingQuery(event.target.value)} placeholder="Search copy, element, or suggested fix…" /></label></div>
            <div className="finding-category-filters" aria-label="Filter findings by check">
              <button type="button" className={findingCategory === "all" ? "active" : ""} aria-pressed={findingCategory === "all"} onClick={() => setFindingCategory("all")}>All checks</button>
              {findingCategories.map(category => <button type="button" key={category} className={findingCategory === category ? "active" : ""} aria-pressed={findingCategory === category} onClick={() => setFindingCategory(findingCategory === category ? "all" : category)}>{category}</button>)}
            </div>
            <div className="finding-list">{findingGroups.length ? findingGroups.map(group => <section key={group.id} className="finding-group"><header className="finding-group-heading"><strong>{group.label}</strong><span>{group.findings.length} {group.findings.length === 1 ? "finding" : "findings"}</span></header>{group.findings.map((finding, index) => <article key={`${finding.id}-${index}`} className={`finding-row ${finding.severity}`}><div className="finding-icon"><SeverityIcon level={finding.severity} /></div><div className="finding-copy"><div className="finding-title"><strong>{finding.title}</strong><button type="button" className="finding-category-tag" aria-pressed={findingCategory === finding.category} onClick={() => setFindingCategory(findingCategory === finding.category ? "all" : finding.category)}>{finding.category}</button><span className="finding-why"><button type="button" aria-label={`Why this was flagged: ${finding.reason}`} aria-describedby={`finding-why-${finding.id}`}><Info aria-hidden="true" /></button><span role="tooltip" id={`finding-why-${finding.id}`} className="finding-why-tip">{finding.reason}</span></span></div>{finding.ruleId === "copy.spacing" ? <SpacingHighlight finding={finding} /> : <p>{finding.message}</p>}{finding.ruleId === "copy.line-end-spacing" && <SpacingHighlight finding={finding} />}<p className="finding-fix"><strong>Suggested fix</strong><span>{finding.suggestedFix}</span></p>{(finding.artboard || finding.tab || finding.slide) && <div className="finding-location">{[finding.artboard, finding.tab, finding.slide].filter((value): value is string => Boolean(value)).map((value, locationIndex) => <span key={`${value}-${locationIndex}`}>{findingContextLabel(value)}</span>)}{finding.layerId != null && finding.artboard && <button type="button" className="finding-preview-button" aria-label="Show finding in preview" title="Show in preview" onClick={() => focusFinding(finding)}><Play aria-hidden="true" /></button>}</div>}{finding.evidence && (finding.ruleId.startsWith("assets.") || finding.ruleId === "copy.line-end-spacing") && <small>{finding.evidence}</small>}</div></article>)}</section>) : <div className="empty-results"><CheckCircle2 /><strong>No matching findings</strong><span>Adjust the search or selected filters.</span></div>}</div>
          </div>}

          {activeTab === "assets" && <div role="tabpanel" className="workspace-content">
            <section className="page-title"><span className="eyebrow">PACKAGE INVENTORY</span><h1>Assets</h1><p>Files, sizes, declared references, and potential package debris.</p></section>
            <div className="toolbar"><label className="search-field"><Search /><input value={assetQuery} onChange={event => setAssetQuery(event.target.value)} placeholder="Filter by filename, type, or status…" /></label><select aria-label="Asset scope" value={assetScope} onChange={event => setAssetScope(event.target.value)}><option value="all">All assets</option><option value="first-view">First view</option>{summary.firstViews.map(view => <option key={view.artboard} value={view.artboard}>{view.artboard} first view</option>)}</select></div>
            <div className="table-panel"><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Size</TableHead><TableHead>Validation</TableHead><TableHead>Status</TableHead><TableHead>References</TableHead></TableRow></TableHeader><TableBody>{filteredAssets.map((asset, index) => <TableRow key={`${asset.name}-${index}`}><TableCell className="asset-name">{asset.name}</TableCell><TableCell>{asset.extension}</TableCell><TableCell className="text-right font-mono">{formatBytes(asset.uncompressedSize)}</TableCell><TableCell>{asset.validationErrors.length || (asset.validationWarnings || []).length ? <><span className={`asset-status ${asset.validationErrors.length ? "error" : "warning"}`}>{asset.validationErrors.length ? "Error" : "Warning"}</span>{[...asset.validationErrors, ...(asset.validationWarnings || [])].map(message => <p key={message}>{message}</p>)}</> : "—"}</TableCell><TableCell><span className={`asset-status ${asset.status}`}>{asset.status}</span></TableCell><TableCell>{asset.referenceCount || "—"}</TableCell></TableRow>)}</TableBody></Table></div>
          </div>}

          {activeTab === "ctvOtt" && <div role="tabpanel" className="workspace-content ctv-ott-page">
            <section className="page-title"><span className="eyebrow">TEASER PREVIEW</span><h1>{ctvOttViewLabel(ctvOttFormats)}</h1><p>Automatically generated from the detected package theme.</p></section>
            {ctvOttStatus === "rendering" && <section className="ctv-ott-state" role="status"><LoaderCircle className="spin" /><strong>Generating CTV/OTT teaser preview…</strong></section>}
            {ctvOttStatus === "error" && <section className="ctv-ott-state error" role="alert"><CircleAlert /><div><strong>CTV/OTT preview unavailable</strong><span>{ctvOttError}</span></div></section>}
            {ctvOttStatus === "missing" && <section className="ctv-ott-state error" role="alert"><CircleAlert /><div><strong>CTV/OTT assets missing</strong><span>{ctvOttError}</span></div></section>}
            {ctvOttStatus === "ready" && <div className="ctv-ott-video-grid">{ctvOttFormats.map(format => <article key={format} className="ctv-ott-video-card"><h2>{format.toUpperCase()} preview</h2><video src={ctvOttVideos[format]} controls autoPlay muted loop playsInline controlsList="nodownload" aria-label={`${format.toUpperCase()} teaser preview`} /></article>)}</div>}
          </div>}

          {activeTab === "teasers" && teaserMedia && <div role="tabpanel"><TeaserPreview artboards={summary.artboards} media={teaserMedia} layouts={teaserLayouts} generationStatus={teaserGenerationStatus} onOpen={openMainUnit} /></div>}
          {activeTab === "preview" && <div role="tabpanel" className="preview-content"><div className="preview-placeholder" /></div>}
        </div>
      ) : null}

      <Dialog open={feedbackOpen} onOpenChange={open => { if (!feedbackPreparing) setFeedbackOpen(open); }}>
        <DialogContent className="feedback-dialog" aria-describedby="feedback-description">
          <DialogHeader>
            <span className="eyebrow">LOCAL DEBUG BUNDLE</span>
            <DialogTitle>Report feedback</DialogTitle>
            <DialogDescription id="feedback-description">Capture the information needed to reproduce and compare this issue. A ZIP is prepared locally in memory and uploaded to the configured Box folder only when you submit.</DialogDescription>
          </DialogHeader>

          <div className="feedback-form">
            <div className="feedback-grid feedback-grid-two">
              <label className="feedback-field"><span>Feedback type</span>
                <span className="feedback-select">
                  <select value={feedbackType} onChange={event => setFeedbackType(event.target.value as FeedbackType)}>
                    <option value="visual-mismatch">Visual mismatch</option>
                    <option value="finding-issue">Finding looks incorrect</option>
                    <option value="asset-validation">Asset validation issue</option>
                    <option value="package-loading">Package loading issue</option>
                    <option value="preview-interaction">Preview interaction issue</option>
                    <option value="screenshot-export">Screenshot or report issue</option>
                    <option value="app-ui">App UI issue</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="other">Other issue</option>
                  </select>
                  <ChevronDown aria-hidden="true" />
                </span>
              </label>
              <label className="feedback-field"><span>CCRV or Showcase URL {requiresProductionReference ? <b aria-hidden="true">*</b> : "(optional)"}</span>
                <span className="feedback-input-icon"><Link2 /><input type="url" required={requiresProductionReference} aria-invalid={productionReferenceInvalid} value={feedbackReferenceUrl} onChange={event => setFeedbackReferenceUrl(event.target.value)} placeholder="https://showcase.vdx.tv/…/#creative-id" /></span>
                {feedbackReferenceUrl && <small className={productionReference ? "valid" : "invalid"}>{productionReference ? `${productionReference.type === "ccrv" ? "CCRV" : "Showcase"} reference · ${productionReference.creativeId}${productionReference.variant ? ` / ${productionReference.variant}` : ""}` : "Use a showcase.vdx.tv CCRV or Showcase link with its # creative ID."}</small>}
              </label>
            </div>

            <div className="feedback-field"><label htmlFor="feedback-description-text">Description (optional)</label><div className="feedback-textarea-paste"><textarea id="feedback-description-text" value={feedbackSummary} onChange={event => setFeedbackSummary(event.target.value)} onPaste={event => pasteFeedbackImages("description", event)} placeholder="Describe the issue, or paste a screenshot…" />{feedbackInlineImages.some(image => image.context === "description") && <div className="feedback-pasted-images" aria-label="Screenshots pasted into description">{feedbackInlineImages.filter(image => image.context === "description").map(image => <div className="feedback-pasted-image" key={image.id}><span role="img" aria-label={image.file.name} style={{ backgroundImage: `url(${image.previewUrl})` }} /><div><b>{image.file.name}</b><small>{formatBytes(image.file.size)}</small></div><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeFeedbackImage(image.id)}>×</button></div>)}</div>}</div><small>Paste an image from the clipboard to attach it as general evidence.</small></div>
            {showComparisonFields && <div className="feedback-grid feedback-grid-two">
              <div className="feedback-field"><label htmlFor="feedback-actual">Actual result (optional)</label><div className="feedback-textarea-paste"><textarea id="feedback-actual" value={feedbackActual} onChange={event => setFeedbackActual(event.target.value)} onPaste={event => pasteFeedbackImages("actual", event)} placeholder="Describe what happened, or paste a screenshot…" />{feedbackInlineImages.some(image => image.context === "actual") && <div className="feedback-pasted-images" aria-label="Screenshots pasted into actual result">{feedbackInlineImages.filter(image => image.context === "actual").map(image => <div className="feedback-pasted-image" key={image.id}><span role="img" aria-label={image.file.name} style={{ backgroundImage: `url(${image.previewUrl})` }} /><div><b>{image.file.name}</b><small>{formatBytes(image.file.size)}</small></div><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeFeedbackImage(image.id)}>×</button></div>)}</div>}</div><small>Paste an image from the clipboard to attach it as actual-result evidence.</small></div>
              <div className="feedback-field"><label htmlFor="feedback-expected">Expected result (optional)</label><div className="feedback-textarea-paste"><textarea id="feedback-expected" value={feedbackExpected} onChange={event => setFeedbackExpected(event.target.value)} onPaste={event => pasteFeedbackImages("expected", event)} placeholder="Describe production, or paste a reference screenshot…" />{feedbackInlineImages.some(image => image.context === "expected") && <div className="feedback-pasted-images" aria-label="Screenshots pasted into expected result">{feedbackInlineImages.filter(image => image.context === "expected").map(image => <div className="feedback-pasted-image" key={image.id}><span role="img" aria-label={image.file.name} style={{ backgroundImage: `url(${image.previewUrl})` }} /><div><b>{image.file.name}</b><small>{formatBytes(image.file.size)}</small></div><button type="button" aria-label={`Remove ${image.file.name}`} onClick={() => removeFeedbackImage(image.id)}>×</button></div>)}</div>}</div><small>Paste an image from the clipboard to attach it as expected-result evidence.</small></div>
            </div>}
            <label className="feedback-field"><span>Steps to reproduce (optional)</span><textarea value={feedbackSteps} onChange={event => setFeedbackSteps(event.target.value)} placeholder={'1. Open the package\n2. Select the size and state\n3. Observe the issue'} /></label>

            <section className="feedback-evidence" aria-labelledby="feedback-evidence-title">
              <div className="feedback-evidence-heading"><div><strong id="feedback-evidence-title">Evidence included</strong><span>Review everything before submitting feedback.</span></div><ShieldCheck /></div>
              <label className="feedback-check"><input type="checkbox" checked={feedbackIncludeScreenshot} disabled={!summary} onChange={event => setFeedbackIncludeScreenshot(event.target.checked)} /><span><b>Active preview screenshot</b><small>{summary ? "Captures the current artboard and records its tab, slide, view, scale, and theme." : "Open a package to include a rendered artboard."}</small></span></label>
              <label className="feedback-check"><input type="checkbox" checked={feedbackIncludePackage} disabled={!sourcePackage} onChange={event => setFeedbackIncludePackage(event.target.checked)} /><span><b>Source package</b><small>{sourcePackage ? `${sourcePackage.name} · ${formatBytes(sourcePackage.size)}` : "No package is currently open."}</small></span></label>
              <label className="feedback-attachment"><Paperclip /><span><b>Add supporting files</b><small>Reference screenshots, logs, PDFs, or corrected assets</small></span><input type="file" multiple onChange={event => setFeedbackAttachments(Array.from(event.target.files || []))} /></label>
              {feedbackAttachments.length > 0 && <div className="feedback-attachment-list">{feedbackAttachments.map((file, index) => <span key={`${file.name}-${file.size}-${index}`}>{file.name} · {formatBytes(file.size)}</span>)}</div>}
            </section>

            {feedbackError && <div className="feedback-error" role="alert"><CircleAlert /> {feedbackError}</div>}
            {feedbackSuccess && <div className="feedback-success" role="status"><CheckCircle2 /> {feedbackSuccess}</div>}
          </div>

          <DialogFooter className="feedback-footer">
            <Button variant="outline" disabled={feedbackPreparing} onClick={() => setFeedbackOpen(false)}>{feedbackSuccess ? "Close" : "Cancel"}</Button>
            <Button disabled={!canCreateFeedbackBundle} onClick={() => void submitFeedback()}>{feedbackPreparing ? <><LoaderCircle className="spin" /> Submitting feedback…</> : <><Upload /> Submit Feedback</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <iframe ref={iframeRef} title="Turbo package preview" srcDoc={srcDoc} onLoad={() => {
        if (pendingFileRef.current) void loadPreviewFile(iframeRef.current, pendingFileRef.current);
      }} className={summary && activeTab === "preview" ? "preview-frame" : "analysis-frame"} />
    </main>
  );
}
