import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const preview = readFileSync("preview/turbo-preview-7.13.7.html", "utf8");
const script = preview.match(/<script>\s*(const PREVIEW_BUILD[\s\S]*?)<\/script>/)[1];
const context = vm.createContext({
  window: {},
  console: { log() {} },
  document: { createElement: () => ({ style: {}, dataset: {}, classList: { toggle() {} }, querySelectorAll() { return []; }, appendChild() {} }) }
});
vm.runInContext(script, context);
const engine = context.window.CSM_PREVIEW;

function group(layerID, parentLayerID, name, visible = true) {
  return { layerID, parentLayerID, name, itemIndex: layerID, layerKind: 7, layerSection: { _value: "layerSectionStart" }, visible, bounds: { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 } };
}
function shape(layerID, parentLayerID, name) {
  return {
    layerID, parentLayerID, name, itemIndex: layerID, layerKind: 4, visible: true,
    fillEnabled: true, opacity: 255,
    adjustment: [{ color: { red: 40, grain: 80, blue: 120 } }],
    bounds: { top: 5, left: 5, right: 25, bottom: 25, width: 20, height: 20 }
  };
}

const data = {
  document: { artboards: [1] },
  rawLayers: [
    group(1, -1, "970x546"),
    group(2, 1, "tabComponent"),
    group(3, 2, "tab2"),
    group(4, 3, "categoryGallery1"),
    group(5, 4, "home", false),
    group(6, 5, "category1"), shape(7, 6, "home-category-1"),
    group(8, 5, "category2"), shape(9, 8, "home-category-2"),
    group(10, 4, "navBar"), shape(11, 10, "home"), shape(12, 10, "prev"), shape(13, 10, "next"),
    group(20, 4, "category1"),
    group(21, 20, "slide1"), shape(22, 21, "category1-slide1-content"),
    group(23, 20, "slide2"), shape(24, 23, "category1-slide2-content"),
    group(30, 4, "category2"),
    group(31, 30, "slide1"), shape(32, 31, "category2-slide1-content")
  ]
};

const entry = engine.parseExport(data).artboards[0];
const gallery = entry.model.tabs.tab2.gallery;
function renderedNames(category, slide) {
  return engine.collectRenderablesWithSelection(
    entry.model, entry.byId, entry.childrenOf, "tab2", slide, category,
    entry.assetMap, entry.fontLookup, entry.masterNav, entry.videoPlaylist
  ).map(item => item.name);
}

test("category gallery registers a home state and numerically ordered nested categories/slides", () => {
  assert.equal(gallery.categoryMode, true);
  assert.deepEqual(Array.from(gallery.categoryOrder), ["category1", "category2"]);
  assert.deepEqual(Array.from(gallery.categories.category1.slideOrder), ["slide1", "slide2"]);
  assert.equal(gallery.homeLayerId, 5);
});

test("a missing controller category resolves to the same home state the painter renders", () => {
  const home = engine.resolveCategoryGalleryState(gallery, null, null);
  assert.equal(home.category, "home");
  assert.equal(home.slide, null);
  const firstCategory = engine.resolveCategoryGalleryState(gallery, "category1", null);
  assert.equal(firstCategory.category, "category1");
  assert.equal(firstCategory.slide, "slide1");
  const categoryNames = renderedNames(firstCategory.category, firstCategory.slide);
  assert(categoryNames.includes("category1-slide1-content"));
  assert(!categoryNames.includes("home-category-1"));
  assert(!categoryNames.includes("home-category-2"));
});

test("selected category renders only its active nested slide", () => {
  const category1Slide1 = renderedNames("category1", "slide1");
  assert(category1Slide1.includes("category1-slide1-content"));
  assert(!category1Slide1.includes("home-category-1"));
  assert(!category1Slide1.includes("home-category-2"));
  assert(!category1Slide1.some(name => name.includes("slide-content") && name !== "category1-slide1-content"));
  const category1Slide2 = renderedNames("category1", "slide2");
  assert(category1Slide2.includes("category1-slide2-content"));
  assert(!category1Slide2.includes("home-category-1"));
  assert(!category1Slide2.includes("home-category-2"));
  assert(!category1Slide2.some(name => name.includes("slide-content") && name !== "category1-slide2-content"));
  const category2Slide1 = renderedNames("category2", "slide1");
  assert(category2Slide1.includes("category2-slide1-content"));
  assert(!category2Slide1.some(name => name.includes("slide-content") && name !== "category2-slide1-content"));
});

test("home state renders category cards while hiding category slide content", () => {
  const names = renderedNames("home", null);
  assert(names.includes("home-category-1"));
  assert(names.includes("home-category-2"));
  assert(!names.some(name => name.includes("slide-content")));
});
