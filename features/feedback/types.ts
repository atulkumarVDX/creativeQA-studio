import type { PackageAsset } from "@/types/package";
import type { FeedbackImageContext } from "@/features/feedback/create-feedback-bundle";

export type FeedbackPackageData = { exportData: Record<string, unknown>; assets: PackageAsset[] } | null;
export type FeedbackInlineImage = { id: string; context: FeedbackImageContext; file: File; previewUrl: string };
