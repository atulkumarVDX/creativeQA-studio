import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/page.tsx", "utf8");
const previewPointer = readFileSync("preview/current-preview.ts", "utf8");
const preview = readFileSync("preview/turbo-preview-7.15.5.html", "utf8");
const renderer = readFileSync("scripts/ctv-ott-renderer.mjs", "utf8");

test("feedback is available from the existing app menu", () => {
  assert.match(page, /<DropdownMenuItem onSelect=\{openFeedback\}><MessageSquareWarning \/> Report feedback<\/DropdownMenuItem>/);
  assert.match(page, /Generate report/);
  assert.match(page, /Screenshots/);
});

test("feedback requires a production reference only for visual mismatches", () => {
  assert.match(page, /hostname !== "showcase\.vdx\.tv"/);
  assert.match(page, /const type = \/\^\\\/cc/);
  assert.match(page, /CCRV or Showcase URL/);
  assert.match(page, /const requiresProductionReference = feedbackType === "visual-mismatch"/);
  assert.match(page, /required=\{requiresProductionReference\}/);
  assert.match(page, /disabled=\{!canCreateFeedbackBundle\}/);
  assert.match(page, /productionReference: reference/);
});

test("feedback bundle contains structured evidence and downloads locally", () => {
  assert.match(page, /files\["feedback\.json"\]/);
  assert.match(page, /files\["evidence\/active-preview\.png"\]/);
  assert.match(page, /files\["package\/diagnostics\/export\.json"\]/);
  assert.match(page, /files\["package\/diagnostics\/file-inventory\.json"\]/);
  assert.match(page, /package\/affected-assets/);
  assert.match(page, /files\[`package\/\$\{safeFilePart\(packageFile\.name/);
  assert.match(page, /zipSync\(files/);
  assert.match(page, /URL\.createObjectURL\(new Blob/);
  assert.match(page, /link\.download = filename/);
  assert.match(page, /<Download \/> Download feedback bundle/);
  assert.doesNotMatch(page, /fetch\("\/api\/ctv-ott\/feedback\/upload"/);
});

test("package evidence is selected automatically from the feedback type", () => {
  assert.match(page, /feedbackType === "package-loading" && sourcePackage/);
  assert.match(page, /feedbackType === "asset-validation" && feedbackAffectedFiles\.length > 0/);
  assert.match(page, /Selected automatically from the feedback type/);
  assert.match(page, />Automatic</);
  assert.doesNotMatch(page, /role="radiogroup"/);
  assert.match(page, /feedbackEvidenceLevel === "complete-package" \? sourcePackage : null/);
});

test("download completion points the user to the manual Box upload page", () => {
  assert.match(page, /FEEDBACK_BOX_UPLOAD_URL = "https:\/\/exponential\.box\.com\/s\/5plrgb9ogbk7m7cyztho4yfnu8orf37s"/);
  assert.match(page, />One final step</);
  assert.match(page, />Feedback bundle downloaded</);
  assert.match(page, /Upload the downloaded ZIP to Box so the team can review your feedback/);
  assert.match(page, /className="feedback-upload-button"/);
  assert.match(page, />Upload bundle to Box/);
  assert.match(page, /target="_blank" rel="noreferrer"/);
  assert.match(page, /feedbackSuccess \? "Done" : "Cancel"/);
  assert.doesNotMatch(page, /feedbackSuccess \? "Close" : "Cancel"/);
});

test("the Box upload endpoint accepts feedback only from the local app", () => {
  assert.match(renderer, /function isTrustedFeedbackOrigin/);
  assert.match(renderer, /\["127\.0\.0\.1", "localhost", "::1"\]/);
  assert.match(renderer, /status[^\n]*403|jsonResponse\(response, 403/);
});

test("feedback categories cover common QA Studio issue areas", () => {
  assert.match(page, /<option value="finding-issue">Finding looks incorrect<\/option>/);
  assert.match(page, /<option value="asset-validation">Asset validation issue<\/option>/);
  assert.match(page, /<option value="package-loading">Package loading issue<\/option>/);
  assert.match(page, /<option value="preview-interaction">Preview interaction issue<\/option>/);
  assert.match(page, /<option value="screenshot-export">Screenshot or report issue<\/option>/);
  assert.match(page, /<span className="feedback-select">/);
  assert.match(page, /<ChevronDown aria-hidden="true" \/>/);
});

test("optional fields and visual comparison fields are contextual", () => {
  assert.match(page, /const showComparisonFields = feedbackType === "visual-mismatch"/);
  assert.match(page, /Description \(optional\)/);
  assert.match(page, /Steps to reproduce \(optional\)/);
  assert.match(page, /\{showComparisonFields && <div className="feedback-grid feedback-grid-two">/);
  assert.doesNotMatch(page, /Complete the summary/);
});

test("description and comparison fields accept pasted image evidence", () => {
  assert.match(page, /onPaste=\{event => pasteFeedbackImages\("description", event\)\}/);
  assert.match(page, /onPaste=\{event => pasteFeedbackImages\("actual", event\)\}/);
  assert.match(page, /onPaste=\{event => pasteFeedbackImages\("expected", event\)\}/);
  assert.match(page, /image\.context === "description" \? "description" : `\$\{image\.context\}-result`/);
  assert.match(page, /Remove \$\{image\.file\.name\}/);
});

test("the merged current build retains the feedback-enabled host integration", () => {
  assert.match(previewPointer, /turbo-preview-7\.15\.5\.html/);
  assert.match(preview, /const PREVIEW_BUILD = "7\.15\.5"/);
  assert.match(preview, /window\.CSM_PREVIEW_BUILD = PREVIEW_BUILD/);
});
