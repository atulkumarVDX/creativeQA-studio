import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/turbo-preview-7.15.5.html", "utf8");
const start = preview.indexOf("function getPsdFontCaps");
const end = preview.indexOf("function textRangeSignature", start);
assert.ok(start >= 0 && end > start, "Photoshop paragraph helpers must be present");

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

test("maps Photoshop paragraph spacing and inherited values", () => {
  const layer = {
    textKey: {
      textKey: "First paragraph\rSecond paragraph",
      paragraphStyleRange: [
        {
          from: 0,
          to: 16,
          paragraphStyle: {
            spaceBefore: { _value: 5 },
            spaceAfter: { _value: 3 }
          }
        },
        {
          from: 16,
          to: 32,
          paragraphStyle: {
            baseParentStyle: {
              impliedSpaceBefore: { _value: 2.5 },
              impliedSpaceAfter: { _value: 1.5 }
            }
          }
        }
      ]
    }
  };
  const styles = context.getPsdParagraphStyles(layer, 1);
  assert.equal(styles.length, 2);
  assert.equal(styles[0].spaceBefore, 5);
  assert.equal(styles[0].spaceAfter, 3);
  assert.equal(styles[1].spaceBefore, 2.5);
  assert.equal(styles[1].spaceAfter, 1.5);
});

test("applies paragraph spacing instead of resetting every paragraph margin", () => {
  assert.match(preview, /paragraph\.style\.marginBlockStart/);
  assert.match(preview, /paragraph\.style\.marginBlockEnd/);
  assert.match(preview, /paragraph\.style\.marginInline/);
});
