import { analyzePackage, type PackageSummary } from "@/lib/qa-engine";
import { detectCtvOttFormats } from "@/features/ctv-ott/detect-package-formats";
import { createTeaserMedia, createTeaserPackageLayouts } from "@/features/teasers/package-preparation";
import type { CtvOttFormat } from "@/features/ctv-ott/render-package";
import type { PackageContents } from "@/features/package-loading/read-package";
import type { TeaserMedia, TeaserPackageLayouts } from "@/features/teasers/types";

export type PreparedPackageReview = {
  summary: PackageSummary;
  ctvOttFormats: CtvOttFormat[];
  teaserMedia: TeaserMedia;
  teaserLayouts: TeaserPackageLayouts;
  teaserLayoutUrls: string[];
  needsTeaserGeneration: boolean;
};

export function preparePackageReview(packageData: PackageContents, fileName: string, fileSize: number): PreparedPackageReview {
  const summary = analyzePackage(packageData.exportData, packageData.assets, fileName, fileSize);
  const ctvOttFormats = detectCtvOttFormats(packageData.exportData);
  const teaserMedia = createTeaserMedia(packageData.teaserBytes);
  const { layouts: teaserLayouts, urls: teaserLayoutUrls } = createTeaserPackageLayouts(packageData.exportData, packageData.packageFiles);
  const needsTeaserGeneration = summary.artboards.some(name => name.toLowerCase() === "mobile-instream")
    && !packageData.teaserBytes.instreamVideo;

  return { summary, ctvOttFormats, teaserMedia, teaserLayouts, teaserLayoutUrls, needsTeaserGeneration };
}
