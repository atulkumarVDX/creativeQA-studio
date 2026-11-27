import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/page.tsx", "utf8");
const bundleService = readFileSync("features/feedback/create-feedback-bundle.ts", "utf8");
const submissionService = readFileSync("features/feedback/submit-feedback.ts", "utf8");
const feedbackDialog = readFileSync("features/feedback/feedback-dialog.tsx", "utf8");
const feedbackForm = readFileSync("features/feedback/use-feedback-form.ts", "utf8");
const feedbackCatalog = readFileSync("features/feedback/catalog.ts", "utf8");
const feedbackUtils = readFileSync("features/feedback/feedback-utils.ts", "utf8");
const previewPointer = readFileSync("preview/current-preview.ts", "utf8");
const currentPreviewPath = previewPointer.match(/path:\s*"([^"]+)"/)?.[1];
const currentPreviewVersion = previewPointer.match(/version:\s*"([^"]+)"/)?.[1];
if (!currentPreviewPath || !currentPreviewVersion) throw new Error("Could not resolve the current preview release.");
const preview = readFileSync(currentPreviewPath, "utf8");
const renderer = readFileSync("scripts/ctv-ott-renderer.mjs", "utf8");
const feedbackService = readFileSync("scripts/feedback-service.mjs", "utf8");

test("feedback is available from the existing app menu", () => {
  assert.match(page, /<DropdownMenuItem onSelect=\{openFeedback\}><MessageSquareWarning \/> Report feedback<\/DropdownMenuItem>/);
  assert.match(page, /Generate report/);
  assert.match(page, /Screenshots/);
});

test("feedback requires a production reference only for visual mismatches", () => {
  assert.match(feedbackUtils, /hostname !== "showcase\.vdx\.tv"/);
  assert.match(feedbackUtils, /const type = \/\^\\\/cc/);
  assert.match(feedbackDialog, /CCRV or Showcase URL/);
  assert.match(feedbackForm, /const requiresProductionReference = showComparisonFields/);
  assert.match(feedbackDialog, /required=\{form\.requiresProductionReference\}/);
  assert.match(feedbackDialog, /disabled=\{!form\.canCreateBundle\}/);
  assert.match(feedbackForm, /productionReference: reference/);
});

