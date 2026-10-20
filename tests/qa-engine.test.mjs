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

test("requests a production review for Mobile Instream paragraph labels without claiming disappearance", () => {
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "mobile-instream", -1, true),
    group(3, "tab1", 2),
    group(4, "button1", 3),
    text(5, "DISCOVER THE DIFFERENCE", 4, "box"),
  ]);
  const finding = summary.findings.find(item => item.ruleId === "rendering.cta-mobile-label-review");
  assert.equal(finding?.severity, "info");
  assert.equal(finding?.confidence, "medium");
  assert.equal(finding?.artboard, "mobile-instream");
  assert.equal(finding?.tab, "tab1");
  assert.equal(finding?.layerId, 5);
  assert.match(finding?.evidence || "", /button1.*box/);
  assert.match(finding?.reason || "", /not proof of disappearance/);
  assert.match(finding?.suggestedFix || "", /If the label is missing in production/);
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
  assert.equal(summary.findings.some(item => item.ruleId.startsWith("rendering.cta-")), false);
});

const ctaCases = JSON.parse(readFileSync("tests/fixtures/cta-production-cases.json", "utf8")).cases;

test("working Ipsen 160x600 paragraph labels produce no CTA rendering finding", () => {
  const fixture = ctaCases.find(item => item.name === "ipsen-working-box-labels");
  assert.deepEqual(fixture.rawLayers.filter(layer => layer.textKey?.textShape?.[0]?.char?._value === "box").map(layer => layer.layerID).sort(), [215583, 224443]);
  const findings = analyze(fixture.rawLayers).findings;
  assert.equal(findings.some(finding => finding.ruleId.startsWith("rendering.cta-")), false);
  assert.equal(findings.some(finding => finding.ruleId.startsWith("structure.cta-")), false);
});

test("original Tryptry retains one scoped review and leaves the working labels clear", () => {
  const fixture = ctaCases.find(item => item.name === "tryptry-original-mobile");
  const findings = analyze(fixture.rawLayers).findings.filter(finding => finding.ruleId.startsWith("rendering.cta-") || finding.ruleId.startsWith("structure.cta-"));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "rendering.cta-mobile-label-review");
  assert.equal(findings[0].layerId, 188168);
  assert.equal(findings[0].severity, "info");
});

test("later Tryptry reports its ignored image even when the same copy exists in another tab", () => {
  const fixture = ctaCases.find(item => item.name === "tryptry-later-mobile");
  const findings = analyze(fixture.rawLayers).findings.filter(finding => finding.ruleId.startsWith("structure.cta-") || finding.ruleId.startsWith("rendering.cta-"));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].ruleId, "structure.cta-ignored-image");
  assert.equal(findings[0].layerId, 187831);
  assert.equal(findings[0].artboard, "mobile-instream");
  assert.equal(findings[0].tab, "tab1");
  assert.equal(findings[0].severity, "warning");
  assert.equal(findings[0].confidence, "high");
  assert.match(findings[0].title, /copy_new/);
  assert.match(findings[0].reason, /page 6/);
});

test("CTA image contracts preserve backgrounds, generator names and retina companions", () => {
  const valid = ["background", "background 2x", "background 2xl", "background + cta.svg", "background + cta.png8", "frame"];
  for (const name of valid) {
    const findings = analyze([group(1, "master", -1, true), group(2, "300x250", -1, true), group(3, "tab1", 2), group(4, "button1", 3), { layerID: 5, parentLayerID: 4, name, layerKind: 5 }]).findings;
    assert.equal(findings.some(finding => finding.ruleId === "structure.cta-ignored-image"), false, name);
  }
});

test("CTA checks exclude logo actions, JumpTo actions, unrelated names and excluded subtrees", () => {
  for (const name of ["button-clientLogo", "button-jump1 [tabComponent-2]", "cta", "btn1", "my button1", ".button1"]) {
    const findings = analyze([group(1, "master", -1, true), group(2, "mobile-instream", -1, true), group(3, "tab1", 2), group(4, name, 3), text(5, "Copy", 4, "box"), { layerID: 6, parentLayerID: 4, name: "artwork", layerKind: 5 }]).findings;
    assert.equal(findings.some(finding => /^(?:structure|rendering)\.cta-/.test(finding.ruleId)), false, name);
  }
  for (const owner of ["locationMap", "plugShareMap", ".excluded"]) {
    const findings = analyze([group(1, "master", -1, true), group(2, "mobile-instream", -1, true), group(3, owner, 2), group(4, "button1", 3), text(5, "Copy", 4, "box"), { layerID: 6, parentLayerID: 4, name: "pin", layerKind: 5 }]).findings;
    assert.equal(findings.some(finding => /^(?:structure|rendering)\.cta-/.test(finding.ruleId)), false, owner);
  }
});

