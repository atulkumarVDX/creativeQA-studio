import type { PackageFile } from "@/types/package";

export type PackageFileBytes = PackageFile;
export type MapPreviewAssetReference = { layerID: number | string; fileName: string };

export type MapPreviewStore = {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  cta: string;
  lat: number;
  long: number;
};

export type MapPreviewComponent = {
  rootLayerId: number;
  stores: MapPreviewStore[];
  defaultLayerId: number;
  frameLayerId: number | null;
  popupWidth: number | null;
  popupHeight: number | null;
  pinLayerId: number | null;
  loadingLayerId: number | null;
  noDataLayerId: number | null;
  popupLayerId: number | null;
  buttonLayerId: number | null;
  logoLayerId: number | null;
  dataMarkerLayerId: number | null;
};

export type MapPreviewArtwork = { src: string; width: number; height: number };

export type MapPreviewConfig = {
  accessToken: string;
  styleUrl: string;
  stores: MapPreviewStore[];
  components: MapPreviewComponent[];
  pinImages: Record<string, MapPreviewArtwork>;
  buttonImages: Record<string, MapPreviewArtwork>;
  logoImages: Record<string, MapPreviewArtwork>;
  defaultImages: Record<string, string>;
  loadingImages: Record<string, string>;
  noDataImages: Record<string, string>;
  settings: {
    zoomLevel: number; minZoom: number; maxZoom: number;
    zoomControl: boolean; attributionControl: boolean; twoFingersEnabled: boolean;
    popupWidth: number; popupHeight: number;
    tooltip: string; showCloseBtn: boolean; openPopByDefault: boolean;
  };
};

function dataUrl(data: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < data.length; offset += 0x8000) binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}

function imageArtwork(file: PackageFileBytes): MapPreviewArtwork {
  const [name, data] = file;
  const isRetina = /-2x\.png$/i.test(name);
  const factor = isRetina ? 2 : 1;
  const png = data.length >= 24 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const pixelWidth = png ? ((data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19]) >>> 0 : 0;
  const pixelHeight = png ? ((data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23]) >>> 0 : 0;
  return { src: dataUrl(data), width: pixelWidth / factor, height: pixelHeight / factor };
}

