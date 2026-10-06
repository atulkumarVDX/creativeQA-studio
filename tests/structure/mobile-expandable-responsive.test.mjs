import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/turbo-preview-7.8.4.html", "utf8");
const start = preview.indexOf("function mobileExpandableSiblingFrame");
const end = preview.indexOf("function buildArtboardEl", start);
assert.ok(start >= 0 && end > start, "responsive positioning functions must be present");

test("paintArtboard defines its mobile-expandable mode before painting video layers", () => {
  const paintStart = preview.indexOf("paintArtboard: function (entry, activeTab, activeSlide)");
  assert.ok(paintStart >= 0, "paintArtboard must be present");
  const paintPrelude = preview.slice(paintStart, preview.indexOf("stageEl.querySelectorAll", paintStart));
  assert.match(paintPrelude, /const isMobileExpandable = model\.name\.toLowerCase\(\) === [\"']428x622[\"']/);
});

const context = vm.createContext({
  MOBILE_EXPANDABLE_SOURCE_WIDTH: 428,
  MOBILE_EXPANDABLE_VIEWPORT_WIDTH: 375,
  boundsOf: layer => layer?.bounds || null,
  controlRoleForName: () => null,
});
vm.runInContext(preview.slice(start, end), context);

function entryFor(fixture, responsive = true) {
  const layers = [fixture.artboard, fixture.slide, fixture.shape, fixture.text];
  const byId = new Map(layers.map(layer => [layer.layerID, layer]));
  const childrenOf = new Map();
  for (const layer of layers) {
    if (!childrenOf.has(layer.parentLayerID)) childrenOf.set(layer.parentLayerID, []);
    childrenOf.get(layer.parentLayerID).push(layer);
  }
  return {
    model: { rootLayerId: fixture.artboard.layerID, originLeft: 4721, width: 428 },
    byId,
    childrenOf,
    mobileExpandableResponsive: responsive,
  };
}

test("375px mobile-expandable view preserves authored positions and the source gap", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const shape = context.mobileExpandableHorizontalBox(entry, {
    layer: fixture.shape,
    left: 123,
    width: 13,
  });
  const text = context.mobileExpandableHorizontalBox(entry, {
    layer: fixture.text,
    left: 152,
    width: 192,
  });

  assert.equal(shape.left, 123);
  assert.equal(text.left, 152);
  assert.equal(text.left - (shape.left + shape.width), 16);
});

test("original 428px view retains authored positions without responsive offsets", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture, false);
  const shape = context.mobileExpandableHorizontalBox(entry, {
    layer: fixture.shape,
    left: 123,
    width: 13,
  });
  const text = context.mobileExpandableHorizontalBox(entry, {
    layer: fixture.text,
    left: 152,
    width: 192,
  });

  assert.deepEqual({ ...shape }, { left: 123, width: 13 });
  assert.deepEqual({ ...text }, { left: 152, width: 192 });
  assert.equal(text.left - (shape.left + shape.width), 16);
});

test("unrelated leaves retain their existing independent pinning", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const unrelatedText = {
    layerID: 99,
    parentLayerID: fixture.slide.layerID,
    name: "Unrelated copy",
    layerKind: 3,
    visible: true,
    bounds: { left: 5000, top: 100, width: 100, height: 20 },
  };
  entry.byId.set(unrelatedText.layerID, unrelatedText);
  entry.childrenOf.get(fixture.slide.layerID).push(unrelatedText);

  const box = context.mobileExpandableHorizontalBox(entry, {
    layer: unrelatedText,
    left: 279,
    width: 100,
  });
  assert.equal(box.left, 226);
  assert.equal(box.width, 100);
});

test("expanded mobile video keeps authored width while the 375px viewport clips it", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture, true);
  const box = context.mobileExpandableVideoBox(entry, {
    left: 0,
    width: 428,
  });

  assert.deepEqual({ ...box }, { left: 0, width: 428 });
});

test("original expanded mobile video retains authored width", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture, false);
  const box = context.mobileExpandableVideoBox(entry, {
    left: 0,
    width: 428,
  });

  assert.deepEqual({ ...box }, { left: 0, width: 428 });
});
