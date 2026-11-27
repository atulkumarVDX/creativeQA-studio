import previewSource from "./turbo-preview-7.16.13.html?raw";

/**
 * The single QA Studio preview release pointer.
 *
 * To promote a release, update the import, version, and path here together.
 * Superseded HTML remains where the build inventory records it and is never
 * imported here.
 */
export const currentPreview = {
  version: "7.16.13",
  path: "preview/turbo-preview-7.16.13.html",
  source: previewSource,
} as const;
