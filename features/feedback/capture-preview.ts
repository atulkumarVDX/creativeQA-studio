import type { FeedbackCapture } from "@/features/feedback/create-feedback-bundle";

export function captureFeedbackPreview(frame: HTMLIFrameElement | null, bridgeToken: string): Promise<FeedbackCapture> {
  return new Promise((resolve, reject) => {
    if (!frame?.contentWindow) { reject(new Error("The active preview is unavailable.")); return; }
    const requestId = crypto.randomUUID();
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", receive);
      reject(new Error("The active preview did not finish capturing."));
    }, 15000);
    function receive(event: MessageEvent) {
      if (event.data?.token !== bridgeToken || event.data?.requestId !== requestId) return;
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
    frame.contentWindow.postMessage({ type: "tqa:capture-feedback", token: bridgeToken, requestId }, "*");
  });
}
