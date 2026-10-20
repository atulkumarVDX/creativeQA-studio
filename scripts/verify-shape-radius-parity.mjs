import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import vm from "node:vm";
import { unzipSync, strFromU8 } from "fflate";

// Compares collected render models, not browser pixels or font measurements.
function engineFor(version) {
  const html = readFileSync(new URL(`../preview/archive/turbo-preview-${version}.html`, import.meta.url), "utf8");
  const script = html.match(/<script>\s*(const PREVIEW_BUILD[\s\S]*?)<\/script>/)[1];
  const context = vm.createContext({ window: {}, console: { log() {} }, document: {} });
  vm.runInContext(script, context);
  return context.window.CSM_PREVIEW;
}
const baseline = engineFor("7.9.8");
const corrected = engineFor("7.9.9");
const unit = value => typeof value === "number" ? value : value?._value;
const plain = value => JSON.parse(JSON.stringify(value));
const collect = (engine, entry, tab, slide) => engine.collectRenderablesWithSelection(
  entry.model, entry.byId, entry.childrenOf, tab, slide,
  entry.assetMap, entry.fontLookup, entry.masterNav, entry.videoPlaylist
);

assert.ok(process.argv.length > 2, "Supply one or more creative ZIP paths.");
for (const file of process.argv.slice(2)) {
  const archive = unzipSync(readFileSync(file));
  const exportPath = Object.keys(archive).find(name => /(^|\/)export\.json$/.test(name));
  assert.ok(exportPath, `${file}: export.json is missing`);
  const data = JSON.parse(strFromU8(archive[exportPath]));
  const before = baseline.parseExport(data), after = corrected.parseExport(data);
  assert.equal(before.artboards.length, after.artboards.length);
  const summary = { package: basename(file), artboards: after.artboards.length, states: 0, textInstancesUnchanged: 0, shapeInstances: 0, radiusInstancesCorrected: 0 };
  const changedLayers = new Set();
  for (let board = 0; board < after.artboards.length; board++) {
    const oldEntry = before.artboards[board], newEntry = after.artboards[board];
    for (const tab of newEntry.model.tabOrder.length ? newEntry.model.tabOrder : [null]) {
      const gallery = newEntry.model.tabs[tab]?.gallery;
      const slides = gallery ? gallery.slideOrder : [null];
      for (const slide of slides) {
        summary.states++;
        const oldItems = collect(baseline, oldEntry, tab, slide);
        const newItems = collect(corrected, newEntry, tab, slide);
        assert.equal(oldItems.length, newItems.length);
        for (let index = 0; index < newItems.length; index++) {
          const oldItem = oldItems[index], newItem = newItems[index];
          const label = `${summary.package}/${newEntry.model.name}/${tab}/${slide}/${newItem.layer?.layerID}`;
          if (newItem.isShape) summary.shapeInstances++;
          if (newItem.isText) summary.textInstancesUnchanged++;
          if (oldItem.isShape && oldItem.borderRadius !== newItem.borderRadius) {
            const radii = newItem.layer?.keyOriginType?.[0]?.keyOriginRRectRadii;
            const corners = ["topLeft", "topRight", "bottomRight", "bottomLeft"].map(key => unit(radii?.[key]));
            assert.ok(corners.every(Number.isFinite), `${label}: unexpected radius change`);
            assert.equal(newItem.borderRadius, corners.map(radius => `${radius}px`).join(" "), label);
            summary.radiusInstancesCorrected++;
            changedLayers.add(newItem.layer.layerID);
          }
          const oldComparable = plain(oldItem), newComparable = plain(newItem);
          if (oldItem.isShape) oldComparable.borderRadius = newComparable.borderRadius;
          assert.deepEqual(oldComparable, newComparable, `${label}: change outside ordinary shape radius`);
        }
      }
    }
  }
  summary.uniqueShapeLayersCorrected = changedLayers.size;
  console.log(JSON.stringify(summary));
}
