import type { PackageAsset } from "@/types/package";

export function isTeaserAsset(name: string) {
  const basename = name.split("/").pop() || "";
  return /^(?:video1|teaserVideo)\.(?:mp4|jpe?g)$/i.test(basename)
    || /^teaserLogo(?:-\d+)?\.png$/i.test(basename)
    || /^peelLogo(?:-\d+)?\.png$/i.test(basename)
    || /^peel-\d+\.png$/i.test(basename)
    || /^(?:ISI_)?preQual_\d+x\d+\.png$/i.test(basename)
    || /^disclaimer\.html$/i.test(basename);
}

export function selectTeaserAssetNames(assets: readonly PackageAsset[]) {
  return assets.filter(asset => isTeaserAsset(asset.name)).map(asset => asset.name);
}
