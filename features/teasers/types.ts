export type TeaserGeometry = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type TeaserMedia = {
  video: string | null;
  instreamVideo: string | null;
  poster: string | null;
  instreamPoster: string | null;
  generatedFrame: string | null;
  generatedVideoTarget: TeaserGeometry | null;
  logo: string | null;
  peelLogo: string | null;
  peel: string | null;
};

export type TeaserPackageLayout = {
  isi: TeaserGeometry | null;
  creative: TeaserGeometry;
  disclaimerSrcDoc: string | null;
  prequal: string | null;
  prequalWithIsi: string | null;
};

export type TeaserPackageLayouts = Record<string, TeaserPackageLayout>;

export type { TeaserBytes } from "@/types/package";
