import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("lib/teaser-order.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
new Function("exports", "module", compiled)(compiledModule.exports, compiledModule);
const { orderByMainUnitArtboards } = compiledModule.exports;

test("orders teaser sizes exactly like their matching main-unit artboards", () => {
  const sizes = [
    { id: "desktop-expandable", mainUnit: "970x546" },
    { id: "300x250", mainUnit: "300x250" },
    { id: "300x600", mainUnit: "300x600" },
    { id: "160x600", mainUnit: "160x600" },
    { id: "mobile-adhesion", mainUnit: "428x622" },
  ];

  const ordered = orderByMainUnitArtboards(
    ["160x600", "970x546", "428x622", "300x250"],
    sizes,
  );

  assert.deepEqual(ordered.map(item => item.id), [
    "160x600",
    "desktop-expandable",
    "mobile-adhesion",
    "300x250",
  ]);
});

test("ignores unsupported artboards and repeated names", () => {
  const sizes = [{ id: "300x250", mainUnit: "300x250" }];
  const ordered = orderByMainUnitArtboards(["master", "300X250", "300x250"], sizes);
  assert.deepEqual(ordered.map(item => item.id), ["300x250"]);
});
