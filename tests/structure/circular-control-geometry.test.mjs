import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const html = readFileSync('preview/archive/turbo-preview-7.13.7.html', 'utf8');
const context = vm.createContext({ window: {}, console: { log() {} } });
vm.runInContext(html.match(/<script>\s*(const PREVIEW_BUILD[\s\S]*?)<\/script>/)[1], context);
const engine = context.window.CSM_PREVIEW;
const fixtures = JSON.parse(readFileSync('tests/fixtures/circular-control-geometry.json', 'utf8'));
const unit = value => typeof value === 'number' ? value : value?._value;
const group = (layerID, parentLayerID, name) => ({layerID, parentLayerID, name, visible:true, layerKind:7, layerSection:{_value:'layerSectionStart'}, bounds:{top:0,left:0,width:970,height:546}});
function render(layers) {
  const copied = structuredClone(layers);
  copied[0].parentLayerID = 4;
  const data = {document:{artboards:[1]}, rawLayers:[group(1,-1,'970x546'), group(2,1,'tabComponent'), group(3,2,'tab2'),group(4,3,'slideProgress'), ...copied]};
  const entry = engine.parseExport(data).artboards[0];
  return engine.collectRenderablesWithSelection(entry.model,entry.byId,entry.childrenOf,'tab2',null,null,entry.assetMap,entry.fontLookup,entry.masterNav,entry.videoPlaylist);
}
for(const fixture of fixtures) {
  test(`uses authored ring and icon geometry: ${fixture.source}`, () => {
    const result = render(fixture.layers);
    const ring = result.find(item => item.isControlCircularIndicator);
    assert(ring);
    const source = fixture.layers.find(layer => layer.name === 'indicator');
    assert.equal(ring.stroke.width, unit(source.AGMStrokeStyleInfo.strokeStyleLineWidth));
    assert.equal(ring.stroke.alignment, source.AGMStrokeStyleInfo.strokeStyleLineAlignment._value);
    for(const icon of result.filter(item => item.isControlCircularIcon)) {
      const source = fixture.layers.find(layer => layer.layerID === icon.layer.layerID);
      assert.equal(icon.authoredIconBounds, true);
      assert.equal(icon.width, unit(source.boundsNoEffects.width));
      assert.equal(icon.height, unit(source.boundsNoEffects.height));
      assert.equal(icon.left, unit(source.boundsNoEffects.left));
      assert.equal(icon.top, unit(source.boundsNoEffects.top));
    }
    assert(result.some(item => item.isControlCircularIcon));
  });
}
test('disabled ring stroke is omitted and colour/opacity use the stroke descriptor', () => {
  const layers = structuredClone(fixtures[0].layers);
  const indicator = layers.find(layer => layer.name === 'indicator');
  indicator.AGMStrokeStyleInfo.strokeEnabled = false;
  assert(!render(layers).some(item => item.isControlCircularIndicator));
  indicator.AGMStrokeStyleInfo.strokeEnabled = true;
  indicator.AGMStrokeStyleInfo.strokeStyleLineWidth._value = 3;
  indicator.AGMStrokeStyleInfo.strokeStyleOpacity._value = 50;
  indicator.AGMStrokeStyleInfo.strokeStyleContent.color = {red:255,grain:0,blue:0};
  const ring = render(layers).find(item => item.isControlCircularIndicator);
  assert.equal(ring.stroke.width, 3);
  assert.equal(ring.stroke.color,'rgba(255, 0, 0, 0.5)');
});
// Exercise the actual icon DOM painter, including the legacy-manifest fallback.
const nodes = [];
const paintContext = vm.createContext({
  PRODUCTION_CIRCULAR_CONTROL_ICONS:{playicon:{viewBox:'0 0 30 40', paths:['M0,0L30,20L0,40Z'],widthPercent:30,heightPercent:30}},
  document:{createElement:()=>({style:{},appendChild(node){nodes.push(node);}}),createElementNS:()=>({style:{},setAttribute(){},appendChild(){}})},
  mobileExpandableVerticalTop:(_entry,_r,top)=>top,
  circularControlIconColor:()=> 'rgba(255, 0, 0, 0.5)'
});
vm.runInContext(html.slice(html.indexOf('  function appendProductionCircularControlIcon('),html.indexOf('  // For a shape layer',html.indexOf('  function appendProductionCircularControlIcon('))),paintContext);
test('authored icon bounds paint at full size; missing bounds retain production fallback', () => {
  for(const authored of [true,false]) {
    nodes.length=0;
    paintContext.appendProductionCircularControlIcon({appendChild(){}},{controlIcon:'playicon',width:14,height:18,left:0,top:0,authoredIconBounds:authored,layer:{}},1,null);
    assert.equal(nodes[0].style.width,authored?'100%':'30%');
    assert.equal(nodes[0].style.height,authored?'100%':'30%');
    assert.equal(nodes[0].style.fill,'rgba(255, 0, 0, 0.5)');
  }
});
if(process.env.CIRCULAR_PACKAGES_JSON) {
  for(const pkg of JSON.parse(readFileSync(process.env.CIRCULAR_PACKAGES_JSON,'utf8'))) {
    test(`all circular control subtrees: ${pkg.name}`, () => {
      const circles=pkg.data.rawLayers.filter(layer=>layer.name==='circularBar' && layer.visible===true);
      let checked=0;
      for(const circle of circles) {
        const layers=[circle,...pkg.data.rawLayers.filter(layer=>layer.parentLayerID===circle.layerID)];
        const result=render(layers);
        for(const item of result) {
          if(item.isControlCircularIndicator) {
            assert.equal(item.stroke.width,unit(item.layer.AGMStrokeStyleInfo.strokeStyleLineWidth)); checked++;
          }
          if(item.isControlCircularIcon && item.layer.boundsNoEffects) {
            assert.equal(item.width,unit(item.layer.boundsNoEffects.width)); checked++;
          }
        }
      }
      assert(checked>0);
    });
  }
}