test("feedback bundle contains structured evidence and downloads locally", () => {
  assert.match(bundleService, /files\["feedback\.json"\]/);
  assert.match(bundleService, /files\["evidence\/active-preview\.png"\]/);
  assert.match(bundleService, /files\["package\/diagnostics\/export\.json"\]/);
  assert.match(bundleService, /files\["package\/diagnostics\/file-inventory\.json"\]/);
  assert.match(bundleService, /package\/affected-assets/);
  assert.match(bundleService, /files\[`package\/\$\{safeFilePart\(input\.sourcePackage\.name/);
  assert.match(bundleService, /zipSync\(files/);
  assert.match(feedbackForm, /await createFeedbackBundle\(/);
  assert.match(feedbackForm, /URL\.createObjectURL\(blob\)/);
  assert.match(feedbackForm, /link\.download = filename/);
  assert.match(feedbackDialog, /<Download \/> Download feedback bundle/);
  assert.doesNotMatch(page, /fetch\("\/api\/ctv-ott\/feedback\/upload"/);
});

test("feedback submission sends the existing metadata payload through its feature service", () => {
  assert.match(feedbackForm, /await submitFeedback\(\{/);
  assert.match(feedbackForm, /setSubmitted\(true\)/);
  assert.match(submissionService, /fetch\("\/api\/ctv-ott\/notion\/feedback-submission"/);
  assert.match(submissionService, /body: JSON\.stringify\(input\)/);
  assert.match(submissionService, /if \(!response\.ok\) throw new Error/);
});

test("package evidence is selected automatically from the feedback type", () => {
  assert.match(feedbackForm, /type === "package-loading" && sourcePackage/);
  assert.match(feedbackForm, /type === "asset-validation" && affectedAssetNames\.length > 0/);
  assert.match(feedbackDialog, /Selected automatically from the feedback type/);
  assert.match(feedbackDialog, />Automatic</);
  assert.doesNotMatch(feedbackDialog, /role="radiogroup"/);
  assert.match(feedbackForm, /evidenceLevel === "complete-package" \? sourcePackage : null/);
  assert.match(feedbackForm, /await extractPackageFiles\(sourcePackage, affectedAssetNames\)/);
});

test("download completion points the user to the manual Box upload page", () => {
  assert.match(feedbackDialog, /BOX_UPLOAD_URL = "https:\/\/exponential\.box\.com\/s\/5plrgb9ogbk7m7cyztho4yfnu8orf37s"/);
  assert.match(feedbackDialog, /: "One final step"/);
  assert.match(feedbackDialog, /: "Feedback bundle downloaded"/);
  assert.match(feedbackDialog, /Upload the ZIP to Box, then share its file link/);
  assert.match(feedbackDialog, /className="feedback-upload-button"/);
  assert.match(feedbackDialog, />Upload bundle to Box/);
  assert.match(feedbackDialog, /target="_blank" rel="noreferrer"/);
  assert.match(feedbackDialog, /form\.submitted \? "Close" : "Cancel"/);
});

test("the Box upload endpoint accepts feedback only from the local app", () => {
  assert.match(renderer, /createFeedbackService\(\{ jsonResponse \}\)/);
  assert.match(renderer, /handleFeedbackRequest\(request, response, url\)\) return/);
  assert.match(feedbackService, /return async function handleFeedbackRequest\(request, response, url\)/);
  assert.match(feedbackService, /function isTrustedFeedbackOrigin/);
  assert.match(feedbackService, /\["127\.0\.0\.1", "localhost", "::1"\]/);
  assert.match(feedbackService, /jsonResponse\(response, 403/);
  assert.match(feedbackService, /url\.pathname === "\/feedback\/upload"/);
  assert.match(feedbackService, /url\.pathname === "\/notion\/pilot-session"/);
  assert.match(feedbackService, /url\.pathname === "\/notion\/feedback-submission"/);
});

test("feedback categories cover common QA Studio issue areas", () => {
  assert.match(feedbackCatalog, /\{ value: "finding-issue", label: "Finding looks incorrect" \}/);
  assert.match(feedbackCatalog, /\{ value: "asset-validation", label: "Asset validation issue" \}/);
  assert.match(feedbackCatalog, /\{ value: "package-loading", label: "Package loading issue" \}/);
  assert.match(feedbackCatalog, /\{ value: "preview-interaction", label: "Preview interaction issue" \}/);
  assert.match(feedbackCatalog, /\{ value: "screenshot-export", label: "Screenshot or report issue" \}/);
  assert.match(feedbackDialog, /className="feedback-select"/);
  assert.match(feedbackDialog, /<ChevronDown aria-hidden="true" \/>/);
});

test("optional fields and visual comparison fields are contextual", () => {
  assert.match(feedbackForm, /const showComparisonFields = type === "visual-mismatch"/);
  assert.match(feedbackDialog, /Description \(optional\)/);
  assert.match(feedbackDialog, /Steps to reproduce \(optional\)/);
  assert.match(feedbackDialog, /\{form\.showComparisonFields && <div className="feedback-grid feedback-grid-two">/);
  assert.doesNotMatch(feedbackDialog, /Complete the summary/);
});

test("description and comparison fields accept pasted image evidence", () => {
  assert.match(feedbackDialog, /context="description"/);
  assert.match(feedbackDialog, /context="actual"/);
  assert.match(feedbackDialog, /context="expected"/);
  assert.match(feedbackDialog, /onPaste=\{event => onPaste\(context, event\)\}/);
  assert.match(bundleService, /context === "description" \? "description" : `\$\{context\}-result`/);
  assert.match(feedbackDialog, /Remove \$\{image\.file\.name\}/);
});

test("the merged current build retains the feedback-enabled host integration", () => {
  assert.ok(previewPointer.includes(currentPreviewPath));
  assert.match(preview, new RegExp(`const PREVIEW_BUILD = "${currentPreviewVersion.replaceAll(".", "\\.")}"`));
  assert.match(preview, /window\.CSM_PREVIEW_BUILD = PREVIEW_BUILD/);
});
