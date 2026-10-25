import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = readFileSync('preview/turbo-preview-7.12.5.html', 'utf8');
// Run the actual UI helpers without access to the renderer's lexical scope.
// This catches the missing slideKey / isGallery / exclusion constant failures
// that static string assertions missed.
const helpers = html.slice(html.indexOf('  function gallerySlideKeys()'), html.indexOf('  function renderStage('));
function setup(layers = [], componentName = 'rmGallery') {
  const elements = layers.filter(l => l.rendered).map(l => ({ dataset: { structureLayerId: String(l.layerID) } }));
  const normalizedFamily = componentName.replace(/\d+$/, '').toLowerCase();
  const componentFamily = new Set(['rmgallery', 'colorpickergallery', 'hotspotgallery', 'staticproductgallery']).has(normalizedFamily)
    ? normalizedFamily
    : null;
  const entry = {
    model: { tabs: { tab2: { gallery: {
      layerId: 1, componentName, componentFamily,
      slideOrder: ['slide1', 'slide2', 'slide3'], slides: {}
    } } } },
    structureIndex: { sourceById: new Map(layers.map(l => [l.layerID, l])) },
    stageEl: { querySelectorAll: () => elements },
  };
  const context = vm.createContext({ entry, window: { scrollX: 0, scrollY: 0, matchMedia: () => ({ matches: false }) }, P: {
    sortByNumericSuffix: keys => keys.sort(),
    slideKey: name => /^slide\d+$/i.test(name || '') ? name.toLowerCase() : null,
    isGallery: name => /^(rmGallery|colorPickerGallery|hotspotGallery|staticProductGallery)\d*$/i.test(name || ''),
  }, controlEntries: () => [entry], syncSlideButtonState: () => {}, renderStage: () => {} });
  vm.runInContext('const NO_EXPORT_PREFIX = "."; let activeTab = "tab2", activeSlide = "slide1", pendingGallerySlideDirection = null;\n' + helpers, context);
  return { context, entry };
}
const layer = (layerID, name, parentLayerID, rendered = false) => ({ layerID, name, parentLayerID, rendered });

test('gallery arrows bind raster and group controls through the public renderer API', () => {
  const { context, entry } = setup([
    layer(1, 'rmGallery', 0), layer(2, 'arrows', 1),
    layer(3, 'left', 2, true), layer(4, 'right', 2, true),
    layer(5, 'frame', 4, true), layer(6, 'right', 1, true),
  ]);
  assert.deepEqual(Array.from(context.galleryArrowTargets(entry), x => x.direction), [-1, 1]);
});

test('every supported slide-gallery family uses the same arrow target contract', () => {
  for (const componentName of ['rmGallery', 'colorPickerGallery', 'hotspotGallery', 'staticProductGallery']) {
    const { context, entry } = setup([
      layer(1, componentName, 0), layer(2, 'arrows', 1),
      layer(3, 'left', 2, true), layer(4, 'right', 2, true),
    ], componentName);
    assert.deepEqual(Array.from(context.galleryArrowTargets(entry), x => x.direction), [-1, 1]);
  }
});

test('different state-model components do not borrow global gallery slide state', () => {
  const { context, entry } = setup([
    layer(1, 'view360', 0), layer(2, 'arrows', 1),
    layer(3, 'left', 2, true), layer(4, 'right', 2, true),
  ], 'view360');
  assert.equal(context.galleryArrowTargets(entry).length, 0);
});

test('excluded, slide-owned and nested gallery arrows cannot navigate the outer gallery', () => {
  const { context, entry } = setup([
    layer(1, 'rmGallery', 0), layer(2, '.arrows', 1), layer(3, 'right', 2, true),
    layer(4, 'slide1', 1), layer(5, 'arrows', 4), layer(6, 'right', 5, true),
    layer(7, 'rmGallery2', 1), layer(8, 'arrows', 7), layer(9, 'left', 8, true),
    layer(10, 'arrows', 1), layer(11, '.left', 10, true),
  ]);
  assert.equal(context.galleryArrowTargets(entry).length, 0);
});

test('manual navigation wraps in both directions and retains travel direction', () => {
  const { context } = setup();
  vm.runInContext('moveGallerySlide(-1)', context);
  assert.equal(vm.runInContext('activeSlide', context), 'slide3');
  assert.equal(vm.runInContext('pendingGallerySlideDirection', context), 'previous');
  vm.runInContext('moveGallerySlide(1)', context);
  assert.equal(vm.runInContext('activeSlide', context), 'slide1');
  assert.equal(vm.runInContext('pendingGallerySlideDirection', context), 'next');
});

test('arrows wrap within the clicked size when compared galleries have different slide counts', () => {
  const { context, entry } = setup();
  context.controlEntries = () => [entry, { model: { tabs: { tab2: { gallery: { slideOrder: ['slide4'] } } } } }];
  vm.runInContext('activeSlide = "slide3"; moveGallerySlide(1, entry)', context);
  assert.equal(vm.runInContext('activeSlide', context), 'slide1');
  vm.runInContext('moveGallerySlide(-1, entry)', context);
  assert.equal(vm.runInContext('activeSlide', context), 'slide3');
});

test('transition animates only the slide collection items and removes outgoing content', async () => {
  const { context, entry } = setup();
  const animations = [];
  const item = () => ({ classList: { add() {} }, setAttribute() {}, style: {},
    querySelectorAll: () => [], removeAttribute() {}, remove() { this.removed = true; },
    animate(frames, options) { animations.push({ target: this, frames, options }); return { finished: Promise.resolve() }; },
  });
  const incoming = item(), outgoing = item();
  const viewport = { clientWidth: 600, style: { overflow: 'hidden' }, appendChild: n => { n.parentElement = viewport; } };
  incoming.parentElement = viewport;
  incoming.classList.contains = name => name === 'vdx-collection-item';
  entry.model.tabs.tab2.gallery.slides.slide1 = { layerId: 30 };
  entry.stageEl.querySelector = () => ({ parentElement: incoming });
  context.animateGallerySlide(entry, 'next', outgoing);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(animations.map(x => x.target), [incoming, outgoing]);
  assert.equal(animations[0].frames[0].translate, '600px 0');
  assert.equal(animations[1].frames[1].translate, '-600px 0');
  assert.equal(animations[0].options.duration, 500);
  assert.equal(animations[0].options.easing, 'ease-out');
  assert.equal(animations[0].options.fill, 'both');
  assert.equal(outgoing.inert, true);
  assert.equal(outgoing.removed, true);
  assert.equal(viewport.style.overflow, 'hidden');
  context.window.matchMedia = () => ({ matches: true });
  context.animateGallerySlide(entry, 'previous', item());
  assert.equal(animations.length, 2, 'reduced motion skips the animation');
});
