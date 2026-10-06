import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("lib/qa-engine.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const compiledModule = { exports: {} };
new Function("exports", "module", compiled)(compiledModule.exports, compiledModule);
const { analyzePackage } = compiledModule.exports;

const group = (layerID, name, parentLayerID = -1, artboard = false) => ({
  layerID,
  name,
  parentLayerID,
  ...(artboard ? { artboard: {} } : { layerSection: { _value: "layerSectionStart" } }),
});

const text = (layerID, name, parentLayerID, shape) => ({
  layerID,
  name,
  parentLayerID,
  textKey: {
    textKey: name,
    textShape: [{ char: { _value: shape } }],
  },
});

function analyze(rawLayers) {
  return analyzePackage({ rawLayers }, [], "fixture.psd.zip");
}

test("warns when a direct CTA label uses paragraph text", () => {
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "mobile-instream", -1, true),
    group(3, "tab1", 2),
    group(4, "button1", 3),
    text(5, "DISCOVER THE DIFFERENCE", 4, "box"),
  ]);
  const finding = summary.findings.find(item => item.ruleId === "rendering.cta-paragraph-text");
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.confidence, "high");
  assert.equal(finding?.artboard, "mobile-instream");
  assert.equal(finding?.tab, "tab1");
  assert.equal(finding?.layerId, 5);
  assert.match(finding?.evidence || "", /button1.*box/);
});

test("does not warn for point-text CTA labels or paragraph text outside a CTA", () => {
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "mobile-instream", -1, true),
    group(3, "tab1", 2),
    group(4, "button1", 3),
    text(5, "DISCOVER THE DIFFERENCE", 4, "paint"),
    group(6, "CanvasDesign", 3),
    text(7, "Paragraph body copy", 6, "box"),
  ]);
  assert.equal(summary.findings.some(item => item.ruleId === "rendering.cta-paragraph-text"), false);
});

test("flags every Photoshop Shift+Enter soft return as a production rendering error", () => {
  const copy = text(5, "Results", 4, "box");
  copy.textKey.textKey = "First line\u0003second line\u0003third line";
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    group(4, "CanvasDesign", 3),
    copy,
  ]);
  const finding = summary.findings.find(item => item.ruleId === "rendering.shift-enter-soft-return");
  assert.equal(finding?.severity, "error");
  assert.equal(finding?.confidence, "high");
  assert.equal(finding?.artboard, "300x250");
  assert.equal(finding?.tab, "tab1");
  assert.equal(finding?.layerId, 5);
  assert.match(finding?.evidence || "", /2 soft returns.*U\+0003/);
  assert.equal(summary.findings.some(item => item.ruleId === "copy.unsupported-control-character"), false);
});

test("ordinary paragraph breaks are allowed and other controls retain their generic error", () => {
  const normal = text(5, "Normal copy", 4, "box");
  normal.textKey.textKey = "First paragraph\rSecond paragraph\nThird paragraph";
  const otherControl = text(6, "Other control", 4, "box");
  otherControl.textKey.textKey = "First\u0004second";
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    group(4, "CanvasDesign", 3),
    normal,
    otherControl,
  ]);
  assert.equal(summary.findings.some(item => item.ruleId === "rendering.shift-enter-soft-return"), false);
  assert.equal(summary.findings.filter(item => item.ruleId === "copy.unsupported-control-character").length, 1);
});

test("does not require disclaimer.html when the package has no ISI marker", () => {
  const summary = analyzePackage({ rawLayers: [
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
  ] }, [
    { name: "export.json" },
  ], "fixture.psd.zip");
  assert.equal(summary.findings.some(item => item.ruleId === "assets.declared-missing"), false);
});

test("requires disclaimer.html only when an ISI marker is declared", () => {
  const summary = analyzePackage({ rawLayers: [
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "isi", 2),
  ] }, [
    { name: "export.json" },
  ], "fixture.psd.zip");
  const finding = summary.findings.find(item => item.ruleId === "assets.declared-missing");
  assert.match(finding?.message || "", /disclaimer\.html/);
});

test("preserves internal filename whitespace when matching generated assets", () => {
  const summary = analyzePackage({ rawLayers: [
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    { layerID: 224139, parentLayerID: 2, name: "FOREHEAD  WRINKLES" },
  ] }, [
    { name: "export.json" },
    { name: "FOREHEAD  WRINKLES-224139.png", uncompressedSize: 100 },
  ], "fixture.psb.zip");
  assert.equal(summary.findings.some(item => item.ruleId === "assets.declared-missing"), false);
  assert.equal(summary.assets.find(item => item.name === "FOREHEAD  WRINKLES-224139.png")?.status, "referenced");
});

test("resolves declared PNG assets through the production -2x fallback", () => {
  const summary = analyzePackage({
    rawLayers: [group(1, "master", -1, true), group(2, "300x250", -1, true)],
    customAssets: [{ layerID: 3, fileName: "logo.png" }],
  }, [
    { name: "package/export.json" },
    { name: "package/logo-2x.png", uncompressedSize: 100 },
  ], "fixture.psd.zip");
  assert.equal(summary.findings.some(item => item.ruleId === "assets.declared-missing"), false);
  assert.equal(summary.assets.find(item => item.name === "logo-2x.png")?.status, "referenced");
});

test("matches trademark style ranges against raw Photoshop text indices", () => {
  const layer = text(5, "headline copy", 3, "box");
  layer.textKey.textKey = "FIRST LINE \rSECOND® ";
  layer.textKey.textStyleRange = [
    { from: 0, to: 18, textStyle: { baseline: { _value: "normal" } } },
    { from: 18, to: 19, textStyle: { baseline: { _value: "superScript" } } },
  ];
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    layer,
  ]);
  assert.equal(summary.findings.some(item => item.ruleId === "typography.trademark-superscript"), false);
});

test("treats valid CTA copy as content rather than placeholder text", () => {
  const layer = text(5, "CTA label", 3, "paint");
  layer.textKey.textKey = "LEARN MORE";
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    layer,
  ]);
  assert.equal(summary.findings.some(item => item.ruleId === "copy.default-placeholder"), false);
});

test("reports ambiguous spacing as a note rather than an issue", () => {
  const layer = text(5, "Body copy", 3, "box");
  layer.textKey.textKey = "Deliberately  spaced";
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    layer,
  ]);
  const finding = summary.findings.find(item => item.ruleId === "copy.spacing");
  assert.equal(finding?.severity, "info");
});

test("trims playlist marker syntax without normalizing asset filenames", () => {
  const summary = analyzePackage({ rawLayers: [
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    { layerID: 3, parentLayerID: 1, name: "v1 : video1.mp4 [0]" },
  ] }, [
    { name: "export.json" },
    { name: "video1.mp4", uncompressedSize: 100 },
  ], "fixture.psd.zip");
  assert.equal(summary.findings.some(item => item.ruleId === "assets.declared-missing"), false);
  assert.equal(summary.assets.find(item => item.name === "video1.mp4")?.status, "referenced");
});
