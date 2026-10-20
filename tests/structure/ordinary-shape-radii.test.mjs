import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/archive/turbo-preview-7.9.9.html", "utf8");
const script = preview.match(/<script>\s*(const PREVIEW_BUILD[\s\S]*?)<\/script>/)[1];
class Element {
  constructor() {
    this.style = {};
    this.dataset = {};
    this.children = [];
    this.classList = { toggle() {} };
  }
  querySelectorAll() { return []; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute() {}
}
const context = vm.createContext({
  window: {},
  console: { log() {} },
  document: { createElement: () => new Element() }
});
vm.runInContext(script, context);
const engine = context.window.CSM_PREVIEW;
const production = JSON.parse(readFileSync("tests/fixtures/tryngolza-panel-production.json", "utf8"));

function shape(id, originType, corners) {
  return {
    layerID: id, parentLayerID: 1, name: "arbitrary panel", itemIndex: id,
    layerKind: 4, fillEnabled: true, opacity: 168,
    adjustment: [{ color: { red: 255, grain: 255, blue: 255 } }],
    bounds: { top: 70, left: 43, width: 217, height: 218 },
    pathBounds: { pathBounds: { top: 70, left: 43, right: 260, bottom: 288 } },
    keyOriginType: [{ keyOriginType: originType, ...(corners ? {
      keyOriginRRectRadii: Object.fromEntries(
        ["topLeft", "topRight", "bottomRight", "bottomLeft"].map((key, i) => [key, { _value: corners[i] }])
      )
    } : {}) }]
  };
}

function entryFor(...shapes) {
  const data = {
    document: { artboards: [1] },
    rawLayers: [{
      layerID: 1, parentLayerID: -1, name: "300x600", layerKind: 7,
      layerSection: { _value: "layerSectionStart" },
      bounds: { top: 0, left: 0, width: 300, height: 600 }
    }, ...shapes]
  };
  const entry = engine.parseExport(data).artboards[0];
  return { ...entry, scale: 1, stageEl: new Element(), unavailableEl: new Element() };
}

function collect(entry) {
  const { model, byId, childrenOf, assetMap, fontLookup, masterNav, videoPlaylist } = entry;
  return engine.collectRenderablesWithSelection(
    model, byId, childrenOf, null, null, assetMap, fontLookup, masterNav, videoPlaylist
  );
}

test("ordinary rounded panels retain authored radii through collection and painting", () => {
  const entry = entryFor(shape(2, 2, production.panel.cornerRadii));
  const renderable = collect(entry)[0];
  assert.equal(renderable.borderRadius, "14px 14px 14px 14px");
  assert.equal(renderable.width, 217);
  assert.equal(renderable.height, 218);
  engine.paintArtboard(entry, null, null);
  assert.equal(entry.stageEl.children[0].style.borderRadius, "14px 14px 14px 14px");
});

test("asymmetric and square corners retain their order and scale", () => {
  const entry = entryFor(shape(2, 2, [0, 8, 12, 16]));
  entry.scale = 0.5;
  engine.paintArtboard(entry, null, null);
  assert.equal(entry.stageEl.children[0].style.borderRadius, "0px 4px 6px 8px");
});

test("ellipse fallback and plain rectangles preserve their existing silhouette", () => {
  const entry = entryFor(shape(2, 5), shape(3, 1));
  const renderables = collect(entry);
  assert.equal(renderables[0].borderRadius, "9999px");
  assert.equal(renderables[1].borderRadius, null);
});

test("7.9.9 changes only the ordinary-shape radius wiring and build identifier", () => {
  const baseline = readFileSync("preview/archive/turbo-preview-7.9.8.html", "utf8");
  const expected = baseline
    .replace('const PREVIEW_BUILD = "7.9.8";', 'const PREVIEW_BUILD = "7.9.9";')
    .replace('borderRadius: isRoundShape(layer) ? "9999px" : null,', 'borderRadius: getShapeBorderRadius(layer),');
  assert.equal(preview, expected);
});
