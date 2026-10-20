import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/turbo-preview-7.9.11.html", "utf8");
const start = preview.indexOf("function mobileExpandableSiblingFrame");
const end = preview.indexOf("function buildArtboardEl", start);
assert.ok(start >= 0 && end > start, "responsive positioning functions must be present");

test("paintArtboard defines its mobile-expandable mode before painting video layers", () => {
  const paintStart = preview.indexOf("paintArtboard: function (entry, activeTab, activeSlide)");
  assert.ok(paintStart >= 0, "paintArtboard must be present");
  const paintPrelude = preview.slice(paintStart, preview.indexOf("stageEl.querySelectorAll", paintStart));
  assert.match(paintPrelude, /const isMobileExpandable = model\.name\.toLowerCase\(\) === [\"']428x622[\"']/);
});

test("responsive expanded preview clips the authored stage through a narrow host viewport", () => {
  const buildStart = preview.indexOf("function buildArtboardEl");
  const buildEnd = preview.indexOf("// Renders every leaf", buildStart);
  const buildSource = preview.slice(buildStart, buildEnd);

  assert.match(buildSource, /stage\.style\.width = \(model\.width \* scale\) \+ \"px\"/);
  assert.match(buildSource, /if \(mobileExpandableResponsive\) \{[\s\S]*viewport\.style\.width = \(MOBILE_EXPANDABLE_VIEWPORT_WIDTH \* scale\)/);
  assert.match(buildSource, /close\.style\.left = \(MOBILE_EXPANDABLE_VIEWPORT_WIDTH - 30\) \+ \"px\"/);
  assert.match(buildSource, /label\.textContent = mobileExpandableResponsive[\s\S]*MOBILE_EXPANDABLE_VIEWPORT_WIDTH/);
  assert.match(buildSource, /stage\.style\.overflow = \"hidden\"/);
  assert.doesNotMatch(buildSource, /stage\.style\.overflowY = \"auto\"/);
  assert.match(preview, /const isExpandableBackground = entry\.mobileExpandableResponsive/);
  assert.match(preview, /img\.style\.height = isExpandableBackground[\s\S]*?"auto"/);
});

const context = vm.createContext({
  MOBILE_EXPANDABLE_SOURCE_WIDTH: 428,
  MOBILE_EXPANDABLE_VIEWPORT_WIDTH: 375,
  boundsOf: layer => layer?.bounds || null,
  controlRoleForName: name => /^(arrows|circularbar)$/i.test(name || "") ? name.toLowerCase() : null,
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

test("375px mobile-expandable view recentres the middle cluster and preserves its gap", () => {
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

  assert.equal(shape.left, 96.5);
  assert.equal(text.left, 125.5);
  assert.equal(text.left - (shape.left + shape.width), 16);
});

test("375px mobile-expandable view centre-pins a formerly left-edge leaf", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const leftPinned = context.mobileExpandableHorizontalBox(entry, {
    layer: { ...fixture.shape, bounds: { ...fixture.shape.bounds, left: 0, width: 40 } },
    left: 0,
    width: 40,
  });

  assert.deepEqual({ ...leftPinned }, { left: -26.5, width: 40 });
});

test("375px mobile-expandable view centre-pins oversized tab backgrounds", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const background = context.mobileExpandableHorizontalBox(entry, {
    layer: { name: "background" },
    left: 0,
    width: 445,
  });

  assert.deepEqual({ ...background }, { left: -26.5, width: 445 });
});

test("375px mobile-expandable view shifts arrows with the centred pair", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const arrows = {
    layerID: 77,
    parentLayerID: fixture.slide.layerID,
    name: "arrows",
    bounds: { left: 4721, top: 0, width: 428, height: 622 },
  };
  const arrow = {
    layerID: 78,
    parentLayerID: arrows.layerID,
    name: "left",
    bounds: { left: 4747, top: 458, width: 16, height: 24 },
  };
  entry.byId.set(arrows.layerID, arrows);
  entry.byId.set(arrow.layerID, arrow);

  const box = context.mobileExpandableHorizontalBox(entry, {
    layer: arrow,
    left: 26,
    width: 16,
  });
  assert.deepEqual({ ...box }, { left: -0.5, width: 16 });
});

test("375px mobile-expandable view keeps the circular bar edge-responsive", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const circularBar = {
    layerID: 87,
    parentLayerID: fixture.slide.layerID,
    name: "circularBar",
  };
  const indicator = {
    layerID: 88,
    parentLayerID: circularBar.layerID,
    name: "indicator",
  };
  entry.byId.set(circularBar.layerID, circularBar);
  entry.byId.set(indicator.layerID, indicator);

  const box = context.mobileExpandableHorizontalBox(entry, {
    layer: indicator,
    left: 16,
    width: 40,
  });
  assert.deepEqual({ ...box }, { left: 16, width: 40 });
});

test("375px mobile-expandable view centre-pins a centered circular bar", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const circularBar = { layerID: 89, parentLayerID: fixture.slide.layerID, name: "circularBar" };
  const indicator = { layerID: 90, parentLayerID: circularBar.layerID, name: "indicator" };
  entry.byId.set(circularBar.layerID, circularBar);
  entry.byId.set(indicator.layerID, indicator);

  const box = context.mobileExpandableHorizontalBox(entry, {
    layer: indicator,
    left: 194,
    width: 40,
  });
  assert.deepEqual({ ...box }, { left: 167.5, width: 40 });
});

test("375px mobile-expandable view preserves a right-anchored circular bar gap", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const circularBar = { layerID: 91, parentLayerID: fixture.slide.layerID, name: "circularBar" };
  const indicator = { layerID: 92, parentLayerID: circularBar.layerID, name: "indicator" };
  entry.byId.set(circularBar.layerID, circularBar);
  entry.byId.set(indicator.layerID, indicator);

  const box = context.mobileExpandableHorizontalBox(entry, {
    layer: indicator,
    left: 381,
    width: 33,
  });
  assert.deepEqual({ ...box }, { left: 328, width: 33 });
  assert.equal(375 - (box.left + box.width), 14);
});

test("375px mobile-expandable view contracts a full-width video", () => {
  const entry = entryFor(JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8")));
  const video = context.mobileExpandableVideoBox(entry, {
    left: 0,
    width: 428,
    height: 241,
  });

  assert.deepEqual({ ...video }, { left: 0, width: 375, height: 211.15654205607476 });
});

test("375px mobile-expandable view centre-pins a contained video", () => {
  const entry = entryFor(JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8")));
  const video = context.mobileExpandableVideoBox(entry, {
    left: 58,
    width: 312,
    height: 177,
  });

  assert.deepEqual({ ...video }, { left: 31.5, width: 312, height: 177 });
  assert.equal(video.left + video.width / 2, 187.5);
});

test("375px mobile-expandable view gives ISI a real responsive width", () => {
  const entry = entryFor(JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8")));
  const isi = context.mobileExpandableIsiBox(entry, { left: 0, width: 428 });
  assert.deepEqual({ ...isi }, { left: 0, width: 375 });
});

test("preview controls use selected entries instead of exposing unavailable slides", () => {
  assert.match(preview, /function controlEntries\(\)/);
  assert.match(preview, /controlEntries\(\)\.forEach\(e => e\.model\.tabOrder/);
  assert.match(preview, /controlEntries\(\)\.forEach\(e => \{[\s\S]*?tab\.gallery\.slideOrder/);
  assert.match(preview, /if \(!tabs\.includes\(activeTab\)\) activeTab = tabs\[0\] \|\| null/);
});

test("375px mobile-expandable view applies the video delta once to sibling subtrees", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  const tab = {
    layerID: 80,
    parentLayerID: fixture.artboard.layerID,
    name: "tab1",
    bounds: { left: 4721, top: 266, width: 428, height: 356 },
  };
  const video = {
    layerID: 89,
    parentLayerID: tab.layerID,
    name: "video [v1]",
    bounds: { left: 4721, top: 266, width: 428, height: 241 },
  };
  const content = {
    layerID: 90,
    parentLayerID: tab.layerID,
    name: "CanvasDesign",
    bounds: { left: 4721, top: 507, width: 428, height: 115 },
  };
  const contentText = {
    layerID: 91,
    parentLayerID: content.layerID,
    name: "Post-video copy",
    bounds: { left: 4750, top: 520, width: 200, height: 40 },
  };
  for (const layer of [tab, video, content, contentText]) entry.byId.set(layer.layerID, layer);
  entry.childrenOf.set(tab.layerID, [content, video]);
  entry.childrenOf.set(content.layerID, [contentText]);

  assert.equal(context.mobileExpandableVideoFlowDelta(entry, { layer: video }), 0);
  assert.equal(context.mobileExpandableVideoFlowDelta(entry, { layer: content }), -30);
  assert.equal(context.mobileExpandableVideoFlowDelta(entry, { layer: contentText }), -30);
  assert.equal(context.mobileExpandableVerticalTop(entry, { layer: content }, 507), 477);
  assert.equal(context.mobileExpandableVerticalTop(entry, { layer: contentText }, 520), 490);
  assert.equal(490 - 477, 13, "descendant spacing remains unchanged inside the shifted wrapper");
});

test("375px mobile-expandable video flow does not shift unrelated branches", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture);
  assert.equal(context.mobileExpandableVideoFlowDelta(entry, { layer: fixture.text }), 0);
  assert.equal(context.mobileExpandableVerticalTop(entry, { layer: fixture.text }, 458), 458);
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

test("unrelated leaves use the shared centre-pinned offset", () => {
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
  assert.equal(box.left, 252.5);
  assert.equal(box.width, 100);
});

test("expanded mobile video contracts to the 375px responsive viewport", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture, true);
  const box = context.mobileExpandableVideoBox(entry, {
    left: 0,
    width: 428,
    height: 241,
  });

  assert.deepEqual({ ...box }, { left: 0, width: 375, height: 211.15654205607476 });
});

test("original expanded mobile video retains authored width", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/mobile-expandable-text-accent.json", "utf8"));
  const entry = entryFor(fixture, false);
  const box = context.mobileExpandableVideoBox(entry, {
    left: 0,
    width: 428,
    height: 241,
  });

  assert.deepEqual({ ...box }, { left: 0, width: 428, height: 241 });
});
