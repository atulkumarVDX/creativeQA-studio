import { strToU8, zipSync } from "fflate";
import type { PackageAsset, PackageFile } from "@/types/package";
import type { PackageSummary } from "@/lib/qa-engine";

export type FeedbackType = "visual-mismatch" | "finding-issue" | "asset-validation" | "package-loading" | "preview-interaction" | "screenshot-export" | "app-ui" | "suggestion" | "other";
export type FeedbackEvidenceLevel = "diagnostics" | "affected-assets" | "complete-package";
export type FeedbackImageContext = "description" | "actual" | "expected";
export type FeedbackReference = { type: "ccrv" | "showcase"; url: string; creativeId: string; variant: string | null };
export type FeedbackCaptureState = {
  artboard: string;
  selectedSizes: string[];
  tab: string | null;
  slide: string | null;
  viewMode: "preview" | "compare";
  scale: string | null;
  theme: string | null;
};
export type FeedbackCapture = { dataUrl: string; state: FeedbackCaptureState };
export type FeedbackCaseStatus = "Not started" | "In progress" | "Pass" | "Fail" | "Needs improvement" | "Blocked" | "Not applicable";
export type FeedbackCase = { id: string; area: string; priority: "High" | "Medium"; name: string; status: FeedbackCaseStatus };

type FeedbackReport = {
  description: string | null;
  actualResult: string | null;
  expectedResult: string | null;
  reproductionSteps: string | null;
};

type FeedbackDiagnostics = { exportData: Record<string, unknown>; assets: PackageAsset[] };

export type FeedbackBundleInput = {
  generatedAt: string;
  build: string;
  reviewer: string;
  type: FeedbackType;
  testCase: FeedbackCase | null;
  productionReference: FeedbackReference | null;
  report: FeedbackReport;
  appState: { section: string; theme: string; previewCaptureError: string | null };
  environment: { userAgent: string; language: string; viewport: { width: number; height: number; devicePixelRatio: number } };
  summary: PackageSummary | null;
  evidenceLevel: FeedbackEvidenceLevel;
  diagnostics: FeedbackDiagnostics | null;
  capture: FeedbackCapture | null;
  screenshotRequested: boolean;
  affectedFiles: PackageFile[];
  sourcePackage: File | null;
  pastedImages: Array<{ context: FeedbackImageContext; file: File }>;
  attachments: File[];
};

function safeFilePart(value: string, fallback: string) {
  const safe = value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return !safe || safe === "." || safe === ".." ? fallback : safe;
}

function safeArchivePath(value: string) {
  return value.split(/[\\/]+/).filter(Boolean).map(part => safeFilePart(part, "file")).join("/");
}

function dataUrlToBytes(dataUrl: string) {
  const encoded = dataUrl.split(",", 2)[1];
  if (!encoded) throw new Error("The preview screenshot was empty.");
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function uniqueAttachmentName(baseName: string, usedNames: Set<string>) {
  let name = baseName;
  let suffix = 2;
  while (usedNames.has(name.toLowerCase())) {
    const dot = baseName.lastIndexOf(".");
    name = dot > 0 ? `${baseName.slice(0, dot)}-${suffix}${baseName.slice(dot)}` : `${baseName}-${suffix}`;
    suffix += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

export async function createFeedbackBundle(input: FeedbackBundleInput): Promise<{ filename: string; blob: Blob }> {
  const files: Record<string, Uint8Array> = {};
  const feedback = {
    schemaVersion: 1,
    generatedAt: input.generatedAt,
    build: input.build,
    reviewer: input.reviewer,
    type: input.type,
    testCase: input.testCase,
    productionReference: input.productionReference,
    report: input.report,
    appState: { ...input.appState, preview: input.capture?.state || null },
    environment: input.environment,
    package: input.summary ? {
      sourceFile: input.summary.sourceFile,
      creativeName: input.summary.creativeName,
      evidenceLevel: input.diagnostics ? input.evidenceLevel : null,
      completePackageIncluded: Boolean(input.sourcePackage),
      completePackageSize: input.sourcePackage?.size || null,
      affectedAssetCount: input.affectedFiles.length,
      artboards: input.summary.artboards,
      findings: input.summary.findings,
    } : null,
    evidence: {
      activePreviewScreenshot: Boolean(input.capture),
      screenshotRequested: input.screenshotRequested,
      packageDiagnostics: Boolean(input.diagnostics),
      affectedAssets: input.affectedFiles.map(([name, data]) => ({ name, size: data.byteLength })),
      sourcePackage: Boolean(input.sourcePackage),
      pastedImages: input.pastedImages.map(({ context, file }) => ({ context, name: file.name, size: file.size, type: file.type || null })),
      attachments: input.attachments.map(file => ({ name: file.name, size: file.size, type: file.type || null })),
    },
  };

  files["feedback.json"] = strToU8(JSON.stringify(feedback, null, 2));
  if (input.diagnostics) {
    files["package/diagnostics/export.json"] = strToU8(JSON.stringify(input.diagnostics.exportData, null, 2));
    files["package/diagnostics/file-inventory.json"] = strToU8(JSON.stringify(input.diagnostics.assets, null, 2));
  }
  if (input.capture) files["evidence/active-preview.png"] = dataUrlToBytes(input.capture.dataUrl);
  for (const { context, file } of input.pastedImages) {
    const folder = context === "description" ? "description" : `${context}-result`;
    files[`evidence/${folder}/${safeFilePart(file.name, `${context}-pasted.png`)}`] = new Uint8Array(await file.arrayBuffer());
  }
  for (const [name, data] of input.affectedFiles) files[`package/affected-assets/${safeArchivePath(name)}`] = data;
  if (input.sourcePackage) files[`package/${safeFilePart(input.sourcePackage.name, "source-package.zip")}`] = new Uint8Array(await input.sourcePackage.arrayBuffer());

  const usedAttachmentNames = new Set<string>();
  for (const attachment of input.attachments) {
    const name = uniqueAttachmentName(safeFilePart(attachment.name, "attachment"), usedAttachmentNames);
    files[`attachments/${name}`] = new Uint8Array(await attachment.arrayBuffer());
  }

  const archive = zipSync(files, { level: 6 });
  const archiveBuffer = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
  const creative = safeFilePart(input.summary?.creativeName || "turbo", "turbo").toLowerCase();
  const stamp = input.generatedAt.replace(/[:.]/g, "-");
  return { filename: `${creative}-feedback-${stamp}.zip`, blob: new Blob([archiveBuffer], { type: "application/zip" }) };
}
