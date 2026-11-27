export type CtvOttFormat = "ctv" | "ott";
export type CtvOttVideos = Partial<Record<CtvOttFormat, string>>;

const RENDERER_BASE = "/api/ctv-ott";

type RenderErrorResponse = { error?: unknown };

function errorFromResponse(body: unknown) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as RenderErrorResponse).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return "the package did not contain the required CTV/OTT assets.";
}

export async function renderCtvOttVideos(file: File, formats: readonly CtvOttFormat[]): Promise<CtvOttVideos> {
  const health = await fetch(`${RENDERER_BASE}/health`, { cache: "no-store" });
  if (!health.ok) throw new Error("The local FFmpeg renderer is unavailable.");

  const rendered = await Promise.all(formats.map(async format => {
    const response = await fetch(`${RENDERER_BASE}/render?format=${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/zip", "X-Package-Name": file.name },
      body: file,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(`${format.toUpperCase()} render failed: ${errorFromResponse(body)}`);
    }
    return [format, await response.blob()] as const;
  }));

  const objectUrls: string[] = [];
  try {
    const videos = rendered.map(([format, blob]) => {
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      return [format, url] as const;
    });
    return Object.fromEntries(videos) as CtvOttVideos;
  } catch (error) {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  }
}

export function ctvOttRenderErrorMessage(cause: unknown) {
  return cause instanceof TypeError || /NetworkError|Failed to fetch/i.test(String(cause))
    ? "The local FFmpeg renderer is unavailable. Start QA Studio with npm run dev, then reopen the package."
    : cause instanceof Error ? cause.message : String(cause);
}
