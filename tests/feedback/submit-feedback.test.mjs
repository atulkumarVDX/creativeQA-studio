import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";

const source = readFileSync(new URL("../../features/feedback/submit-feedback.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const feedbackModule = { exports: {} };
new Function("require", "module", "exports", javascript)(createRequire(import.meta.url), feedbackModule, feedbackModule.exports);
const { submitFeedback } = feedbackModule.exports;

const validSubmission = {
  reviewer: "Reviewer",
  appVersion: "7.16.0",
  package: "campaign.zip",
  feedbackType: "Visual mismatch",
  testCase: { id: "CR-01", area: "Creative rendering", priority: "High", name: "Compare preview", pass: "Looks correct", status: "In progress" },
  productionReference: "https://showcase.vdx.tv/#creative",
  description: "A visual difference",
  actualResult: "Current output",
  expectedResult: "Production output",
  reproductionSteps: "Open Preview",
  bundleFilename: "campaign-feedback.zip",
  bundleUrl: "https://exponential.box.com/file/123",
  evidenceSummary: "Package diagnostics",
  supportingFiles: ["capture.png"],
  pastedImages: ["description: pasted.png"],
};

test("feedback submission sends the typed metadata to the existing Notion endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response("{\"ok\":true}", { status: 201 });
  };
  try {
    await submitFeedback(validSubmission);
    assert.equal(request.url, "/api/ctv-ott/notion/feedback-submission");
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(request.init.body), validSubmission);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("feedback submission preserves server errors and supplies a fallback for invalid responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "The Notion database is unavailable." }, { status: 502 });
  try {
    await assert.rejects(submitFeedback(validSubmission), /The Notion database is unavailable/);
    globalThis.fetch = async () => new Response("not-json", { status: 502 });
    await assert.rejects(submitFeedback(validSubmission), /Feedback could not be shared to Notion/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
