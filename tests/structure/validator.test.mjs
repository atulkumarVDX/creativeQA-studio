import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync('scripts/structure/validator.js', 'utf8');
const registry = JSON.parse(readFileSync('doc/layer-structure/rules.json', 'utf8'));
const contracts = JSON.parse(readFileSync('doc/layer-structure/authoring-contracts.json', 'utf8'));
const context = vm.createContext({ setTimeout });
vm.runInContext(source, context);
const g = (layerID, name, parentLayerID = 0) => ({ layerID, name, parentLayerID, layerSection: { _value: 'layerSectionStart' } });
const shape = (layerID, name, parentLayerID) => ({ layerID, name, parentLayerID, layerKind: 4 });
const scan = rawLayers => context.scanStructure({ rawLayers, document: { artboards: [1] } }, registry);
test('CTA label name arbitrary; optional background is not required', async () => {
  const result = await scan([g(1, '970x546'), g(2, 'button1', 1), shape(3, 'frame', 2), { layerID: 4, parentLayerID: 2, name: 'Buy now', textKey: {} }]);
  assert.equal(result.findings.length, 0);
  assert.ok(result.unchecked.length);
});
test('reports explicit CTA naming, missing direct frame and wrong image name', async () => {
  const result = await scan([g(1, '970x546'), g(2, 'button0', 1), { layerID: 3, parentLayerID: 2, name: 'image', layerKind: 5 }, g(4, 'artwork', 2), shape(5, 'frame', 4)]);
  assert.equal(result.findings.filter(f => f.ruleId === 'LS-013').length, 3);
  assert.equal(result.findings[2].path, '970x546 / button0 / image');
});
test('saved hidden states are audited; dot-prefixed subtrees are excluded', async () => {
  const hidden = g(2, 'button', 1); hidden.visible = false;
  const result = await scan([g(1, '970x546'), hidden, g(3, '.excluded', 1), g(4, 'button', 3)]);
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.every(f => f.layerId === 2));
});
test('Map image buttons and client logos are exempt; no slide requirement', async () => {
  const result = await scan([g(1, '970x546'), g(2, 'locationMap', 1), { layerID: 3, parentLayerID: 2, name: 'button', layerKind: 5 }, g(4, 'button-clientLogo', 1), g(5, 'dotterGallery1', 1)]);
  assert.equal(result.findings.length, 0);
});
test('duplicate direct frames are review; frames are never borrowed', async () => {
  const result = await scan([g(1, '970x546'), g(2, 'button1', 1), shape(3, 'frame', 2), shape(4, 'frame', 2)]);
  assert.equal(result.findings[0].ruleId, 'LS-007');
  assert.equal(result.findings[0].severity, 'review');
});
test('state duplicates are scoped by owning category, not across categories', async () => {
  const layers = [g(1, '970x546'), g(2, 'categoryGallery1', 1), g(3, 'category1', 2), g(4, 'category2', 2), g(5, 'slide1', 3), g(6, 'slide1', 4)];
  assert.equal((await scan(layers)).findings.length, 0);
  layers.push(g(7, 'slide1', 3));
  const result = await scan(layers);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].ruleId, 'LS-005');
});
test('large scan yields progress and cancellation prevents final result', async () => {
  const layers = Array.from({ length: 250 }, (_, i) => g(i + 1, 'artwork'));
  let calls = 0;
  const result = await context.scanStructure({ rawLayers: layers }, registry, () => calls++, () => calls > 0);
  assert.equal(result, null);
  assert.equal(calls, 1);
});
test('offline HTML embeds the current registry and engine exactly', () => {
  const html = readFileSync('preview/turbo-preview-7.8.0.html', 'utf8');
  const embedded = html.match(/const STRUCTURE_REGISTRY = (.*);/)[1];
  assert.deepEqual(JSON.parse(embedded), registry);
  assert.deepEqual(JSON.parse(html.match(/const STRUCTURE_CONTRACTS = (.*);/)[1]), contracts);
  assert.ok(html.includes(source.replace("if (typeof module !== 'undefined') module.exports = { scanStructure };", '')));
});
test('zero findings reports executed scope without turning limitations into defects', () => {
  const result = { findings: [], unchecked: ['Runtime not checked'], coverageComplete: false, executedCheckCount: 3 };
  assert.equal(context.structureResultSummary(result), 'No issues detected in executed checks');
  assert.equal(context.structureResultSummary({ ...result, executedCheckCount: 0 }), 'No supported structural checks ran for this package');
  assert.equal(context.structureResultSummary({ ...result, findings: [{ severity: 'review' }] }), '0 warning(s) · 1 item(s) needing review');
});
test('documented RM root frame is required; a descendant frame cannot substitute', async () => {
  const rawLayers = [g(1, '970x546'), g(2, 'rmGallery', 1), g(3, 'slide1', 2), shape(4, 'frame', 3)];
  const result = await context.scanStructure({ rawLayers }, registry, () => {}, () => false, contracts);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].ruleId, 'LS-008');
  assert.equal(result.findings[0].basis, 'guideline-documented');
  rawLayers.push(shape(5, 'frame', 2));
  rawLayers.splice(3, 1);
  const valid = await context.scanStructure({ rawLayers }, registry, () => {}, () => false, contracts);
  assert.equal(valid.findings.length, 0); // Slide frame remains optional.
  assert.equal(context.structureResultSummary(valid), 'No issues detected in executed checks');
});
test('unregistered nested RM names produce review with exact path and ID', async () => {
  const result = await scan([g(1, '970x546'), g(2, 'rmGallery_nested', 1)]);
  assert.equal(result.findings[0].ruleId, 'LS-004');
  assert.equal(result.findings[0].severity, 'review');
  assert.equal(result.findings[0].path, '970x546 / rmGallery_nested');
  assert.ok(result.unchecked.some(text => text.includes('[ID 2]')));
});
test('documented RM requirement does not extend to Map or Dotter', async () => {
  const result = await context.scanStructure({ rawLayers: [g(1, '970x546'), g(2, 'locationMap', 1), g(3, 'dotterGallery1', 1)] }, registry, () => {}, () => false, contracts);
  assert.equal(result.findings.filter(f => /slide/i.test(f.expected)).length, 0);
  assert.ok(result.findings.some(f => f.contractId === 'locationMap' && f.expected.startsWith('frame:')));
  assert.ok(result.findings.some(f => f.contractId === 'dotterGallery' && f.severity === 'review'));
});
const contractScan = rawLayers => context.scanStructure({ rawLayers }, registry, () => {}, () => false, contracts);
test('comparison alternatives pass without an undocumented root frame', async () => {
  const result = await contractScan([g(1, '970x546'), g(2, 'comparisonSlider1', 1), g(3, 'left', 2), g(4, 'right', 2)]);
  assert.equal(result.findings.length, 0);
  const broken = await contractScan([g(1, '970x546'), g(2, 'comparisonSlider1', 1), g(3, 'left', 2)]);
  assert.equal(broken.findings.length, 1);
  assert.match(broken.findings[0].expected, /after or right/);
});
test('nested Tabs require root frame and states but target frames remain optional', async () => {
  const layers = [g(1, '970x546'), g(2, 'nestedTabs1', 1), shape(3, 'frame', 2), g(4, 'target1', 2), g(5, 'trigger1', 2)];
  assert.equal((await contractScan(layers)).findings.length, 0);
  layers[2].layerKind = 5;
  const broken = await contractScan(layers);
  assert.equal(broken.findings.length, 1);
  assert.match(broken.findings[0].detected, /kind 5/);
});
test('Hotspot frames and close buttons are checked within their direct owners', async () => {
  const layers = [g(1, '970x546'), g(2, 'hotSpotGallery1', 1), g(3, 'slide1', 2), g(4, 'trigger1', 2), shape(5, 'frame', 3), { layerID: 6, parentLayerID: 3, name: 'closeButton', layerKind: 5 }, shape(7, 'frame', 4)];
  assert.equal((await contractScan(layers)).findings.length, 0);
  layers[5].parentLayerID = 4;
  const broken = await contractScan(layers);
  assert.equal(broken.findings.length, 1);
  assert.equal(broken.findings[0].layerId, 3);
});
test('coverage inventories every contract and separates unselected mappings', async () => {
  const result = await contractScan([g(1, '970x546'), g(2, 'rmGallery', 1), shape(3, 'frame', 2), g(4, 'slide1', 2)]);
  assert.equal(result.coverage.length, contracts.profiles.length);
  const rm = result.coverage.find(item => item.id === 'rmGallery');
  assert.equal(rm.instances, 1);
  assert.ok(rm.executed.includes('frame: rectangle shape'));
  assert.ok(rm.unchecked.includes('rmGallery identifier'));
  assert.equal(result.coverage.find(item => item.id === 'dynamicCopy').instances, 0);
  assert.equal(result.coverageComplete, false);
});
test('optional RM slide frames use the documented equality check only when present', async () => {
  const rootFrame = { ...shape(3, 'frame', 2), bounds: { top: 0, left: 0, width: 100, height: 50 } };
  const slideFrame = { ...shape(5, 'frame', 4), bounds: { top: 0, left: 0, width: 100, height: 50 } };
  const layers = [g(1, '970x546'), g(2, 'rmGallery', 1), rootFrame, g(4, 'slide1', 2), slideFrame];
  assert.equal((await contractScan(layers)).findings.length, 0);
  slideFrame.bounds.width = 90;
  const result = await contractScan(layers);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].layerId, 5);
  assert.match(result.findings[0].detected, /90/);
});
test('Map and Dotter literal roles pass without slides; template deviations are review', async () => {
  const layers = [g(1, '970x546'), g(2, 'locationMap', 1), g(20, 'dotterGallery1', 1), shape(21, 'frame', 20), g(22, 'productTemplate', 20)];
  let id = 3;
  for (const name of ['frame', 'popup', 'pin', 'logo', 'button', 'noData', 'loading', 'default']) layers.push({ layerID: id++, parentLayerID: 2, name, layerKind: ['frame', 'popup'].includes(name) ? 4 : 5 });
  assert.equal((await contractScan(layers)).findings.length, 0);
  layers.splice(layers.findIndex(node => node.layerID === 22), 1);
  const result = await contractScan(layers);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].basis, 'template-observed');
  assert.equal(result.findings[0].severity, 'review');
});

