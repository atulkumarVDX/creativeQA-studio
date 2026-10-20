import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/turbo-preview-7.9.11.html", "utf8");
const start = preview.indexOf("function getPsdFontCaps");
const end = preview.indexOf("function textRangeSignature", start);
assert.ok(start >= 0 && end > start, "Photoshop presentation helpers must be present");

const context = vm.createContext({
  enumValue(value, fallback) {
    if (value && typeof value === "object" && value._value !== undefined) return value._value;
    return value === undefined || value === null ? fallback : value;
  },
  unitValue(value) {
    if (typeof value === "number") return value;
    if (value && typeof value._value === "number") return value._value;
    return null;
  }
});
vm.runInContext(preview.slice(start, end), context);

test("maps Photoshop native caps without changing the underlying copy", () => {
  assert.equal(context.getPsdFontCaps({ fontCaps: { _value: "allCaps" } }), "allCaps");
  assert.equal(context.getPsdFontCaps({ fontCaps: { _value: "smallCaps" } }), "smallCaps");
  assert.equal(context.getPsdFontCaps({ fontCaps: { _value: "normal" } }), "normal");

  const uppercase = { style: {} };
  context.applyPsdFontCaps(uppercase, "allCaps");
  assert.deepEqual(uppercase.style, { textTransform: "uppercase", fontVariantCaps: "normal" });

  const smallCaps = { style: {} };
  context.applyPsdFontCaps(smallCaps, "smallCaps");
  assert.deepEqual(smallCaps.style, { textTransform: "none", fontVariantCaps: "small-caps" });
});

test("maps implied and raw Photoshop paragraph indents per paragraph", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/photoshop-text-presentation.json", "utf8"));
  const styles = context.getPsdParagraphStyles(fixture, 2);

  assert.equal(styles.length, 2);
  assert.deepEqual({ ...styles[0] }, {
    align: "left",
    direction: "ltr",
    startIndent: 3.7,
    endIndent: 1.25,
    firstLineIndent: -1.5
  });
  assert.deepEqual({ ...styles[1] }, {
    align: "right",
    direction: "rtl",
    startIndent: 8,
    endIndent: 4,
    firstLineIndent: 2
  });
});

test("maps Shift+Enter to a production paragraph and its exported style range", () => {
  const layer = {
    textKey: {
      textKey: "First line\u0003second line",
      paragraphStyleRange: [
        { from: 0, to: 11, paragraphStyle: { align: { _value: "left" } } },
        { from: 11, to: 22, paragraphStyle: { align: { _value: "right" } } }
      ]
    }
  };
  const styles = context.getPsdParagraphStyles(layer, 1);
  assert.equal(styles.length, 2);
  assert.equal(styles[0].align, "left");
  assert.equal(styles[1].align, "right");
});

test("renders Shift+Enter as a separate paragraph while retaining its raw source character", () => {
  assert.match(preview, /split\(\/\(\\n\|\\u0003\)\/\)/);
  assert.match(preview, /fragment === "\\n" \|\| fragment === "\\u0003"/);
  assert.match(preview, /rawContent\.matchAll\(\/\\r\\n\|\\r\|\\n\|\\u0003\/g\)/);
});

test("production preview wires caps and logical indents into rendering and measurement", () => {
  assert.match(preview, /fontCaps:\s*getPsdFontCaps\(st\)/);
  assert.match(preview, /paragraphStyles:\s*getPsdParagraphStyles\(layer, sizeCorrection\)/);
  assert.match(preview, /paragraph\.style\.paddingInlineStart/);
  assert.match(preview, /paragraph\.style\.paddingInlineEnd/);
  assert.match(preview, /paragraph\.style\.textIndent/);
  assert.match(preview, /measured\.paddingLeft \+ measured\.textIndent/);
  assert.doesNotMatch(preview, /measured\.paddingLeft \+ measured\.paddingRight \+ measured\.textIndent/);
});