test("text layers have arbitrary names and image-only backgrounds do not imply a missing label", () => {
  const findings = analyze([group(1, "master", -1, true), group(2, "300x250", -1, true), group(3, "tab1", 2), group(4, "button1", 3), text(5, "Arbitrary label", 4, "box"), { layerID: 6, parentLayerID: 4, name: "background", layerKind: 5 }, group(7, "button2", 3), { layerID: 8, parentLayerID: 7, name: "background", layerKind: 1 }]).findings;
  assert.equal(findings.some(finding => /^(?:structure|rendering)\.cta-/.test(finding.ruleId)), false);
});

test("does not flag a Shift+Enter break with no paragraph spacing", () => {
  const copy = text(5, "Results", 4, "box");
  copy.textKey.textKey = "First line\u0003second line\u0003third line";
  copy.textKey.paragraphStyleRange = [
    { from: 0, to: 11, paragraphStyle: { spaceAfter: { _unit: "pointsUnit", _value: 0 } } },
    { from: 11, to: 23, paragraphStyle: { impliedSpaceAfter: { _unit: "pointsUnit", _value: 0 } } },
    { from: 23, to: 34, paragraphStyle: { spaceAfter: { _unit: "pointsUnit", _value: 0 } } },
  ];
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    group(4, "CanvasDesign", 3),
    copy,
  ]);
  assert.equal(summary.findings.some(item => item.ruleId === "rendering.shift-enter-soft-return"), false);
  assert.equal(summary.findings.some(item => item.ruleId === "copy.unsupported-control-character"), false);
});

test("warns when paragraph spacing follows a Photoshop Shift+Enter break", () => {
  const copy = text(5, "Results", 4, "box");
  copy.textKey.textKey = "First line\u0003second line";
  copy.textKey.paragraphStyleRange = [
    { from: 0, to: 11, paragraphStyle: { spaceAfter: { _value: 0 } } },
    { from: 11, to: 22, paragraphStyle: { spaceAfter: { _value: 4.5 } } },
  ];
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    group(4, "CanvasDesign", 3),
    copy,
  ]);
  const finding = summary.findings.find(item => item.ruleId === "rendering.shift-enter-soft-return");
  assert.equal(finding?.severity, "warning");
  assert.equal(finding?.confidence, "medium");
  assert.equal(finding?.layerId, 5);
  assert.match(finding?.evidence || "", /1 Shift\+Enter break followed by nonzero paragraph spacing/);
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
  assert.deepEqual(finding?.highlight, { prefix: "Deliberately", value: "··", suffix: "spaced" });
});

test("treats trailing Photoshop padding as a low-priority line-end note", () => {
  const layer = text(5, "Reference copy", 3, "box");
  layer.textKey.textKey = "PBC=primary biliary cholangitis.  \r";
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    layer,
  ]);
  const spacing = summary.findings.filter(item => item.ruleId.startsWith("copy."));
  assert.equal(spacing.length, 1);
  assert.equal(spacing[0].ruleId, "copy.line-end-spacing");
  assert.equal(spacing[0].severity, "info");
  assert.equal(spacing[0].confidence, "medium");
  assert.match(spacing[0].title, /may be intentional/);
  assert.deepEqual(spacing[0].highlight, { prefix: "PBC=primary·biliary·cholangitis.", value: "··", suffix: "↵" });
});

