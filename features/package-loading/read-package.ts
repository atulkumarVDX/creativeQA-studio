import { strFromU8, unzip } from "fflate";
import { buildMapPreviewConfig, getMapPreviewAssetNames } from "@/lib/map-preview";
import { MAX_PACKAGE_SIZE_BYTES } from "@/config/package";
import type { PackageAsset, PackageExportData, PackageFile, TeaserBytes } from "@/types/package";

export { MAX_PACKAGE_SIZE_BYTES } from "@/config/package";
export type PackageContents = {
  exportData: PackageExportData;
  assets: PackageAsset[];
  teaserBytes: TeaserBytes;
  packageFiles: PackageFile[];
  mapPreviewConfig: ReturnType<typeof buildMapPreviewConfig>;
  previewBuffer: ArrayBuffer;
};

const EMPTY_TEASER_BYTES: TeaserBytes = {
  video: null, instreamVideo: null, poster: null, instreamPoster: null,
  logo: null, peelLogo: null, peel: null,
};

function readZipDirectory(bytes: Uint8Array): PackageAsset[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endSearchStart = Math.max(0, bytes.byteLength - 65_557);
  let end = -1;
  for (let offset = bytes.byteLength - 22; offset >= endSearchStart; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { end = offset; break; }
  }
  if (end < 0) throw new Error("ZIP end record is missing.");
  const entryCount = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const assets: PackageAsset[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error("ZIP directory is invalid.");
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const nameStart = offset + 46;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    if (!name.endsWith("/")) assets.push({ name, compressedSize, uncompressedSize });
    offset = nameStart + nameLength + extraLength + commentLength;
  }
  return assets;
}

async function extractExportJson(bytes: Uint8Array): Promise<PackageFile> {
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, { filter: entry => entry.name.split("/").pop()?.toLowerCase() === "export.json" }, (cause, result) => cause ? reject(cause) : resolve(result));
  });
  const entry = Object.entries(entries)[0] as PackageFile | undefined;
  if (!entry) throw new Error("No export.json found inside this ZIP.");
  return entry;
}

export async function readPackage(file: File, mapboxAccessToken: string): Promise<PackageContents> {
  if (file.size > MAX_PACKAGE_SIZE_BYTES) throw new Error("ZIP/package exceeds the maximum 600 MB size.");
  const previewBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(previewBuffer);
  const assets = readZipDirectory(bytes);
  const exportEntry = await extractExportJson(bytes);
  const exportData = JSON.parse(strFromU8(exportEntry[1])) as PackageExportData;
  const mapAssetNames = getMapPreviewAssetNames(exportData.rawLayers, assets.map(asset => asset.name));
  const mapFiles = await extractPackageFiles(file, mapAssetNames);
  const packageFiles: PackageFile[] = [exportEntry, ...mapFiles];
  const mapPreviewConfig = buildMapPreviewConfig(exportData.rawLayers, packageFiles, mapboxAccessToken, exportData.customAssets);
  return { exportData, assets, teaserBytes: EMPTY_TEASER_BYTES, packageFiles, mapPreviewConfig, previewBuffer };
}

export async function extractPackageFiles(file: File, names: readonly string[]): Promise<PackageFile[]> {
  if (!names.length) return [];
  const wanted = new Set(names.map(name => name.replaceAll("\\", "/").toLowerCase()));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, { filter: entry => wanted.has(entry.name.replaceAll("\\", "/").toLowerCase()) }, (cause, result) => cause ? reject(cause) : resolve(result));
  });
  return Object.entries(entries) as PackageFile[];
}