function layerDimension(layer: Record<string, unknown> | undefined, dimension: "width" | "height"): number | null {
  const bounds = layer?.bounds as Record<string, unknown> | undefined;
  const raw = bounds?.[dimension];
  const value = Number(raw && typeof raw === "object" ? (raw as Record<string, unknown>)._value : raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function findRoleImage(files: PackageFileBytes[], role: string, id: number): PackageFileBytes | undefined {
  const base = `${role}-${id}`.toLowerCase();
  const exact = files.find(([name]) => name.split("/").pop()?.toLowerCase() === `${base}.png`);
  return exact || files.find(([name]) => name.split("/").pop()?.toLowerCase() === `${base}-2x.png`);
}

function layerId(layer: Record<string, unknown>): number | null {
  const child = Number(layer.layerID);
  return Number.isFinite(child) && child > 0 ? child : null;
}

/** Select only archive members needed to render location maps in the preview. */
export function getMapPreviewAssetNames(rawLayers: unknown, archiveNames: readonly string[]): string[] {
  if (!Array.isArray(rawLayers)) return [];
  const layers = rawLayers.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  const mapLayers = layers.filter(layer => /^locationmap(?:\d+)?$/i.test(String(layer.name || "")));
  if (!mapLayers.length) return [];

  const roleFiles = new Set<string>();
  for (const map of mapLayers) {
    const rootId = layerId(map);
    if (!rootId) continue;
    const children = layers.filter(layer => Number(layer.parentLayerID) === rootId);
    for (const child of children) {
      const role = String(child.name || "").toLowerCase();
      if (!["pin", "default", "loading", "nodata", "button", "logo"].includes(role)) continue;
      const id = layerId(child);
      if (id) {
        roleFiles.add(`${role}-${id}.png`);
        roleFiles.add(`${role}-${id}-2x.png`);
      }
    }
  }

  return archiveNames.filter(name => {
    const basename = name.split("/").pop()?.toLowerCase() || "";
    return basename === "data.json" || roleFiles.has(basename);
  });
}

/** Build the small, safe payload the isolated campaign preview needs for a Mapbox locationMap. */
export function buildMapPreviewConfig(
  rawLayers: unknown,
  packageFiles: PackageFileBytes[],
  accessToken: string,
  customAssets: unknown = [],
): MapPreviewConfig | null {
  if (!Array.isArray(rawLayers)) return null;
  const layers = rawLayers.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  const mapLayers = layers.filter(layer => /^locationmap(?:\d+)?$/i.test(String(layer.name || "")));
  if (!mapLayers.length) return null;
  const references = new Map<string, string>();
  if (Array.isArray(customAssets)) {
    for (const asset of customAssets) {
      if (!asset || typeof asset !== "object") continue;
      const row = asset as Partial<MapPreviewAssetReference>;
      if (row.layerID != null && row.fileName) references.set(String(row.layerID), String(row.fileName));
    }
  }
  const feedFiles = packageFiles.filter(([name]) => name.split("/").pop()?.toLowerCase() === "data.json");
  const normalizedPath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
  const feedForMarker = (marker: Record<string, unknown> | undefined): PackageFileBytes | undefined => {
    if (!marker) return feedFiles.length === 1 ? feedFiles[0] : undefined;
    const reference = references.get(String(marker.layerID));
    if (reference) {
      const target = normalizedPath(reference);
      const exact = packageFiles.find(([name]) => normalizedPath(name) === target);
      if (exact) return exact;
      const matchingBase = packageFiles.filter(([name]) => name.split("/").pop()?.toLowerCase() === target.split("/").pop());
      if (matchingBase.length === 1) return matchingBase[0];
    }
    // A single-feed package has no ambiguity. For multiple feeds, never attach
    // an unrelated location list just because it happened to appear first.
    return feedFiles.length === 1 ? feedFiles[0] : undefined;
  };
  const storesForFeed = (file: PackageFileBytes | undefined): MapPreviewStore[] => {
    let feed: unknown = null;
    try { if (file) feed = JSON.parse(new TextDecoder().decode(file[1])); } catch { /* no usable feed */ }
    const rawStores = (feed as { listing?: { stores?: unknown } } | null)?.listing?.stores;
    return (Array.isArray(rawStores) ? rawStores : []).filter((store): store is MapPreviewStore => {
      if (!store || typeof store !== "object") return false;
      const row = store as Partial<MapPreviewStore>;
      return Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.long));
    }).map(store => ({
      id: String(store.id || ""), label: String(store.label || "Store"), address: String(store.address || ""),
      city: String(store.city || ""), state: String(store.state || ""), zip: String(store.zip || ""),
      country: String(store.country || ""), phone: String(store.phone || ""), cta: String(store.cta || ""),
      lat: Number(store.lat), long: Number(store.long),
    }));
  };
  const components: MapPreviewComponent[] = [];
  const pinImages: Record<string, MapPreviewArtwork> = {};
  const buttonImages: Record<string, MapPreviewArtwork> = {};
  const logoImages: Record<string, MapPreviewArtwork> = {};
  const defaultImages: Record<string, string> = {};
  const loadingImages: Record<string, string> = {};
  const noDataImages: Record<string, string> = {};
  for (const map of mapLayers) {
    const rootLayerId = layerId(map);
    if (!rootLayerId) continue;
    const children = layers.filter(layer => Number(layer.parentLayerID) === rootLayerId);
    const child = (name: string) => children.find(layer => String(layer.name || "").toLowerCase() === name);
    const defaultItem = child("default");
    const defaultLayerId = defaultItem ? layerId(defaultItem) : null;
    if (!defaultLayerId) continue;
    const frame = child("frame");
    const pin = child("pin");
    const popup = child("popup");
    const frameLayerId = frame ? layerId(frame) : null;
    const pinLayerId = pin ? layerId(pin) : null;
    const pinFile = pinLayerId && findRoleImage(packageFiles, "pin", pinLayerId);
    if (pinLayerId && pinFile) pinImages[String(pinLayerId)] = imageArtwork(pinFile);
    const optionalId = (name: string) => { const item = child(name); return item ? layerId(item) : null; };
    const dataFolder = child("data");
    const dataMarker = dataFolder && layers.find(layer => Number(layer.parentLayerID) === Number(dataFolder.layerID) && String(layer.name || "").toLowerCase().endsWith(".json"));
    const stores = storesForFeed(feedForMarker(dataMarker || undefined));
    const addStateImage = (layerName: string, prefix: string, target: Record<string, string>) => {
      const id = optionalId(layerName);
      const file = id && findRoleImage(packageFiles, prefix, id);
      if (id && file) target[String(rootLayerId)] = dataUrl(file[1]);
    };
    const buttonId = optionalId("button");
    const buttonFile = buttonId && findRoleImage(packageFiles, "button", buttonId);
    if (buttonFile) buttonImages[String(rootLayerId)] = imageArtwork(buttonFile);
    const logoId = optionalId("logo");
    const logoFile = logoId && findRoleImage(packageFiles, "logo", logoId);
    if (logoFile) logoImages[String(rootLayerId)] = imageArtwork(logoFile);
    addStateImage("default", "default", defaultImages);
    addStateImage("loading", "loading", loadingImages);
    addStateImage("nodata", "nodata", noDataImages);
    components.push({
      rootLayerId, defaultLayerId, frameLayerId, stores,
      popupWidth: layerDimension(popup, "width"), popupHeight: layerDimension(popup, "height"),
      pinLayerId,
      loadingLayerId: optionalId("loading"), noDataLayerId: optionalId("nodata"),
      popupLayerId: optionalId("popup"), buttonLayerId: optionalId("button"),
      logoLayerId: optionalId("logo"), dataMarkerLayerId: dataMarker ? layerId(dataMarker) : null,
    });
  }
  if (!components.length) return null;
  return {
    accessToken,
    styleUrl: "mapbox://styles/mapbox/streets-v11",
    stores: components.flatMap(component => component.stores),
    components, pinImages, buttonImages, logoImages, defaultImages, loadingImages, noDataImages,
    settings: {
      zoomLevel: 12, minZoom: 2, maxZoom: 19,
      zoomControl: false, attributionControl: false, twoFingersEnabled: true,
      popupWidth: 250, popupHeight: 180,
      tooltip: "visible", showCloseBtn: true, openPopByDefault: true,
    },
  };
}