test('package coverage hides unselected profiles and preserves limitations separately', async () => {
  const result = await contractScan([g(1, '970x546'), g(2, 'button1', 1), shape(3, 'frame', 2)]);
  const presentation = context.structureCoveragePresentation(result);
  assert.deepEqual(Array.from(presentation.checkedProfiles, profile => profile.id), ['cta']);
  assert.equal(presentation.unselectedProfileCount, contracts.profiles.length - 1);
  assert.ok(presentation.limitations.length > 0);
  assert.equal(result.coverageComplete, false);
  assert.equal(context.structureResultSummary(result), 'No issues detected in executed checks');
});
test('empty and unsupported packages never receive a no-issues verdict', async () => {
  for (const rawLayers of [[], [g(1, '970x546'), g(2, 'artwork', 1)]]) {
    const result = await contractScan(rawLayers);
    assert.equal(result.executedCheckCount, 0);
    assert.equal(context.structureResultSummary(result), 'No supported structural checks ran for this package');
  }
});
test('unknown components remain review findings independent of coverage limits', async () => {
  const result = await contractScan([g(1, '970x546'), g(2, 'rmGallery_nested', 1)]);
  assert.equal(context.structureResultSummary(result), '0 warning(s) · 1 item(s) needing review');
  assert.equal(result.findings[0].layerId, 2);
  assert.equal(context.structureCoveragePresentation(result).limitations.some(text => text.includes('[ID 2]')), false);
});
