import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";
import { strFromU8, unzipSync } from "fflate";

const source = readFileSync(new URL("../../features/feedback/create-feedback-bundle.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const bundleModule = { exports: {} };
new Function("require", "module", "exports", javascript)(createRequire(import.meta.url), bundleModule, bundleModule.exports);
const { createFeedbackBundle } = bundleModule.exports;

test("feedback bundle preserves metadata and packages selected evidence safely", async () => {
  const assetBytes = new Uint8Array([1, 2, 3]);
  const generatedAt = "2026-11-24T12:34:56.000Z";
  const { filename, blob } = await createFeedbackBundle({
    generatedAt,
    build: "7.16.0",
    reviewer: "Reviewer",
    type: "visual-mismatch",
    testCase: { id: "CR-01", area: "Creative rendering", priority: "High", name: "Compare preview", status: "In progress" },
    productionReference: { type: "showcase", url: "https://showcase.vdx.tv/#creative", creativeId: "creative", variant: null },
    report: { description: "Description", actualResult: "Actual", expectedResult: "Expected", reproductionSteps: "Open the preview" },
    appState: { section: "preview", theme: "dark", previewCaptureError: null },
    environment: { userAgent: "test browser", language: "en", viewport: { width: 1280, height: 800, devicePixelRatio: 2 } },
    summary: { sourceFile: "source.zip", creativeName: "My Campaign", artboards: ["300x250"], findings: [] },
    evidenceLevel: "affected-assets",
    diagnostics: { exportData: { name: "campaign" }, assets: [{ name: "assets/logo.png", compressedSize: 2, uncompressedSize: assetBytes.byteLength }] },
    capture: {
      dataUrl: "data:image/png;base64,aGVsbG8=",
      state: { artboard: "300x250", selectedSizes: ["300x250"], tab: null, slide: null, viewMode: "compare", scale: "1×", theme: "dark" },
    },
    screenshotRequested: true,
    affectedFiles: [["../assets/../logo.png", assetBytes]],
    sourcePackage: null,
    pastedImages: [
      { context: "description", file: new File(["description image"], "context.png", { type: "image/png" }) },
      { context: "actual", file: new File(["actual image"], "actual.png", { type: "image/png" }) },
    ],
    attachments: [
      new File(["first"], "Capture.PNG", { type: "image/png" }),
      new File(["second"], "capture.png", { type: "image/png" }),
    ],
  });

  assert.equal(filename, "my-campaign-feedback-2026-11-24T12-34-56-000Z.zip");
  assert.equal(blob.type, "application/zip");
  const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const feedback = JSON.parse(strFromU8(archive["feedback.json"]));
  assert.equal(feedback.build, "7.16.0");
  assert.deepEqual(feedback.appState.preview.selectedSizes, ["300x250"]);
  assert.equal(feedback.package.evidenceLevel, "affected-assets");
  assert.deepEqual(feedback.evidence.pastedImages.map(image => image.context), ["description", "actual"]);
  assert.ok(archive["evidence/active-preview.png"]);
  assert.ok(archive["evidence/description/context.png"]);
  assert.ok(archive["evidence/actual-result/actual.png"]);
  assert.ok(archive["package/diagnostics/export.json"]);
  assert.deepEqual(JSON.parse(strFromU8(archive["package/diagnostics/export.json"])), { name: "campaign" });
  assert.deepEqual(JSON.parse(strFromU8(archive["package/diagnostics/file-inventory.json"])), [{ name: "assets/logo.png", compressedSize: 2, uncompressedSize: 3 }]);
  assert.ok(archive["package/affected-assets/file/assets/file/logo.png"]);
  assert.ok(archive["attachments/Capture.PNG"]);
  assert.ok(archive["attachments/capture-2.png"]);
});

test("feedback bundle rejects an empty active-preview screenshot", async () => {
  await assert.rejects(createFeedbackBundle({
    generatedAt: "2026-11-24T12:34:56.000Z",
    build: "7.16.0",
    reviewer: "Reviewer",
    type: "suggestion",
    testCase: null,
    productionReference: null,
    report: { description: null, actualResult: null, expectedResult: null, reproductionSteps: null },
    appState: { section: "overview", theme: "dark", previewCaptureError: null },
    environment: { userAgent: "test", language: "en", viewport: { width: 1, height: 1, devicePixelRatio: 1 } },
    summary: null,
    evidenceLevel: "diagnostics",
    diagnostics: null,
    capture: { dataUrl: "data:image/png;base64,", state: { artboard: "", selectedSizes: [], tab: null, slide: null, viewMode: "compare", scale: null, theme: null } },
    screenshotRequested: true,
    affectedFiles: [],
    sourcePackage: null,
    pastedImages: [],
    attachments: [],
  }), /preview screenshot was empty/);
});
