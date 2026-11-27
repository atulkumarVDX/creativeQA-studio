export type PackageFile = readonly [string, Uint8Array];

export type PackageAsset = {
  durationSeconds?: number;
  name: string;
  compressedSize: number;
  uncompressedSize: number;
};

/** Package bytes used by teaser preview creation after lazy extraction. */
export type TeaserBytes = {
  video: Uint8Array | null;
  instreamVideo: Uint8Array | null;
  poster: Uint8Array | null;
  instreamPoster: Uint8Array | null;
  logo: Uint8Array | null;
  peelLogo: Uint8Array | null;
  peel: Uint8Array | null;
};

export type PackageFont = {
  fontFamily?: unknown;
  fileName?: unknown;
};

export type PackageCustomAsset = {
  fileName?: unknown;
  layerID?: unknown;
};

/**
 * Top-level export contract consumed by QA Studio. Raw Photoshop descriptors
 * remain unknown at this boundary because their nested schema varies by export.
 */
export type PackageExportData = {
  rawLayers?: unknown;
  customAssets?: unknown;
  fonts?: unknown;
  document?: {
    artboards?: unknown;
    title?: unknown;
    name?: unknown;
    [key: string]: unknown;
  } | null;
  templateVersion?: unknown;
  pluginVersion?: unknown;
  [key: string]: unknown;
};
