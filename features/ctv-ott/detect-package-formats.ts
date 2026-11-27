import type { PackageExportData } from "@/types/package";
import type { CtvOttFormat } from "@/features/ctv-ott/render-package";

type ArtboardLayer = { layerID?: number; name?: unknown; visible?: boolean };

export function detectCtvOttFormats(exportData: PackageExportData): CtvOttFormat[] {
  const layers = Array.isArray(exportData.rawLayers) ? exportData.rawLayers as ArtboardLayer[] : [];
  const byId = new Map(layers.map(layer => [layer.layerID, layer]));
  const names: string[] = (Array.isArray(exportData.document?.artboards) ? exportData.document.artboards : [])
    .map((id: unknown) => byId.get(Number(id)))
    .filter((layer: ArtboardLayer | undefined): layer is ArtboardLayer => layer != null && layer.visible !== false)
    .map((layer: ArtboardLayer) => String(layer.name || "").trim());
  return [...new Set<CtvOttFormat>(names
    .filter(name => /^(ctv|ott|ctvott)(?:_|$)/i.test(name))
    .map(name => /^ctv/i.test(name) ? "ctv" : "ott") as CtvOttFormat[])];
}
