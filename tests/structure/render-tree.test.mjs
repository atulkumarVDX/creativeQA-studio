import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
class Element {
  constructor() { this.style = {}; this.dataset = {}; this.children = []; this.className = ''; this.attributes = {}; this.classList = { add: (...names) => { this.className += ' ' + names.join(' '); } }; }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  setAttribute(key, value) { this.attributes[key] = value; }
}
const context = vm.createContext({ document: { createElement: () => new Element() }, preciseShapeBoundsOf: layer => layer.bounds,
  mobileExpandableHorizontalBox: (_entry, r) => ({ left: r.left, width: r.width }),
  getShapeFillStyle: () => ({ color: 'rgb(103, 50, 186)' }), getShapeBorderStyle: layer => layer.AGMStrokeStyleInfo?.strokeEnabled ? { width: 3.15, style: 'solid', color: 'purple' } : null,
  getShapeBorderRadius: () => null });
const source = readFileSync('scripts/structure/render-tree.js', 'utf8');
vm.runInContext(source, context);
const g = (layerID, name, parentLayerID, bounds = { top: 0, left: 0, width: 6173, height: 3424 }) => ({ layerID, name, parentLayerID, bounds, opacity: 255, itemIndex: layerID, layerSection: { _value: 'layerSectionStart' } });
function fixture(scale = 1) {
  const layers = [g(1, '970x546', null, { top: 126, left: 2600, width: 970, height: 546 }), g(2, 'tabComponent', 1), g(3, 'tab1', 2), g(4, 'CanvasDesign', 3), g(214851, 'button', 4),
    { layerID: 214849, parentLayerID: 214851, name: 'frame', layerKind: 4, pathBounds: { pathBounds: { top: 506.84375, left: 3293.34375, bottom: 548.59375, right: 3476.9375 } }, AGMStrokeStyleInfo: { strokeEnabled: false, strokeStyleLineWidth: 3.15 } },
    { layerID: 222520, parentLayerID: 214851, name: 'LEARN MORE', textKey: {}, bounds: { top: 521, left: 3319, width: 135.273, height: 14 } }];
  const data = { rawLayers: layers, document: { artboards: [1] } };
  return { data, structureIndex: context.buildStructureIndex(data), stageEl: new Element(), scale, model: { rootLayerId: 1, originLeft: 2600, originTop: 126 } };
}
test('shared source records preserve ancestry, absolute/relative bounds and hidden states', () => {
  const entry = fixture(); const node = entry.structureIndex.nodes.get(222520);
  assert.equal(node.path, '970x546 / tabComponent / tab1 / CanvasDesign / button / LEARN MORE');
  assert.equal(node.parentId, 214851);
  assert.ok(Object.isFrozen(node));
  assert.equal(node.absoluteBounds.left, 3319);
  assert.equal(node.parentRelativeBounds.left, 3319);
  assert.equal(entry.structureIndex.sourceById.get(222520), entry.data.rawLayers.at(-1));
});
test('production CTA frame path geometry and label coordinates match supplied evidence', () => {
  const entry = fixture(); const mount = context.createStructuralMount(entry);
  const label = new Element(); label.style.left = '719px'; label.style.top = '395px';
  mount.mount(label, { layer: entry.structureIndex.sourceById.get(222520) });
  const cta = label.parentElement;
  assert.equal(cta.dataset.structureLayerId, '214851');
  assert.equal(cta.style.left, '3293.34375px');
  assert.equal(cta.style.top, '506.84375px');
  assert.equal(globalPosition(cta).left, 693.34375);
  assert.equal(globalPosition(cta).top, 380.84375);
  assert.equal(cta.style.width, '183.59375px');
  assert.equal(cta.style.height, '41.75px');
  assert.equal(label.style.left, '25.65625px');
  assert.equal(label.style.top, '14.15625px');
  assert.equal(cta.style.border, undefined); // Disabled nonzero stroke stays disabled.
  assert.equal(cta.parentElement.dataset.psdPath, '970x546 / tabComponent / tab1 / CanvasDesign');
});
test('frame painting is consumed by the component; scaled rebasing happens once', () => {
  const entry = fixture(2); const mount = context.createStructuralMount(entry);
  const frame = new Element(); mount.mount(frame, { layer: entry.structureIndex.sourceById.get(214849) });
  assert.equal(frame.parentElement, undefined);
  const label = new Element(); label.style.left = '1438px'; label.style.top = '790px';
  mount.mount(label, { layer: entry.structureIndex.sourceById.get(222520) });
  assert.equal(label.style.left, '51.3125px'); assert.equal(label.style.top, '28.3125px');
});
function globalPosition(element) {
  let left = 0, top = 0;
  while (element) { left += parseFloat(element.style.left) || 0; top += parseFloat(element.style.top) || 0; element = element.parentElement; }
  return { left, top };
}
test('document-wide group bounds create local containers without changing artboard placement', () => {
  const entry = fixture(); const mount = context.createStructuralMount(entry);
  const artwork = { layerID: 10, parentLayerID: 4, name: 'artwork' };
  const element = new Element(); element.style.left = '20px'; element.style.top = '30px';
  mount.mount(element, { layer: artwork });
  assert.equal(element.parentElement.dataset.structureLayerId, '4');
  assert.equal(element.style.left, '2620px'); assert.equal(element.style.top, '156px');
  assert.equal(element.parentElement.style.width, '6173px');
  assert.equal(element.parentElement.dataset.geometryPolicy, 'exported-group-bounds');
  assert.deepEqual(globalPosition(element), { left: 20, top: 30 });
});
test('ordinary nested groups rebase artwork through distinct exported origins at both scales', () => {
  for (const scale of [1, 2]) {
    const entry = fixture(scale);
    entry.data.rawLayers[1].bounds = { left: 2610, top: 136, width: 900, height: 500 };
    entry.data.rawLayers[2].bounds = { left: 2620, top: 156, width: 850, height: 450 };
    entry.data.rawLayers[3].bounds = { left: 2635, top: 166, width: 800, height: 400 };
    entry.structureIndex = context.buildStructureIndex(entry.data);
    const el = new Element(); el.style.left = 60 * scale + 'px'; el.style.top = 70 * scale + 'px';
    context.createStructuralMount(entry).mount(el, { layer: { layerID: 10, parentLayerID: 4, name: 'artwork' } });
    assert.equal(el.style.left, 25 * scale + 'px'); assert.equal(el.style.top, 30 * scale + 'px');
    assert.equal(el.parentElement.style.left, 15 * scale + 'px');
    assert.equal(el.parentElement.style.width, 800 * scale + 'px');
    assert.deepEqual(globalPosition(el), { left: 60 * scale, top: 70 * scale });
  }
});
test('missing group bounds retain ancestry and inherit a finite parent coordinate origin', () => {
  const entry = fixture(); delete entry.data.rawLayers[3].bounds;
  entry.structureIndex = context.buildStructureIndex(entry.data);
  const el = new Element(); el.style.left = '20px'; el.style.top = '30px';
  context.createStructuralMount(entry).mount(el, { layer: { layerID: 10, parentLayerID: 4 } });
  assert.equal(el.parentElement.dataset.geometryPolicy, 'transparent-source-wrapper');
  assert.deepEqual(globalPosition(el), { left: 20, top: 30 });
});
test('independent render instances share immutable source records without sharing DOM groups', () => {
  const entry = fixture(); const snapshot = JSON.stringify([...entry.structureIndex.nodes.values()]);
  const first = context.createStructuralMount(entry), second = context.createStructuralMount({ ...entry, stageEl: new Element() });
  for (const mount of [first, second]) { const el = new Element(); el.style.left = '719px'; mount.mount(el, { layer: entry.structureIndex.sourceById.get(222520) }); }
  assert.notEqual(first.groups.get(214851).element, second.groups.get(214851).element);
  assert.equal(JSON.stringify([...entry.structureIndex.nodes.values()]), snapshot);
});
test('source audit retains excluded/hidden nodes and terminates malformed ancestry', () => {
  const layers = [g(1, '970x546', null), { ...g(2, '.excluded', 1), visible: false }, g(3, 'content', 2), g(4, 'cycle', 5), g(5, 'cycle', 4)];
  const index = context.buildStructureIndex({ rawLayers: layers, document: { artboards: [1] } });
  assert.equal(index.nodes.get(3).excluded, true); assert.equal(index.nodes.get(2).visible, false);
  assert.ok(index.diagnostics.some(item => item.type === 'cycle'));
});
test('standalone preview embeds renderer implementation exactly', () => {
  assert.ok(readFileSync('preview/archive/turbo-preview-7.8.0.html', 'utf8').includes(source));
});
