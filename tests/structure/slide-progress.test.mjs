import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync('preview/archive/turbo-preview-7.13.7.html', 'utf8');
const script = html.match(/<script>\s*(const PREVIEW_BUILD[\s\S]*?)<\/script>/)[1];
const context = vm.createContext({ window: {}, console: { log() {} } });
vm.runInContext(script, context);
const engine = context.window.CSM_PREVIEW;
const bounds = { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 };
const group = (layerID, parentLayerID, name, visible = true) => ({
  layerID, parentLayerID, name, visible, itemIndex: layerID, bounds,
  layerKind: 7, layerSection: { _value: 'layerSectionStart' }
});
const shape = (layerID, parentLayerID, name) => ({
  layerID, parentLayerID, name, visible: true, itemIndex: layerID, bounds,
  layerKind: 4, fillEnabled: true, opacity: 255,
  adjustment: [{ color: { red: 40, grain: 80, blue: 120 } }]
});
function fixture(barVisible, circleVisible, progressVisible = true, dot = '') {
  const layers = [group(1, -1, '970x546'), group(2, 1, 'tabComponent'),
    group(3, 2, 'tab2', false), group(4, 3, 'rmGallery'),
    group(5, 4, 'slide1', false), shape(6, 5, 'slide-content'),
    group(10, 4, dot + 'slideProgress', progressVisible),
    group(11, 10, dot + 'progressBar', barVisible), shape(12, 11, 'bar-content'),
    group(13, 10, dot + 'circularBar', circleVisible), shape(14, 13, 'circle-content')];
  // Absence is different from the fixture helper's default true.
  if (barVisible === undefined) delete layers.find(layer => layer.layerID === 11).visible;
  return { document: { artboards: [1] }, rawLayers: layers };
}
function render(data) {
  const entry = engine.parseExport(data).artboards[0];
  return engine.collectRenderablesWithSelection(entry.model, entry.byId, entry.childrenOf,
    'tab2', 'slide1', null, entry.assetMap, entry.fontLookup, entry.masterNav, entry.videoPlaylist);
}
for (const dot of ['', '.']) {
  for (const bar of [true, false, undefined]) {
    for (const circle of [true, false]) {
      test(`progress visibility follows enabled groups: dot=${dot || 'none'}, bar=${bar}, circle=${circle}`, () => {
        const names = render(fixture(bar, circle, true, dot)).map(item => item.name);
        assert.equal(names.includes('bar-content'), bar === true);
        assert.equal(names.includes('circle-content'), circle);
        assert(names.includes('slide-content'), 'selected hidden slide/tab must still render');
      });
    }
  }
}
test('disabled slideProgress suppresses both enabled styles', () => {
  const names = render(fixture(true, true, false)).map(item => item.name);
  assert(!names.includes('bar-content'));
  assert(!names.includes('circle-content'));
});
test('missing slideProgress or circularBar visibility does not enable the control', () => {
  for (const id of [10, 13]) {
    const data = fixture(false, true);
    delete data.rawLayers.find(layer => layer.layerID === id).visible;
    assert(!render(data).some(item => item.name === 'circle-content'));
  }
});
test('ordinary dot ancestors still suppress progress and unrelated dotted controls stay excluded', () => {
  const data = fixture(true, true);
  data.rawLayers.push(group(20, 4, '.wrapper'), group(21, 20, 'slideProgress'),
    group(22, 21, 'progressBar'), shape(23, 22, 'excluded-bar'),
    group(30, 4, '.arrows'), shape(31, 30, 'excluded-arrow'),
    group(40, 4, '.circularBar'), shape(41, 40, 'unrelated-circle'));
  const names = render(data).map(item => item.name);
  assert(!names.includes('excluded-bar'));
  assert(!names.includes('excluded-arrow'));
  assert(!names.includes('unrelated-circle'));
});

// Optional local package manifests are prepared from authorized sample ZIPs.
if (process.env.SLIDE_PROGRESS_PACKAGES_JSON) {
  const packages = JSON.parse(readFileSync(process.env.SLIDE_PROGRESS_PACKAGES_JSON, 'utf8'));
  for (const { name, data } of packages) {
    test(`no disabled progress descendants render in ${name}`, () => {
      const parsed = engine.parseExport(data);
      let checked = 0;
      for (const entry of parsed.artboards) {
        for (const [tab, tabModel] of Object.entries(entry.model.tabs)) {
          const gallery = tabModel.gallery;
          const slides = gallery?.slideOrder?.length ? gallery.slideOrder : [null];
          for (const slide of slides) {
            const out = engine.collectRenderablesWithSelection(entry.model, entry.byId, entry.childrenOf,
              tab, slide, null, entry.assetMap, entry.fontLookup, entry.masterNav, entry.videoPlaylist);
            for (const item of out) {
              let layer = item.layer || entry.byId.get(item.layerId);
              const seen = new Set();
              while (layer && !seen.has(layer.layerID)) {
                seen.add(layer.layerID);
                const parent = entry.byId.get(layer.parentLayerID);
                if (/^\.?slideProgress$/i.test(layer.name || '') ||
                    (/^\.?slideProgress$/i.test(parent?.name || '') && /^\.?(progressBar|circularBar)$/i.test(layer.name || ''))) {
                  assert.equal(layer.visible, true, `${name}: disabled ${layer.name} leaked`);
                  checked++;
                }
                layer = parent;
              }
            }
          }
        }
      }
      assert(checked > 0, 'sample must exercise enabled progress artwork');
    });
  }
}
