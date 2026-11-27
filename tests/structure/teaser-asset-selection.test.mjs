import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../../features/teasers/select-assets.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
new Function("exports", "module", javascript)(compiledModule.exports, compiledModule);
const { isTeaserAsset, selectTeaserAssetNames } = compiledModule.exports;

test("teaser asset selection recognizes package media and layout evidence by basename", () => {
  for (const name of ["video1.mp4", "nested/teaserVideo.JPG", "teaserLogo-2.png", "peelLogo.png", "peel-1.png", "ISI_preQual_300x250.png", "disclaimer.html"]) {
    assert.equal(isTeaserAsset(name), true, `${name} should be loaded for Teasers`);
  }
  for (const name of ["video2.mp4", "logo.svg", "preQual_300x250.jpg", "unrelated/disclaimer.txt"]) {
    assert.equal(isTeaserAsset(name), false, `${name} should stay out of the Teasers extraction`);
  }
});

test("package asset metadata is reduced to the names needed by Teasers", () => {
  const assets = ["video1.mp4", "index.html", "folder/teaserLogo.png"].map(name => ({ name, compressedSize: 10, uncompressedSize: 20 }));
  assert.deepEqual(selectTeaserAssetNames(assets), ["video1.mp4", "folder/teaserLogo.png"]);
});
