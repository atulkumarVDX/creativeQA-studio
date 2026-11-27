import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";

const source = readFileSync(new URL("../../features/ctv-ott/detect-package-formats.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const detectionModule = { exports: {} };
new Function("require", "module", "exports", javascript)(createRequire(import.meta.url), detectionModule, detectionModule.exports);
const { detectCtvOttFormats } = detectionModule.exports;

test("CTV/OTT format detection follows visible document artboards and returns unique formats", () => {
  const result = detectCtvOttFormats({
    rawLayers: [
      { layerID: 1, name: "CTV_1920x1080" },
      { layerID: 2, name: "OTT_1920x1080" },
      { layerID: 3, name: "CTVOtt_1920x1080" },
      { layerID: 4, name: "OTT_hidden", visible: false },
      { layerID: 5, name: "other_1920x1080" },
    ],
    document: { artboards: [1, 2, 3, 4, 5] },
  });
  assert.deepEqual(result, ["ctv", "ott"]);
});

test("CTV/OTT format detection tolerates missing and malformed artboard descriptors", () => {
  assert.deepEqual(detectCtvOttFormats({}), []);
  assert.deepEqual(detectCtvOttFormats({ rawLayers: "not an array", document: { artboards: [1] } }), []);
});
