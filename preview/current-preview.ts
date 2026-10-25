import previewSource from "./turbo-preview-7.13.0.html?raw";

/**
 * The single QA Studio preview release pointer.
 *
 * To promote a release, update the import, version, and path here together.
 * Historical HTML builds belong in ./archive and must never be imported here.
 */
export const currentPreview = {
  version: "7.13.0",
  path: "preview/turbo-preview-7.13.0.html",
  source: previewSource,
} as const;
