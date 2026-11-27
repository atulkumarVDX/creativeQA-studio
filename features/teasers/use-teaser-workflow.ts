import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { extractPackageFiles } from "@/features/package-loading/read-package";
import { createTeaserMedia, createTeaserPackageLayouts } from "@/features/teasers/package-preparation";
import { selectTeaserAssetNames } from "@/features/teasers/select-assets";
import type { PackageAsset, PackageExportData } from "@/types/package";
import type { TeaserMedia, TeaserPackageLayouts } from "./types";

type TeaserPackageSource = {
  file: File;
  exportData: PackageExportData;
  assets: PackageAsset[];
};

type PreparedTeaserPackage = {
  media: TeaserMedia;
  layouts: TeaserPackageLayouts;
  layoutUrls: string[];
  needsGeneration: boolean;
  hasVideo: boolean;
};

type GeneratedFrame = {
  requestId: string;
  dataUrl: string;
  videoTarget: TeaserMedia["generatedVideoTarget"];
};

type TeaserGenerationStatus = "idle" | "rendering" | "ready" | "error";

type TeaserWorkflowOptions = {
  bridgeToken: string;
  iframeRef: MutableRefObject<HTMLIFrameElement | null>;
  sourcePackage: File | null;
  generationRequestRef: MutableRefObject<string>;
  setError: Dispatch<SetStateAction<string>>;
};

function revokeMediaUrls(media: TeaserMedia | null) {
  if (!media) return;
  Object.values(media).forEach(url => {
    if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url);
  });
}

export function useTeaserWorkflow({
  bridgeToken,
  iframeRef,
  sourcePackage,
  generationRequestRef,
  setError,
}: TeaserWorkflowOptions) {
  const [teaserMedia, setTeaserMedia] = useState<TeaserMedia | null>(null);
  const teaserMediaRef = useRef<TeaserMedia | null>(null);
  const [teaserLayouts, setTeaserLayouts] = useState<TeaserPackageLayouts>({});
  const teaserLayoutUrlsRef = useRef<string[]>([]);
  const teaserPackageRef = useRef<TeaserPackageSource | null>(null);
  const teaserLoadInFlightRef = useRef(false);
  const generationNeededRef = useRef(false);
  const targetRefreshRequestRef = useRef("");
  const pendingGeneratedFrameRef = useRef<GeneratedFrame | null>(null);
  const [teaserGenerationStatus, setTeaserGenerationStatus] = useState<TeaserGenerationStatus>("idle");

  const beginPackage = () => {
    teaserPackageRef.current = null;
    generationNeededRef.current = false;
    targetRefreshRequestRef.current = "";
    pendingGeneratedFrameRef.current = null;
    setTeaserGenerationStatus("idle");
  };

  const setPackageSource = (source: TeaserPackageSource) => {
    teaserPackageRef.current = source;
  };

  const applyPreparedPackage = ({ media, layouts, layoutUrls, needsGeneration, hasVideo }: PreparedTeaserPackage) => {
    revokeMediaUrls(teaserMediaRef.current);
    teaserLayoutUrlsRef.current.forEach(url => URL.revokeObjectURL(url));

    generationNeededRef.current = Boolean(needsGeneration && hasVideo);
    const pendingFrame = pendingGeneratedFrameRef.current;
    const nextMedia = generationNeededRef.current && pendingFrame?.requestId === generationRequestRef.current
      ? { ...media, generatedFrame: pendingFrame.dataUrl, generatedVideoTarget: pendingFrame.videoTarget }
      : media;

    teaserMediaRef.current = nextMedia;
    teaserLayoutUrlsRef.current = layoutUrls;
    setTeaserMedia(nextMedia);
    setTeaserLayouts(layouts);
    setTeaserGenerationStatus(!needsGeneration ? "idle" : !hasVideo ? "error" : nextMedia.generatedFrame ? "ready" : "rendering");

    if (generationNeededRef.current) {
      iframeRef.current?.contentWindow?.postMessage({
        type: "tqa:capture-mobile-instream",
        token: bridgeToken,
        requestId: generationRequestRef.current,
      }, "*");
    }
  };

  const loadTeaserAssets = async () => {
    const source = teaserPackageRef.current;
    if (!source || teaserLoadInFlightRef.current || teaserMediaRef.current?.video) return;
    teaserLoadInFlightRef.current = true;
    setTeaserGenerationStatus("rendering");
    try {
      const files = await extractPackageFiles(source.file, selectTeaserAssetNames(source.assets));
      const pick = (pattern: RegExp) => files.filter(([name]) => pattern.test(name.split("/").pop() || "")).sort(([a], [b]) => a.length - b.length)[0]?.[1] || null;
      const media = createTeaserMedia({
        video: pick(/^video1\.mp4$/i), instreamVideo: pick(/^teaserVideo\.mp4$/i),
        poster: pick(/^video1\.jpe?g$/i), instreamPoster: pick(/^teaserVideo\.jpe?g$/i),
        logo: pick(/^teaserLogo(?:-\d+)?\.png$/i), peelLogo: pick(/^peelLogo(?:-\d+)?\.png$/i), peel: pick(/^peel-\d+\.png$/i),
      });
      const { layouts, urls } = createTeaserPackageLayouts(source.exportData, files);
      applyPreparedPackage({
        media,
        layouts,
        layoutUrls: urls,
        needsGeneration: Array.isArray(source.exportData.document?.artboards)
          && source.exportData.document.artboards.some(artboard => String((artboard as { name?: unknown })?.name || "").toLowerCase() === "mobile-instream")
          && !media.instreamVideo,
        hasVideo: Boolean(media.video),
      });
    } catch (cause) {
      setTeaserGenerationStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      teaserLoadInFlightRef.current = false;
    }
  };

  useEffect(() => {
    const requestId = generationRequestRef.current;
    const media = teaserMedia;
    if (!sourcePackage || !generationNeededRef.current || !media?.generatedFrame || media.generatedVideoTarget || targetRefreshRequestRef.current === requestId) return;
    targetRefreshRequestRef.current = requestId;
    iframeRef.current?.contentWindow?.postMessage({ type: "tqa:capture-mobile-instream", token: bridgeToken, requestId }, "*");
  }, [bridgeToken, generationRequestRef, iframeRef, sourcePackage, teaserMedia]);

  useEffect(() => () => {
    revokeMediaUrls(teaserMediaRef.current);
    teaserLayoutUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  return {
    teaserMedia,
    teaserMediaRef,
    teaserLayouts,
    teaserGenerationStatus,
    generationNeededRef,
    pendingGeneratedFrameRef,
    beginPackage,
    setPackageSource,
    applyPreparedPackage,
    loadTeaserAssets,
    setTeaserMedia,
    setTeaserGenerationStatus,
  };
}
