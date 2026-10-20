import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/archive/turbo-preview-7.8.19.html", "utf8");
const start = preview.indexOf("function normalizeTextNewlines");
const end = preview.indexOf("function getTextStyle", start);
assert.ok(start >= 0 && end > start, "text range helpers must be present");

const context = vm.createContext({
  enumValue(value, fallback) {
    if (value && typeof value === "object" && value._value !== undefined) return value._value;
    return value === undefined || value === null ? fallback : value;
  },
  unitValue(value) {
    if (typeof value === "number") return value;
    if (value && typeof value._value === "number") return value._value;
    return null;
  },
  rgbChannels() { return { r: 0, g: 0, b: 0 }; },
  resolveFontFamily() { return "Acumin Pro"; },
  getFontWeight() { return "400"; },
  getFontStyle() { return "normal"; },
  getKerningMode() { return "metrics"; }
});
vm.runInContext(preview.slice(start, end), context);

const copy = "Patients With Platelets <50 x 109/L Achieving ≥35% SVR From Baseline to Week 24";
const layer = {
  textKey: {
    textKey: copy,
    textStyleRange: [
      { from: 0, to: 32, textStyle: { impliedFontSize: { _value: 16 }, color: {} } },
      { from: 32, to: 33, textStyle: { impliedFontSize: { _value: 16 }, color: {}, baseline: { _value: "superScript" } } },
      { from: 33, to: 46, textStyle: { impliedFontSize: { _value: 16 }, color: {} } },
      { from: 46, to: 47, textStyle: { impliedFontSize: { _value: 16 }, color: {} } },
      { from: 47, to: copy.length, textStyle: { impliedFontSize: { _value: 16 }, color: {} } }
    ]
  }
};

test("preserves Vonjo source copy and maps character 32 as superscript", () => {
  const runs = context.getTextRuns(layer, new Map());
  assert.equal(runs.map(run => run.text).join(""), copy);
  assert.equal(runs[1].text, "9");
  assert.equal(runs[1].superscript, true);
  assert.equal(runs[1].text.length, 1);
});

test("preserves Photoshop Shift+Enter characters instead of converting them to normal line breaks", () => {
  assert.equal(
    context.normalizeTextNewlines("First paragraph\r\nnext paragraph\u0003soft return"),
    "First paragraph\nnext paragraph\u0003soft return",
  );
  assert.match(preview, /rawContent\.matchAll\(\/\\r\\n\|\\r\|\\n\|\\u0003\/g\)/);
});

test("uses one shared run-element path for paragraph and tab rendering", () => {
  assert.match(preview, /const span = createPsdTextRunElement\(run, text, scale\);/);
  assert.match(preview, /const span = createPsdTextRunElement\(run, r\.text, scale\);/);
  assert.match(preview, /span\.dataset\.psdBaseline = run\.superscript/);
});

test("inherits Photoshop auto-leading semantics instead of trusting stale numeric leading", () => {
  assert.equal(context.getPsdAutoLeading({ baseParentStyle: { autoLeading: true } }), true);
  assert.equal(context.getPsdAutoLeading({ baseParentStyle: { autoLeading: false } }), false);
  assert.equal(context.getPsdAutoLeading({ autoLeading: false, baseParentStyle: { autoLeading: true } }), false);
  assert.match(preview, /const autoLeading = getPsdAutoLeading\(style\) \|\| getPsdAutoLeading\(para\)/);
});

test("uses production-proportional superscript metrics", () => {
  assert.match(preview, /baseSize \* 0\.6/);
  assert.match(preview, /baseSize \* 0\.33/);
  assert.match(preview, /span\.style\.lineHeight = "0"/);
});

test("uses exported per-corner shape radii instead of flattening rounded rectangles into pills", () => {
  assert.match(preview, /keyOriginRRectRadii/);
  assert.match(preview, /corners\.every\(Number\.isFinite\)/);
  assert.match(preview, /scaleShapeBorderRadius\(r\.borderRadius, scale\)/);
});
