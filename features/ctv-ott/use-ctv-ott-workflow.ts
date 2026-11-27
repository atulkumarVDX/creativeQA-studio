import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { ctvOttRenderErrorMessage, renderCtvOttVideos, type CtvOttFormat, type CtvOttVideos } from "@/features/ctv-ott/render-package";

export type CtvOttStatus = "idle" | "rendering" | "ready" | "error" | "missing";

type CtvOttWorkflowOptions = {
  generationRequestRef: MutableRefObject<string>;
};

export function useCtvOttWorkflow({ generationRequestRef }: CtvOttWorkflowOptions) {
  const [formats, setFormats] = useState<CtvOttFormat[]>([]);
  const [videos, setVideos] = useState<CtvOttVideos>({});
  const [status, setStatus] = useState<CtvOttStatus>("idle");
  const [error, setError] = useState("");
  const objectUrlsRef = useRef<string[]>([]);

  const clearVideos = () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setVideos({});
  };

  const beginPackage = () => {
    clearVideos();
    setFormats([]);
    setStatus("idle");
    setError("");
  };

  const renderPackage = async (file: File, nextFormats: CtvOttFormat[], requestId: string) => {
    clearVideos();
    setFormats(nextFormats);
    setError("");
    if (!nextFormats.length) {
      setStatus("missing");
      setError("No supported CTV/OTT artboard was found in this package.");
      return;
    }

    setStatus("rendering");
    try {
      const nextVideos = await renderCtvOttVideos(file, nextFormats);
      if (requestId !== generationRequestRef.current) {
        Object.values(nextVideos).forEach(url => { if (url) URL.revokeObjectURL(url); });
        return;
      }
      objectUrlsRef.current = Object.values(nextVideos).filter((url): url is string => Boolean(url));
      setVideos(nextVideos);
      setStatus("ready");
    } catch (cause) {
      if (requestId !== generationRequestRef.current) return;
      setStatus("error");
      setError(ctvOttRenderErrorMessage(cause));
    }
  };

  const retry = (file: File | null) => {
    if (status !== "error" || !file || !formats.length) return;
    void renderPackage(file, formats, generationRequestRef.current);
  };

  useEffect(() => () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  return { formats, videos, status, error, beginPackage, renderPackage, retry };
}
