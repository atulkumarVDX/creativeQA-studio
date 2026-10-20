import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/archive/turbo-preview-7.9.8.html", "utf8");
const baseline = readFileSync("preview/archive/turbo-preview-7.9.7.html", "utf8");
const start = preview.indexOf("function textBoundsOf");
const end = preview.indexOf("const UNDERLINE_EPSILON_PX", start);
assert.ok(start >= 0 && end > start, "paragraph text geometry helpers must be present");

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

function rectangle(top, left, width, height) {
  return { top, left, width, height, right: left + width, bottom: top + height };
}

function paragraphLayer(overrides = {}) {
  return {
    bounds: rectangle(401, 57, 192, 109),
    boundingBox: rectangle(403, 57, 196, 120),
    textKey: {
      textShape: [{
        char: { _value: "box" },
        bounds: { top: 0, left: 0, right: 282.9640197753906, bottom: 174.0973358154297 },
        transform: { xx: 1, xy: 0, yx: 0, yy: 1 }
      }],
      transform: { xx: 0.6911681789690685, xy: 0, yx: 0, yy: 0.6911681789690685 }
    },
    ...overrides
  };
}

test("paragraph text retains the existing tight host even when its design frame is corroborated", () => {
  assert.deepEqual({ ...context.textBoundsOf(paragraphLayer()) }, {
    top: 401,
    left: 57,
    width: 192,
    height: 109
  });
});

test("point text retains its tight painted bounds", () => {
  const layer = paragraphLayer();
  layer.textKey.textShape[0].char = { _value: "point" };
  assert.deepEqual({ ...context.textBoundsOf(layer) }, {
    top: 401,
    left: 57,
    width: 192,
    height: 109
  });
});

test("rotated or inconsistent box descriptors retain tight bounds", () => {
  const rotated = paragraphLayer();
  rotated.textKey.transform.xy = 0.15;
  assert.equal(context.textBoundsOf(rotated).width, 192);

  const inconsistent = paragraphLayer({ boundingBox: rectangle(403, 57, 260, 120) });
  assert.equal(context.textBoundsOf(inconsistent).width, 192);
});

test("centered copy uses its painted position and dimensions despite a much larger paragraph frame", () => {
  const ink = rectangle(172, 2762, 608, 56);
  const layer = paragraphLayer({
    bounds: ink,
    boundingBox: rectangle(172, 2747, 639, 87)
  });
  assert.deepEqual({ ...context.textBoundsOf(layer) }, {
    top: ink.top,
    left: ink.left,
    width: ink.width,
    height: ink.height
  });
});

test("corrected 7.9.8 restores the entire 7.9.7 renderer, changing only its build identifier", () => {
  const normalizeBuild = html => html.replace(/const PREVIEW_BUILD = "7\.9\.[78]";/, "const PREVIEW_BUILD = \"baseline\";");
  assert.equal(normalizeBuild(preview), normalizeBuild(baseline));
});

test("patch build identifies itself as 7.9.8", () => {
  assert.match(preview, /const PREVIEW_BUILD = "7\.9\.8"/);
});
