import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";

const source = readFileSync(new URL("../../features/package-workflow/prepare-package-review.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadWorkflow(dependencies) {
  const compiledModule = { exports: {} };
  const requireDependency = name => {
    if (!(name in dependencies)) throw new Error(`Unexpected package workflow dependency: ${name}`);
    return dependencies[name];
  };
  new Function("require", "module", "exports", javascript)(requireDependency, compiledModule, compiledModule.exports);
  return compiledModule.exports.preparePackageReview;
}

test("package review preparation coordinates analysis, format detection, and teaser preparation", () => {
  const calls = [];
  const packageData = {
    exportData: { rawLayers: [], document: { artboards: [] } },
    assets: [{ name: "video1.mp4" }],
    teaserBytes: { video: new Uint8Array([1]), instreamVideo: null },
    packageFiles: [["export.json", new Uint8Array([2])]],
  };
  const summary = { artboards: ["300x250", "Mobile-Instream"] };
  const teaserMedia = { video: "blob:video", generatedFrame: null };
  const teaserLayouts = { "300x250": { creative: { width: 300, height: 250 } } };
  const workflow = loadWorkflow({
    "@/lib/qa-engine": { analyzePackage(...args) { calls.push(["analyze", ...args]); return summary; } },
    "@/features/ctv-ott/detect-package-formats": { detectCtvOttFormats(data) { calls.push(["detect", data]); return ["ctv"]; } },
    "@/features/teasers/package-preparation": {
      createTeaserMedia(bytes) { calls.push(["media", bytes]); return teaserMedia; },
      createTeaserPackageLayouts(exportData, files) { calls.push(["layouts", exportData, files]); return { layouts: teaserLayouts, urls: ["blob:layout"] }; },
    },
  });

  const result = workflow(packageData, "campaign.zip", 1200);
  assert.deepEqual(result, {
    summary,
    ctvOttFormats: ["ctv"],
    teaserMedia,
    teaserLayouts,
    teaserLayoutUrls: ["blob:layout"],
    needsTeaserGeneration: true,
  });
  assert.deepEqual(calls.map(([name]) => name), ["analyze", "detect", "media", "layouts"]);
  assert.deepEqual(calls[0].slice(1), [packageData.exportData, packageData.assets, "campaign.zip", 1200]);
});

test("package review does not request generated teaser frames when they are not needed", () => {
  const workflow = loadWorkflow({
    "@/lib/qa-engine": { analyzePackage: () => ({ artboards: ["300x250"] }) },
    "@/features/ctv-ott/detect-package-formats": { detectCtvOttFormats: () => [] },
    "@/features/teasers/package-preparation": {
      createTeaserMedia: () => ({}),
      createTeaserPackageLayouts: () => ({ layouts: {}, urls: [] }),
    },
  });
  const result = workflow({ exportData: {}, assets: [], teaserBytes: { instreamVideo: null }, packageFiles: [] }, "campaign.zip", 0);
  assert.equal(result.needsTeaserGeneration, false);
});
