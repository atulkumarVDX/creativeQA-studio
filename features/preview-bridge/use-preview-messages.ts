import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { TeaserMedia } from "@/features/teasers/types";
import type { PackageContents } from "@/features/package-loading/read-package";

type GeneratedFrame = {
  requestId: string;
  dataUrl: string;
  videoTarget: TeaserMedia["generatedVideoTarget"];
};

type PreviewMessageOptions = {
  bridgeToken: string;
  iframeRef: MutableRefObject<HTMLIFrameElement | null>;
  mapPreviewConfigRef: MutableRefObject<PackageContents["mapPreviewConfig"]>;
  captureBusyRef: MutableRefObject<boolean>;
  themeRef: MutableRefObject<"dark" | "light">;
  generationRequestRef: MutableRefObject<string>;
  generationNeededRef: MutableRefObject<boolean>;
  pendingGeneratedFrameRef: MutableRefObject<GeneratedFrame | null>;
  teaserMediaRef: MutableRefObject<TeaserMedia | null>;
  setCaptureBusy: Dispatch<SetStateAction<boolean>>;
  setPreviewSizeCount: Dispatch<SetStateAction<number | null>>;
  setTeaserMedia: Dispatch<SetStateAction<TeaserMedia | null>>;
  setTeaserGenerationStatus: Dispatch<SetStateAction<"idle" | "rendering" | "ready" | "error">>;
  setError: Dispatch<SetStateAction<string>>;
  setPreviewTheme: (frame: HTMLIFrameElement | null, theme: "dark" | "light") => void;
};

export function usePreviewMessages({
  bridgeToken,
  iframeRef,
  mapPreviewConfigRef,
  captureBusyRef,
  themeRef,
  generationRequestRef,
  generationNeededRef,
  pendingGeneratedFrameRef,
  teaserMediaRef,
  setCaptureBusy,
  setPreviewSizeCount,
  setTeaserMedia,
  setTeaserGenerationStatus,
  setError,
  setPreviewTheme,
}: PreviewMessageOptions) {
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.data?.token !== bridgeToken) return;
      if (event.data.type === "tqa:capture-state") {
        captureBusyRef.current = Boolean(event.data.busy);
        setCaptureBusy(captureBusyRef.current);
        return;
      }
      if (event.data.type === "tqa:package-meta") {
        setPreviewSizeCount(Number.isFinite(event.data.sizeCount) ? event.data.sizeCount : null);
        const requestId = generationRequestRef.current;
        if (requestId) window.setTimeout(() => iframeRef.current?.contentWindow?.postMessage({ type: "tqa:capture-mobile-instream", token: bridgeToken, requestId }, "*"), 0);
        return;
      }
      if (event.data.type === "tqa:mobile-instream-frame") {
        const requestId = String(event.data.requestId || "");
        if (requestId !== generationRequestRef.current || typeof event.data.dataUrl !== "string") return;
        const videoTarget = event.data.videoTarget && ["left", "top", "width", "height"].every(key => Number.isFinite(event.data.videoTarget[key]))
          ? event.data.videoTarget as TeaserMedia["generatedVideoTarget"]
          : null;
        pendingGeneratedFrameRef.current = { requestId, dataUrl: event.data.dataUrl, videoTarget };
        if (generationNeededRef.current) {
          setTeaserMedia(current => {
            if (!current) return current;
            const next = { ...current, generatedFrame: event.data.dataUrl, generatedVideoTarget: videoTarget };
            teaserMediaRef.current = next;
            return next;
          });
          setTeaserGenerationStatus("ready");
        }
        return;
      }
      if (event.data.type === "tqa:mobile-instream-frame-error") {
        if (String(event.data.requestId || "") === generationRequestRef.current && generationNeededRef.current) setTeaserGenerationStatus("error");
        return;
      }
      if (event.data.type === "tqa:preview-ready") {
        setPreviewTheme(iframeRef.current, themeRef.current);
        iframeRef.current?.contentWindow?.postMessage({
          type: "tqa:map-config",
          token: bridgeToken,
          config: mapPreviewConfigRef.current,
        }, "*");
      } else if (event.data.type === "tqa:preview-error") {
        setError(event.data.message || "The package could not be opened in Preview.");
      }
    };
    window.addEventListener("message", listener);
    iframeRef.current?.contentWindow?.postMessage({ type: "tqa:ping", token: bridgeToken }, "*");
    return () => window.removeEventListener("message", listener);
  }, [bridgeToken, captureBusyRef, generationNeededRef, generationRequestRef, iframeRef, mapPreviewConfigRef, pendingGeneratedFrameRef, setCaptureBusy, setError, setPreviewSizeCount, setPreviewTheme, setTeaserGenerationStatus, setTeaserMedia, teaserMediaRef, themeRef]);
}
