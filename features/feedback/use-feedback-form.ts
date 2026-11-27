import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { createFeedbackBundle, type FeedbackCapture, type FeedbackCaseStatus, type FeedbackEvidenceLevel, type FeedbackImageContext, type FeedbackType } from "@/features/feedback/create-feedback-bundle";
import { submitFeedback } from "@/features/feedback/submit-feedback";
import { FEEDBACK_TEST_CASES, FEEDBACK_TYPE_AREAS, FEEDBACK_TYPE_LABELS } from "@/features/feedback/catalog";
import { affectedPackageAssetNames, parseProductionReference } from "@/features/feedback/feedback-utils";
import { extractPackageFiles } from "@/features/package-loading/read-package";
import { strToU8 } from "fflate";
import type { FeedbackInlineImage, FeedbackPackageData } from "@/features/feedback/types";
import { formatBytes, type PackageSummary } from "@/lib/qa-engine";

type FeedbackFormOptions = {
  summary: PackageSummary | null;
  sourcePackage: File | null;
  packageData: FeedbackPackageData;
  activeTab: string;
  theme: string;
  build: string;
  capturePreview: () => Promise<FeedbackCapture>;
};

export function useFeedbackForm({ summary, sourcePackage, packageData, activeTab, theme, build, capturePreview }: FeedbackFormOptions) {
  const [reviewerName, setReviewerName] = useState("");
  const [caseId, setCaseId] = useState("");
  const [caseStatus, setCaseStatus] = useState<FeedbackCaseStatus>("Not started");
  const [shareOpen, setShareOpen] = useState(false);
  const [bundleUrl, setBundleUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [type, setType] = useState<FeedbackType>("visual-mismatch");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [actual, setActual] = useState("");
  const [expected, setExpected] = useState("");
  const [steps, setSteps] = useState("");
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [inlineImages, setInlineImages] = useState<FeedbackInlineImage[]>([]);
  const inlineImagesRef = useRef<FeedbackInlineImage[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [preparing, setPreparing] = useState(false);

  const productionReference = useMemo(() => parseProductionReference(referenceUrl), [referenceUrl]);
  const showComparisonFields = type === "visual-mismatch";
  const requiresProductionReference = showComparisonFields;
  const productionReferenceInvalid = referenceUrl.trim().length > 0 && !productionReference;
  const selectedCase = FEEDBACK_TEST_CASES.find(testCase => testCase.id === caseId) || null;
  const relatedCases = useMemo(() => {
    const areas = FEEDBACK_TYPE_AREAS[type] || [];
    return FEEDBACK_TEST_CASES.filter(testCase => areas.includes(testCase.area));
  }, [type]);
  const sortedCases = useMemo(() => [...relatedCases, ...FEEDBACK_TEST_CASES.filter(testCase => !relatedCases.some(related => related.id === testCase.id))], [relatedCases]);
  const canCreateBundle = !preparing && !success && Boolean(reviewerName.trim()) && (!caseId || caseStatus !== "Not started") && !productionReferenceInvalid && (!requiresProductionReference || Boolean(productionReference));
  const parsedBundleUrl = useMemo(() => {
    try { const parsed = new URL(bundleUrl.trim()); return parsed.protocol === "https:" && (parsed.hostname === "box.com" || parsed.hostname.endsWith(".box.com")) ? parsed.href : ""; } catch { return ""; }
  }, [bundleUrl]);
  const affectedAssetNames = useMemo(() => affectedPackageAssetNames(summary), [summary]);
  const diagnosticsSize = useMemo(() => packageData ? strToU8(JSON.stringify({ exportData: packageData.exportData, assets: packageData.assets })).byteLength : 0, [packageData]);
  const evidenceLevel: FeedbackEvidenceLevel = type === "package-loading" && sourcePackage ? "complete-package" : type === "asset-validation" && affectedAssetNames.length > 0 ? "affected-assets" : "diagnostics";
  const evidenceSummary = !sourcePackage ? "No package evidence available" : evidenceLevel === "complete-package" ? `Complete package · ${formatBytes(sourcePackage.size)}` : evidenceLevel === "affected-assets" ? `Package diagnostics + ${affectedAssetNames.length} flagged ${affectedAssetNames.length === 1 ? "file" : "files"}` : `Package diagnostics · about ${formatBytes(diagnosticsSize)}`;

  useEffect(() => { inlineImagesRef.current = inlineImages; }, [inlineImages]);
  useEffect(() => () => inlineImagesRef.current.forEach(image => URL.revokeObjectURL(image.previewUrl)), []);
  const resetSubmissionState = () => {
    setError("");
    setSuccess("");
    setShareOpen(false);
    setBundleUrl("");
    setSubmitted(false);
  };

  const pasteImages = (context: FeedbackImageContext, event: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(event.clipboardData.items).filter(item => item.kind === "file" && item.type.startsWith("image/")).map(item => item.getAsFile()).filter((file): file is File => Boolean(file));
    if (!images.length) return;
    event.preventDefault();
    setInlineImages(current => {
      const existingCount = current.filter(image => image.context === context).length;
      const pasted = images.map((image, index) => {
        const extension = image.type === "image/jpeg" ? "jpg" : image.type === "image/webp" ? "webp" : image.type === "image/gif" ? "gif" : "png";
        const file = new File([image], `${context}-pasted-${existingCount + index + 1}.${extension}`, { type: image.type, lastModified: Date.now() });
        return { id: crypto.randomUUID(), context, file, previewUrl: URL.createObjectURL(file) };
      });
      return [...current, ...pasted];
    });
  };

  const removeImage = (id: string) => setInlineImages(current => {
    const removed = current.find(image => image.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    return current.filter(image => image.id !== id);
  });

  const downloadBundle = async () => {
    const referenceInput = referenceUrl.trim();
    const reference = referenceInput ? parseProductionReference(referenceInput) : null;
    if (referenceInput && !reference) { setError("Enter a valid CCRV or Showcase URL from showcase.vdx.tv, including its # creative ID."); return; }
    if (requiresProductionReference && !reference) { setError("Add a CCRV or Showcase URL to compare this visual mismatch with production."); return; }
    setPreparing(true); setError(""); setSuccess("");
    try {
      const capture = includeScreenshot && summary ? await capturePreview().catch(cause => ({ error: cause instanceof Error ? cause.message : String(cause) })) : null;
      const captureResult = capture && "dataUrl" in capture ? capture : null;
      const captureError = capture && "error" in capture ? capture.error : null;
      const sourcePackageFile = evidenceLevel === "complete-package" ? sourcePackage : null;
      const includedAffectedFiles = evidenceLevel === "affected-assets" && sourcePackage ? await extractPackageFiles(sourcePackage, affectedAssetNames) : [];
      const { filename, blob } = await createFeedbackBundle({
        generatedAt: new Date().toISOString(), build, reviewer: reviewerName.trim(), type,
        testCase: selectedCase ? { id: selectedCase.id, area: selectedCase.area, priority: selectedCase.priority, name: selectedCase.name, status: caseStatus } : null,
        productionReference: reference,
        report: { description: description.trim() || null, actualResult: actual.trim() || null, expectedResult: expected.trim() || null, reproductionSteps: steps.trim() || null },
        appState: { section: activeTab, theme, previewCaptureError: captureError },
        environment: { userAgent: navigator.userAgent, language: navigator.language, viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio } },
        summary, evidenceLevel, diagnostics: packageData, capture: captureResult, screenshotRequested: includeScreenshot,
        affectedFiles: includedAffectedFiles, sourcePackage: sourcePackageFile,
        pastedImages: inlineImages.map(({ context: imageContext, file }) => ({ context: imageContext, file })), attachments,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setSuccess(filename);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setPreparing(false); }
  };

  const submit = async () => {
    if (!success) return;
    if (!parsedBundleUrl) { setError("Paste a valid HTTPS Box file link before sharing feedback."); return; }
    setSubmitting(true); setError("");
    try {
      await submitFeedback({
        reviewer: reviewerName.trim(), appVersion: build, package: summary?.sourceFile || "Not recorded",
        feedbackType: FEEDBACK_TYPE_LABELS[type], testCase: selectedCase ? { ...selectedCase, status: caseStatus } : null,
        productionReference: referenceUrl.trim(), description: description.trim(), actualResult: actual.trim(), expectedResult: expected.trim(), reproductionSteps: steps.trim(),
        bundleFilename: success, bundleUrl: parsedBundleUrl, evidenceSummary,
        supportingFiles: attachments.map(file => file.name), pastedImages: inlineImages.map(image => `${image.context}: ${image.file.name}`),
      });
      setSubmitted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Feedback could not be shared to Notion."); }
    finally { setSubmitting(false); }
  };

  return {
    reviewerName, setReviewerName, caseId, setCaseId, caseStatus, setCaseStatus, shareOpen, setShareOpen, bundleUrl, setBundleUrl,
    submitting, submitted, type, setType, referenceUrl, setReferenceUrl, description, setDescription, actual, setActual,
    expected, setExpected, steps, setSteps, includeScreenshot, setIncludeScreenshot, attachments, setAttachments,
    inlineImages, error, success, preparing, productionReference, showComparisonFields, requiresProductionReference,
    productionReferenceInvalid, selectedCase, relatedCases, sortedCases, canCreateBundle, parsedBundleUrl, evidenceLevel,
    evidenceSummary, pasteImages, removeImage, downloadBundle, submit, resetSubmissionState,
  };
}
