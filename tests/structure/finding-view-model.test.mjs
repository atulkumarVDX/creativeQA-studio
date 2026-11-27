import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("features/findings/finding-view-model.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const featureModule = { exports: {} };
new Function("exports", "module", compiled)(featureModule.exports, featureModule);
const { countFindings, filterAssets, filterFindings, formatFindingContextLabel, getFindingFacets, groupFindings } = featureModule.exports;

function finding(overrides = {}) {
  return {
    id: "f-1", ruleId: "copy.spacing", severity: "warning", confidence: "high",
    title: "Extra spacing", message: "Review copy", category: "Copy",
    suggestedFix: "Check the spacing", reason: "Repeated spaces", ...overrides,
  };
}

function asset(overrides = {}) {
  return {
    name: "images/hero.png", compressedSize: 100, uncompressedSize: 200,
    extension: "PNG", status: "referenced", referenceCount: 1,
    firstViewScopes: ["300x250"], firstViewReason: "Artwork",
    validationErrors: [], validationWarnings: [], firstViewBudgetExcluded: false,
    ...overrides,
  };
}

test("finding filters combine severity, facets, and case-insensitive text search", () => {
  const findings = [
    finding({ id: "a", severity: "error", tab: "tab1", artboard: "300x250", title: "Missing logo" }),
    finding({ id: "b", severity: "warning", tab: "tab2", artboard: "300x600", title: "Review image", suggestedFix: "Replace logo" }),
    finding({ id: "c", severity: "info", tab: "tab2", artboard: "970x250", title: "Other note" }),
  ];
  assert.deepEqual(filterFindings(findings, {
    query: "  LOGO ", severity: "warning", category: "Copy", tab: "tab2", size: "300x600",
  }).map(item => item.id), ["b"]);
  assert.deepEqual(filterFindings(findings, {
    query: "absent", severity: "all", category: "all", tab: "all", size: "all",
  }), []);
});

test("finding groups retain layer, context, and package grouping keys", () => {
  const findings = [
    finding({ id: "a", layerId: 12, layerName: "Headline", tab: "tab1", artboard: "300x250" }),
    finding({ id: "b", layerId: 12, layerName: "Headline", tab: "tab1", artboard: "300x250" }),
    finding({ id: "c", artboard: "300x600", title: "Size note" }),
    finding({ id: "d", ruleId: "turbo.master-required", message: "No Master" }),
  ];
  assert.deepEqual(groupFindings(findings).map(group => [group.id, group.label, group.findings.length]), [
    ["layer:tab1:300x250::12", "Headline", 2],
    ["context::300x600::Size note", "300x600", 1],
    ["package:turbo.master-required:No Master", "Extra spacing", 1],
  ]);
});

test("finding facets are unique, sorted, and omit missing location values", () => {
  const facets = getFindingFacets([
    finding({ category: "Typography", tab: "tab2", artboard: "970x250" }),
    finding({ category: "Copy", tab: "tab1", artboard: "300x250" }),
    finding({ category: "Copy", tab: "tab2", artboard: "300x250" }),
    finding({ category: "Assets" }),
  ]);
  assert.deepEqual(facets, {
    categories: ["Assets", "Copy", "Typography"],
    tabs: ["tab1", "tab2"],
    sizes: ["300x250", "970x250"],
  });
});

test("asset filtering preserves all, first-view, and named-scope behavior", () => {
  const assets = [asset(), asset({ name: "fonts/brand.woff2", extension: "WOFF2", firstViewScopes: [] })];
  assert.deepEqual(filterAssets(assets, " ", "all").map(item => item.name), ["images/hero.png", "fonts/brand.woff2"]);
  assert.deepEqual(filterAssets(assets, "PNG", "first-view").map(item => item.name), ["images/hero.png"]);
  assert.deepEqual(filterAssets(assets, "brand", "300x250").map(item => item.name), []);
});

test("severity counts and context labels keep their existing presentation", () => {
  const findings = [finding({ severity: "error" }), finding({ id: "f-2", severity: "warning" }), finding({ id: "f-3", severity: "error" })];
  assert.equal(countFindings(findings, "error"), 2);
  assert.equal(formatFindingContextLabel("tabComponent-3"), "Tab 3");
  assert.equal(formatFindingContextLabel("slide_2"), "Slide 2");
  assert.equal(formatFindingContextLabel("300x250"), "300x250");
});
