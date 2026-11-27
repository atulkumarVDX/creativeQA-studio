import type { PackageFile } from "@/types/package";
import type { PackageSummary } from "@/lib/qa-engine";
import type { FeedbackReference } from "@/features/feedback/create-feedback-bundle";

export function parseProductionReference(raw: string): FeedbackReference | null {
  try {
    const url = new URL(raw.trim());
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const hashParts = url.hash.slice(1).split("/").filter(Boolean);
    if (url.protocol !== "https:" || hostname !== "showcase.vdx.tv" || !hashParts[0]) return null;
    const type = /^\/cc(?:\/|$)/i.test(url.pathname) ? "ccrv" : "showcase";
    if (type === "showcase" && url.pathname === "/") return null;
    return { type, url: url.href, creativeId: hashParts[0], variant: hashParts[1] || null };
  } catch {
    return null;
  }
}
export function affectedPackageFiles(summary: PackageSummary | null, files: PackageFile[]) {
  if (!summary) return [];
  const findingText = summary.findings.map(finding => JSON.stringify(finding).toLowerCase()).join("\n");
  const affectedNames = new Set(summary.assets.filter(asset => {
    const normalized = asset.name.toLowerCase();
    const basename = normalized.split("/").pop() || normalized;
    return asset.validationErrors.length > 0 || asset.validationWarnings.length > 0 || asset.status === "unreferenced" || findingText.includes(normalized) || findingText.includes(basename);
  }).map(asset => asset.name.toLowerCase()));
  return files.filter(([name]) => {
    const normalized = name.replaceAll("\\", "/").toLowerCase();
    return Array.from(affectedNames).some(asset => normalized === asset || normalized.endsWith(`/${asset}`));
  });
}

export function affectedPackageAssetNames(summary: PackageSummary | null) {
  if (!summary) return [];
  const findingText = summary.findings.map(finding => JSON.stringify(finding).toLowerCase()).join("\n");
  return summary.assets.filter(asset => {
    const normalized = asset.name.toLowerCase();
    const basename = normalized.split("/").pop() || normalized;
    return asset.validationErrors.length > 0 || asset.validationWarnings.length > 0 || asset.status === "unreferenced" || findingText.includes(normalized) || findingText.includes(basename);
  }).map(asset => asset.name);
}

