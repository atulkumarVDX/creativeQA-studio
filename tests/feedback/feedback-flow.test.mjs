import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("app/page.tsx", "utf8");
const previewPointer = readFileSync("preview/current-preview.ts", "utf8");
const preview = readFileSync("preview/turbo-preview-7.12.0.html", "utf8");

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

test("feedback bundle contains structured evidence without uploading it", () => {
  assert.match(page, /files\["feedback\.json"\]/);
  assert.match(page, /files\["evidence\/active-preview\.png"\]/);
  assert.match(page, /files\[`package\/\$\{safeFilePart\(packageFile\.name/);
  assert.match(page, /zipSync\(files/);
  assert.match(page, /Nothing is uploaded; a ZIP is prepared locally/);
  assert.doesNotMatch(page, /fetch\([^\n]+feedback/i);
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
  assert.match(previewPointer, /turbo-preview-7\.12\.0\.html/);
  assert.match(preview, /const PREVIEW_BUILD = "7\.12\.0"/);
  assert.match(preview, /window\.CSM_PREVIEW_BUILD = PREVIEW_BUILD/);
});
