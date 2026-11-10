// Keep workspace activity separate from browser visibility/focus. The renderer
// owns media intent, creative-tab state, source restoration and audio permission.
type PreviewWindow = Window & {
  CSM_PREVIEW?: { setPlaybackActive: (active: boolean) => void };
};

export function setPreviewPlaybackActive(frame: HTMLIFrameElement | null, active: boolean) {
  const doc = frame?.contentDocument;
  if (!doc) return;
  doc.documentElement.dataset.tqaWorkspaceActive = String(active);
  (frame?.contentWindow as PreviewWindow | null)?.CSM_PREVIEW?.setPlaybackActive(active);
}
