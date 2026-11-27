type StyleValue = { _value?: string | number };
type PhotoshopTextStyle = {
  autoKern?: StyleValue;
  baseline?: StyleValue;
  baselineShift?: StyleValue;
  fontName?: unknown;
  fontPostScriptName?: unknown;
  [key: string]: unknown;
};
type PhotoshopTextRange = { from?: number; to?: number; textStyle?: PhotoshopTextStyle };
type PhotoshopParagraphStyle = {
  baseParentStyle?: PhotoshopParagraphStyle;
  [key: string]: unknown;
};
type PhotoshopParagraphRange = {
  from?: number;
  to?: number;
  paragraphStyle?: PhotoshopParagraphStyle;
};
type PhotoshopTextKey = {
  textKey?: string;
  textShape?: Array<{ char?: { _value?: string } }>;
  textStyleRange?: PhotoshopTextRange[];
  paragraphStyleRange?: PhotoshopParagraphRange[];
  [key: string]: unknown;
};

/** Known fields used by analysis, with an open boundary for versioned PSD descriptors. */
export type Layer = {
  layerID?: number;
  parentLayerID?: number;
  name?: string;
  visible?: boolean;
  artboard?: unknown;
  layerKind?: number;
  layerSection?: { _value?: string };
  textKey?: PhotoshopTextKey;
  smartObject?: { linked?: boolean; fileReference?: string; link?: { _path?: string } };
  [key: string]: unknown;
};

export type LayerContext = {
  layer: Layer;
  artboard: string;
  tab: string;
  slide: string;
  path: string[];
  excluded: boolean;
};

export type ZipAsset = {
  name: string;
  durationSeconds?: number;
  compressedSize?: number;
  uncompressedSize?: number;
};
