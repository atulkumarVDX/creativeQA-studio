import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync('preview/turbo-preview-7.13.7.html', 'utf8');
const script = html.match(/<script>\s*(const PREVIEW_BUILD[\s\S]*?)<\/script>/)[1];
const context = vm.createContext({ window: {}, console: { log() {} } });
vm.runInContext(script, context);
const engine = context.window.CSM_PREVIEW;

function fixture(offset = 0) {
  const scope = { layerID: offset + 1, parentLayerID: -1, name: 'rmGallery' };
  const progress = { layerID: offset + 2, parentLayerID: scope.layerID, name: 'slideProgress' };
  const circle = { layerID: offset + 3, parentLayerID: progress.layerID, name: 'circularBar' };
  const layers = [scope, progress, circle];
  const icon = (kind, id) => {
    const layer = { layerID: offset + id, parentLayerID: circle.layerID, name: kind };
    layers.push(layer);
    return { layer, isControlCircularIcon: true, controlIcon: kind.toLowerCase(), width: 14, height: 18 };
  };
  const play = icon('playIcon', 4), mute = icon('muteIcon', 5), unmute = icon('unmuteIcon', 6);
  const videoLayer = { layerID: offset + 7, parentLayerID: scope.layerID, name: 'video [v1]' };
  layers.push(videoLayer);
  return { layers, icons: [play, mute, unmute], play, mute, unmute, video: { layer: videoLayer, isVideo: true } };
}
const select = (items, layers, audio = true) => engine.selectCircularControlVariants(items, new Map(layers.map(layer => [layer.layerID, layer])), audio);

test('image slide shows one play glyph even when all exported variants are enabled', () => {
  const f = fixture();
  assert.deepEqual([...select(f.icons, f.layers)], [f.play]);
  assert.equal(select(f.icons, f.layers)[0], f.play, 'retain authored geometry/style object');
});
test('video slide selects only its available audio-state glyph', () => {
  const f = fixture();
  assert.deepEqual([...select([...f.icons, f.video], f.layers)], [f.unmute, f.video]);
  assert.deepEqual([...select([...f.icons, f.video], f.layers, false)], [f.mute, f.video]);
});
test('a single authored play state stays unchanged, as in Tonmya', () => {
  const f = fixture();
  assert.deepEqual([...select([f.play], f.layers)], [f.play]);
});
test('missing variants fall back to one available authored glyph without inventing hidden artwork', () => {
  const f = fixture();
  assert.deepEqual([...select([f.mute], f.layers)], [f.mute]);
  assert.deepEqual([...select([f.play, f.mute, f.video], f.layers)], [f.mute, f.video]);
  assert.deepEqual([...select([f.play, f.video], f.layers)], [f.play, f.video]);
});
test('a video in another component cannot switch this gallery to an audio glyph', () => {
  const a = fixture(), b = fixture(100);
  const result = select([...a.icons, ...b.icons, b.video], [...a.layers, ...b.layers]);
  assert.deepEqual([...result], [a.play, b.unmute, b.video]);
});
test('ring, frame and linear progress artwork are unchanged by glyph selection', () => {
  const f = fixture();
  const ring = { isControlCircularIndicator: true }, frame = { isShape: true }, bar = { name: 'progressBar' };
  assert.deepEqual([...select([ring, frame, ...f.icons, bar], f.layers)], [ring, frame, f.play, bar]);
});
test('category galleries use content-based selection rather than a blanket play-icon hide', () => {
  assert.doesNotMatch(html, /selectedCategory === "home" \? "\.cp-control-muteicon, \.cp-control-unmuteicon"/);
  assert.match(html, /return selectCircularControlVariants\(out, byId\)/);
});

if (process.env.SLIDE_PROGRESS_PACKAGES_JSON) {
  for (const { name, data } of JSON.parse(readFileSync(process.env.SLIDE_PROGRESS_PACKAGES_JSON, 'utf8'))) {
    test(`one glyph per visible circular control across all selected states: ${name}`, () => {
      let checked = 0;
      const parsed = engine.parseExport(data);
      for (const entry of parsed.artboards) for (const [tab, model] of Object.entries(entry.model.tabs)) {
        const gallery = model.gallery;
        const states = gallery?.categoryMode
          ? [{ category: 'home', slide: null }, ...gallery.categoryOrder.flatMap(category => gallery.categories[category].slideOrder.map(slide => ({ category, slide })))]
          : (gallery?.slideOrder?.length ? gallery.slideOrder : [null]).map(slide => ({ category: null, slide }));
        for (const { category, slide } of states) {
          const out = engine.collectRenderablesWithSelection(entry.model, entry.byId, entry.childrenOf, tab, slide, category, entry.assetMap, entry.fontLookup, entry.masterNav, entry.videoPlaylist);
          const controls = new Map();
          for (const item of out.filter(item => item.isControlCircularIcon)) {
            let layer = item.layer;
            while (layer && !/^\.?circularBar$/i.test(layer.name || '')) layer = entry.byId.get(layer.parentLayerID);
            assert(layer);
            controls.set(layer.layerID, (controls.get(layer.layerID) || 0) + 1);
          }
          for (const count of controls.values()) { assert.equal(count, 1); checked++; }
        }
      }
      assert(checked > 0, 'package must exercise circular progress controls');
    });
  }
}

test("7.13.7 preserves the retained 7.13.6 source exactly", () => {
  assert.equal(createHash("sha256").update(readFileSync("preview/turbo-preview-7.13.6.html")).digest("hex"), "9831985fba1bee88eaae72ceca35e90288d06a68fc023e8c07120748a55bd904");
});
