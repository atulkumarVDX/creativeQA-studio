export type PackageFileBytes = readonly [string, Uint8Array];

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
  defaultLayerId: number;
  frameLayerId: number | null;
  pinLayerId: number | null;
  loadingLayerId: number | null;
  noDataLayerId: number | null;
  popupLayerId: number | null;
  buttonLayerId: number | null;
  logoLayerId: number | null;
  dataMarkerLayerId: number | null;
};

export type MapPreviewConfig = {
  accessToken: string;
  tileUrl: string;
  stores: MapPreviewStore[];
  components: MapPreviewComponent[];
  pinImages: Record<string, string>;
  buttonImages: Record<string, string>;
  logoImages: Record<string, string>;
  defaultImages: Record<string, string>;
  loadingImages: Record<string, string>;
  noDataImages: Record<string, string>;
  settings: {
    zoomLevel: number; minZoom: number; maxZoom: number;
    zoomControl: boolean; attributionControl: boolean; twoFingersEnabled: boolean;
    popupWidth: number;
    tooltip: string; showCloseBtn: boolean; openPopByDefault: boolean;
  };
};

function dataUrl(data: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < data.length; offset += 0x8000) binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}

function layerId(layer: Record<string, unknown>): number | null {
  const child = Number(layer.layerID);
  return Number.isFinite(child) && child > 0 ? child : null;
}

/** Build the small, safe payload the isolated campaign preview needs for a Mapbox locationMap. */
export function buildMapPreviewConfig(rawLayers: unknown, packageFiles: PackageFileBytes[], accessToken: string): MapPreviewConfig | null {
  if (!Array.isArray(rawLayers)) return null;
  const layers = rawLayers.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  const mapLayers = layers.filter(layer => /^locationmap(?:\d+)?$/i.test(String(layer.name || "")));
  if (!mapLayers.length) return null;

  const feedFile = packageFiles.find(([name]) => name.split("/").pop()?.toLowerCase() === "data.json");
  let feed: unknown = null;
  try { if (feedFile) feed = JSON.parse(new TextDecoder().decode(feedFile[1])); } catch { /* no usable feed */ }
  const rawStores = (feed as { listing?: { stores?: unknown } } | null)?.listing?.stores;
  const stores = (Array.isArray(rawStores) ? rawStores : []).filter((store): store is MapPreviewStore => {
    if (!store || typeof store !== "object") return false;
    const row = store as Partial<MapPreviewStore>;
    return Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.long));
  }).map(store => ({
    id: String(store.id || ""), label: String(store.label || "Store"), address: String(store.address || ""),
    city: String(store.city || ""), state: String(store.state || ""), zip: String(store.zip || ""),
    country: String(store.country || ""), phone: String(store.phone || ""), cta: String(store.cta || ""),
    lat: Number(store.lat), long: Number(store.long),
  }));
  const components: MapPreviewComponent[] = [];
  const pinImages: Record<string, string> = {};
  const buttonImages: Record<string, string> = {};
  const logoImages: Record<string, string> = {};
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
    const frameLayerId = frame ? layerId(frame) : null;
    const pinLayerId = pin ? layerId(pin) : null;
    const pinFile = pinLayerId && packageFiles.find(([name]) => name.split("/").pop()?.toLowerCase() === `pin-${pinLayerId}.png`);
    if (pinLayerId && pinFile) pinImages[String(pinLayerId)] = dataUrl(pinFile[1]);
    const optionalId = (name: string) => { const item = child(name); return item ? layerId(item) : null; };
    const dataFolder = child("data");
    const dataMarker = dataFolder && layers.find(layer => Number(layer.parentLayerID) === Number(dataFolder.layerID) && String(layer.name || "").toLowerCase().endsWith(".json"));
    const addStateImage = (layerName: string, prefix: string, target: Record<string, string>) => {
      const id = optionalId(layerName);
      const file = id && packageFiles.find(([name]) => name.split("/").pop()?.toLowerCase() === `${prefix}-${id}.png`);
      if (id && file) target[String(rootLayerId)] = dataUrl(file[1]);
    };
    addStateImage("button", "button", buttonImages);
    addStateImage("logo", "logo", logoImages);
    addStateImage("default", "default", defaultImages);
    addStateImage("loading", "loading", loadingImages);
    addStateImage("nodata", "nodata", noDataImages);
    components.push({
      rootLayerId, defaultLayerId, frameLayerId, pinLayerId,
      loadingLayerId: optionalId("loading"), noDataLayerId: optionalId("nodata"),
      popupLayerId: optionalId("popup"), buttonLayerId: optionalId("button"),
      logoLayerId: optionalId("logo"), dataMarkerLayerId: dataMarker ? layerId(dataMarker) : null,
    });
  }
  if (!components.length) return null;
  return {
    accessToken,
    tileUrl: `https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(accessToken)}`,
    stores, components, pinImages, buttonImages, logoImages, defaultImages, loadingImages, noDataImages,
    settings: {
      zoomLevel: 12, minZoom: 2, maxZoom: 19,
      zoomControl: false, attributionControl: false, twoFingersEnabled: true,
      popupWidth: 253,
      tooltip: "visible", showCloseBtn: true, openPopByDefault: true,
    },
  };
}
