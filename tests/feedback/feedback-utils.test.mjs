import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";

const source = readFileSync(new URL("../../features/feedback/feedback-utils.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiledModule = { exports: {} };
new Function("require", "module", "exports", javascript)(() => { throw new Error("Unexpected runtime dependency"); }, compiledModule, compiledModule.exports);
const { parseProductionReference, affectedPackageFiles } = compiledModule.exports;

test("production references accept supported CCRV and Showcase URLs only", () => {
  assert.deepEqual(parseProductionReference("https://showcase.vdx.tv/cc#creative-1/variant-a"), {
    type: "ccrv", url: "https://showcase.vdx.tv/cc#creative-1/variant-a", creativeId: "creative-1", variant: "variant-a",
  });
  assert.equal(parseProductionReference("https://www.showcase.vdx.tv/campaign#creative-2").type, "showcase");
  for (const invalid of ["http://showcase.vdx.tv/campaign#id", "https://showcase.vdx.tv/#id", "https://example.com/campaign#id", "https://showcase.vdx.tv/campaign"]) {
    assert.equal(parseProductionReference(invalid), null);
  }
});
test("affected package evidence selects only files tied to package findings or asset warnings", () => {
  const summary = {
    findings: [{ message: "creative/bad.png failed validation" }],
    assets: [
      { name: "creative/bad.png", validationErrors: [], validationWarnings: [], status: "valid" },
      { name: "warn.mp4", validationErrors: [], validationWarnings: ["duration"], status: "valid" },
      { name: "unused.jpg", validationErrors: [], validationWarnings: [], status: "unreferenced" },
      { name: "good.png", validationErrors: [], validationWarnings: [], status: "valid" },
    ],
  };
  const files = ["creative/bad.png", "other/bad.png", "warn.mp4", "unused.jpg", "good.png"].map(name => [name, new Uint8Array([1])]);
  assert.deepEqual(affectedPackageFiles(summary, files).map(([name]) => name), ["creative/bad.png", "warn.mp4", "unused.jpg"]);
  assert.deepEqual(affectedPackageFiles(null, files), []);
});