test("does not treat ordinary line-ending padding as an internal spacing issue", () => {
  const layer = text(5, "Title", 3, "paint");
  layer.textKey.textKey = "Impact of Fatigue  ";
  const summary = analyze([
    group(1, "master", -1, true),
    group(2, "300x250", -1, true),
    group(3, "tab1", 2),
    layer,
  ]);
  assert.equal(summary.findings.some(item => item.ruleId === "copy.spacing"), false);
  assert.equal(summary.findings.find(item => item.ruleId === "copy.line-end-spacing")?.severity, "info");
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

test("first-view budgets deduplicate artwork, include rollover states, and exclude later tabs, video and posters", () => {
  const data = { rawLayers: [group(1, "master", -1, true), group(2, "300x250", -1, true), group(3, "tab1", 2), group(4, "tab2", 2),
    { layerID: 5, parentLayerID: 3, name: "normal" }, { layerID: 6, parentLayerID: 3, name: "hover", visible: false },
    { layerID: 7, parentLayerID: 4, name: "later" }], customAssets: [{ layerID: 5, fileName: "shared.png" }, { layerID: 6, fileName: "shared.png" }] };
  const assets = [{ name: "shared.png", uncompressedSize: 500 * 1024 }, { name: "later-7.png", uncompressedSize: 100000 },
    { name: "video1.mp4", uncompressedSize: 3000000 }, { name: "video1.jpg", uncompressedSize: 90000 }];
  const summary = analyzePackage(data, assets, "test.zip");
  assert.equal(summary.firstViews[0].totalBytes, 512000);
  assert.equal(summary.firstViews[0].status, "over-limit");
  assert.equal(summary.assets.find(a => a.name === "later-7.png").firstViewScopes.length, 0);
  assert.deepEqual(summary.assets.find(a => a.name === "video1.jpg").firstViewScopes, ["300x250"]);
  assert.deepEqual(summary.assets.find(a => a.name === "video1.mp4").firstViewScopes, ["300x250"]);
  assert.ok(summary.assets.find(a => a.name === "video1.mp4").validationWarnings.length);
  assert.ok(summary.assets.find(a => a.name === "shared.png").validationErrors.length);
  assert.ok(summary.findings.filter(f => f.ruleId === "assets.first-view-budget").every(f => f.severity === "error"));
  assert.ok(summary.findings.some(f => f.ruleId === "assets.primary-video-size"));
  assert.ok(summary.findings.some(f => f.ruleId === "assets.first-view-budget"));
});

test("logo maximum is inclusive, shared dependencies count per size, and smaller estimates never claim pass", () => {
  const data = { rawLayers: [group(1, "master", -1, true), group(2, "300x250", -1, true), group(3, "970x250", -1, true)] };
  const summary = analyzePackage(data, [{ name: "teaserLogo.png", uncompressedSize: 10240 }, { name: "assets/style.css", uncompressedSize: 100 }], "test.zip");
  assert.deepEqual(summary.firstViews.map(v => v.totalBytes), [10340, 10340]);
  assert.ok(summary.firstViews.every(v => v.status === "review"));
  assert.equal(summary.findings.some(f => f.ruleId === "assets.teaser-logo-size"), false);
  const oversize = analyzePackage(data, [{ name: "teaserLogo.png", uncompressedSize: 10241 }], "test.zip");
  assert.ok(oversize.findings.some(f => f.ruleId === "assets.teaser-logo-size"));
});

test("primary video size follows the v1 marker without a 30-second duration failure", () => {
  const summary = analyzePackage({rawLayers: [group(1, "master", -1, true), group(2, "300x250", -1, true),
    { layerID: 3, parentLayerID: 1, name: "v1 : media/long-form.mp4 [0]", duration: 60 }]},
    [{ name: "media/long-form.mp4", uncompressedSize: 2621441 }], "test.zip");
  assert.ok(summary.findings.some(f => f.ruleId === "assets.primary-video-size"));
  assert.ok(summary.findings.some(f => f.ruleId === "assets.primary-video-duration-unavailable"));
});


test("video duration boundaries use warnings above 30 seconds and errors above 270", () => {
  for (const [durationSeconds, expected] of [[30, null], [30.01, "warning"], [270, "warning"], [270.01, "error"]]) {
    const summary = analyzePackage({rawLayers: []}, [{name: "video1.mp4", uncompressedSize: 2621441, durationSeconds}], "test.zip");
    assert.equal(summary.findings.find(f => f.ruleId === "assets.primary-video-duration")?.severity || null, expected);
    assert.equal(summary.findings.find(f => f.ruleId === "assets.primary-video-size").severity, "warning");
    const asset = summary.assets[0];
    assert.equal(asset.validationErrors.length, expected === "error" ? 1 : 0);
    assert.ok(asset.validationWarnings.length);
  }
});
