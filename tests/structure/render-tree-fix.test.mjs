import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
class Element {
 constructor(){this.style={};this.dataset={};this.children=[];this.attributes={};this.className='';this.classList={add:(...x)=>this.className+=' '+x.join(' ')};}
 appendChild(x){this.children.push(x);x.parentElement=this;return x;}
 insertBefore(x,before){this.children.splice(this.children.indexOf(before),0,x);x.parentElement=this;return x;}
 setAttribute(k,v){this.attributes[k]=v;}
}
const source=readFileSync('scripts/structure/render-tree-fix.js','utf8');
const c=vm.createContext({document:{createElement:()=>new Element()},preciseShapeBoundsOf:x=>x.bounds,mobileExpandableHorizontalBox:(_,r)=>r,getShapeFillStyle:()=>({color:'black'}),getShapeBorderStyle:()=>null,getShapeBorderRadius:()=>null,resolveAssetUrl:x=>x});
vm.runInContext(source,c);
const group=(layerID,name,parentLayerID,left,top,width,height,itemIndex)=>({layerID,name,parentLayerID,layerKind:7,itemIndex,bounds:{left:0,top:0,width:6173,height:3424},boundsNoEffects:{left,top,width,height}});
function setup(extra=[]){
 const data={document:{artboards:[1]},rawLayers:[group(1,'970x546',null,2581,25,970,546),group(2,'tabComponent',1,2569,-15,982,661),group(3,'tab1',2,2581,25,970,546),group(4,'CanvasDesign',3,2600,126,925,439),...extra]};
 return {model:{rootLayerId:1,originLeft:2581,originTop:25},structureIndex:c.buildStructureIndex(data),stageEl:new Element(),scale:1,assetMap:new Map()};
}
const frame=(layerID,parentLayerID,left,top,width,height)=>({layerID,parentLayerID,name:'frame',layerKind:4,pathBounds:{pathBounds:{left,top,right:left+width,bottom:top+height}}});
test('content bounds supply ordinary containers and local child geometry in unrelated names',()=>{
 const e=setup([group(8,'arbitraryArtworkGroup',4,2610,146,100,80)]),m=c.createStructuralMount(e),el=new Element();el.style.left='34px';el.style.top='127px';m.mount(el,{layer:{layerID:9,parentLayerID:8,name:'image'}});
 assert.equal(el.style.left,'5px');assert.equal(el.style.top,'6px');assert.equal(el.parentElement.style.width,'100px');
 assert.equal(m.groups.get(4).element.style.width,'925px');
});
test('owning direct frames override content bounds and are consumed once',()=>{
 const e=setup([frame(10,2,2581,25,970,546),frame(11,3,2581,25,970,546)]),m=c.createStructuralMount(e),el=new Element();m.mount(el,{layer:e.structureIndex.sourceById.get(10)});
 assert.equal(el.parentElement,undefined);assert.equal(m.groups.get(2).element.style.width,'970px');
 const art=new Element();art.style.left='19px';art.style.top='101px';m.mount(art,{layer:{layerID:12,parentLayerID:4}});
 assert.equal(art.style.left,'0px');assert.equal(art.style.top,'0px');
});
test('descendant frames are never borrowed and ambiguous frames are not promoted',()=>{
 const e=setup([frame(10,4,2581,25,970,546),frame(11,3,2581,25,970,546),frame(12,3,2581,25,970,546)]),m=c.createStructuralMount(e),el=new Element();m.mount(el,{layer:{layerID:13,parentLayerID:3}});
 assert.equal(m.groups.get(2).frameId,null);assert.equal(m.groups.get(3).frameId,null);
});
test('tabs mount through component collection and active tabpanel wrappers',()=>{
 const e=setup(),m=c.createStructuralMount(e);m.mount(new Element(),{layer:{layerID:8,parentLayerID:4}});
 const tab=m.groups.get(3).element,item=tab.parentElement,collection=item.parentElement;
 assert.equal(item.attributes.role,'tabpanel');assert.equal(item.dataset.id,'1');assert.equal(collection.attributes.role,'list');assert.equal(collection.parentElement.dataset.type,'tabs');
 assert.equal(collection.style.overflow,'hidden');assert.equal(collection.style.position,'relative');assert.equal(item.style.overflow,'hidden');assert.equal(tab.style.zIndex,'0');
 assert.equal(m.groups.get(4).element.parentElement,tab);
});
test('logo generator background is promoted using painter filename resolution',()=>{
 const e=setup([group(8,'button-clientLogo',1,2617,35,501,59),{layerID:9,parentLayerID:8,name:'background',layerKind:5}]),m=c.createStructuralMount(e),el=new Element();m.mount(el,{layer:e.structureIndex.sourceById.get(9),fileName:'logo.png'});
 assert.equal(el.parentElement,undefined);assert.equal(m.groups.get(8).element.style.backgroundImage,'url("logo.png")');assert.equal(m.groups.get(8).element.style.backgroundSize,'501px auto');
});
test('DOM sibling order follows compiled source paint order despite reversed traversal',()=>{
 const e=setup(),m=c.createStructuralMount(e);
 for(const itemIndex of [50,30,40])m.mount(new Element(),{layer:{layerID:itemIndex,parentLayerID:4,itemIndex}});
 assert.deepEqual(m.groups.get(4).element.children.map(x=>Number(x.dataset.sourcePaintOrder)),[30,40,50]);
});
test('every retained group composites at its own source depth among arbitrary siblings',()=>{
 const e=setup([
  {layerID:8,parentLayerID:4,name:'lower artwork',layerKind:5,itemIndex:10},
  group(9,'arbitrary retained group',4,2610,146,100,80,20),
  group(10,'nested retained group',9,2615,151,90,70,18),
  {layerID:12,parentLayerID:4,name:'upper artwork',layerKind:5,itemIndex:30}
 ]),m=c.createStructuralMount(e),lower=new Element(),nestedContent=new Element(),upper=new Element();
 lower.style.zIndex='10';upper.style.zIndex='30';
 m.mount(lower,{layer:e.structureIndex.sourceById.get(8)});
 m.mount(nestedContent,{layer:{layerID:11,parentLayerID:10,name:'content',itemIndex:19}});
 m.mount(upper,{layer:e.structureIndex.sourceById.get(12)});
 assert.equal(m.groups.get(9).element.style.zIndex,'20');
 assert.equal(m.groups.get(10).element.style.zIndex,'18');
 assert.deepEqual(m.groups.get(4).element.children.map(x=>Number(x.dataset.sourcePaintOrder)),[10,20,30]);
 assert.equal(nestedContent.parentElement,m.groups.get(10).element);
 assert.ok(Number(lower.style.zIndex)<Number(m.groups.get(9).element.style.zIndex));
 assert.ok(Number(m.groups.get(9).element.style.zIndex)<Number(upper.style.zIndex));
});
test('groups without a finite source index use a deterministic zero depth',()=>{
 const e=setup([group(8,'unindexed group',4,2610,146,100,80)]),m=c.createStructuralMount(e);
 m.mount(new Element(),{layer:{layerID:9,parentLayerID:8,name:'content'}});
 assert.equal(m.groups.get(8).element.style.zIndex,'0');
});
test('size-specific instances use their assigned paint order instead of master source order',()=>{
 const e=setup(),m=c.createStructuralMount(e),master={layerID:90,parentLayerID:91,itemIndex:2,name:'bottom-border'};
 const header=new Element(),divider=new Element();
 m.mount(header,{layer:{layerID:30,parentLayerID:1,itemIndex:30}});
 m.mount(divider,{layer:master,itemIndex:40,instanceOwnerId:1});
 assert.deepEqual(e.stageEl.children.map(x=>Number(x.dataset.sourcePaintOrder)),[30,40]);
});
test('gallery collection owns slides while persistent CTA remains outside collection',()=>{
 const e=setup([group(8,'rmGallery',3,2581,106,970,465),group(9,'slide1',8,2581,106,970,465),group(10,'button1',8,2700,400,200,40)]),m=c.createStructuralMount(e);
 m.mount(new Element(),{layer:{layerID:20,parentLayerID:9,itemIndex:20}});
 m.mount(new Element(),{layer:{layerID:21,parentLayerID:10,itemIndex:21}});
 const gallery=m.groups.get(8),slide=m.groups.get(9).element,button=m.groups.get(10).element;
 assert.equal(slide.parentElement.parentElement,gallery.childHost);
 assert.equal(gallery.childHost.parentElement.dataset.type,'gallery');
 assert.equal(button.parentElement,gallery.element);
 assert.equal(slide.parentElement.attributes.role,'tabpanel');
});
test('collection-owned backgrounds stay inside the active collection stack',()=>{
 const e=setup([group(8,'rmGallery',3,2581,106,970,465),group(9,'slide1',8,2581,106,970,465),{layerID:10,parentLayerID:8,name:'background',layerKind:5,itemIndex:10}]),m=c.createStructuralMount(e);
 const background=new Element();
 m.mount(background,{layer:e.structureIndex.sourceById.get(10),fileName:'background.png'});
 const gallery=m.groups.get(8);
 assert.equal(background.parentElement,undefined);
 assert.equal(gallery.element.dataset.backgroundLayerId,'10');
 assert.equal(gallery.element.style.backgroundImage,'url("background.png")');
 assert.equal(gallery.element.style.backgroundSize,'100% 100%');
});
test('fix version embeds its own engine while the base retains its original engine',()=>{
 const base=readFileSync('preview/archive/turbo-preview-7.8.0.html','utf8'),fix=readFileSync('preview/archive/turbo-preview-7.8.6.html','utf8');
 assert.ok(fix.includes('const isCollectionBackground'));assert.ok(base.includes(readFileSync('scripts/structure/render-tree.js','utf8')));assert.ok(fix.includes('const PREVIEW_BUILD = "7.8.6"'));
});
test('7.9.7 build gives every retained group a source-order stacking context',()=>{
 const fix=readFileSync('preview/archive/turbo-preview-7.9.7.html','utf8');
 assert.ok(fix.includes("zIndex: String(Number.isFinite(layer.itemIndex) ? layer.itemIndex : 0)"));
 assert.ok(fix.includes('const PREVIEW_BUILD = "7.9.7"'));
});
test('fix package loader resolves a missing PNG to its available Retina asset',()=>{
 const fix=readFileSync('preview/archive/turbo-preview-7.8.1.html','utf8');
 const resolverBody=fix.match(/P\.setAssetResolver\(\(fileName\) => \{([\s\S]*?)\n      \}\);/)[1];
 const nameToBlobUrl=new Map([['background-31082-2x.png','retina-blob-url']]);
 const warnedMissingAssets=new Set();
 const fn=vm.runInNewContext(`(fileName)=>{${resolverBody}}`,{nameToBlobUrl,warnedMissingAssets,console,encodeURIComponent});
 assert.equal(fn('background-31082.png'),'retina-blob-url');
 assert.equal(warnedMissingAssets.size,0);
});
test('SPIRIVA 300x250 client logo mounts from its Retina-only package asset',()=>{
 const fixture=JSON.parse(readFileSync('tests/fixtures/spiriva-300x250-logo.json','utf8'));
 const data={document:fixture.document,rawLayers:fixture.rawLayers};
 const names=new Set(fixture.archiveEntries);
 assert.equal(names.has('background-31086.png'),false);
 assert.equal(names.has('background-31086-2x.png'),true);

 const byId=new Map(data.rawLayers.map(layer=>[layer.layerID,layer]));
 const artboard=[...byId.values()].find(layer=>layer.name==='300x250'&&data.document.artboards.includes(layer.layerID));
 const logoGroup=[...byId.values()].find(layer=>layer.name==='button-clientLogo'&&(()=>{let current=layer;while(current){if(current.layerID===artboard.layerID)return true;current=byId.get(current.parentLayerID);}return false;})());
 const background=[...byId.values()].find(layer=>layer.parentLayerID===logoGroup.layerID&&layer.name==='background');
 assert.equal(background.layerID,31086);

 const resolver=name=>{
  if(names.has(name))return 'blob:'+name;
  const retina=name.replace(/\.png$/i,'-2x.png');
  return names.has(retina)?'blob:'+retina:'missing:'+name;
 };
 c.resolveAssetUrl=resolver;
 const value=item=>typeof item==='number'?item:item?._value;
 const rootBounds=artboard.bounds;
 const entry={
  model:{rootLayerId:artboard.layerID,originLeft:value(rootBounds.left),originTop:value(rootBounds.top)},
  structureIndex:c.buildStructureIndex(data),stageEl:new Element(),scale:1,assetMap:new Map()
 };
 const mount=c.createStructuralMount(entry);
 mount.mount(new Element(),{layer:background,fileName:`background-${background.layerID}.png`});
 const logo=mount.groups.get(logoGroup.layerID).element;
 assert.equal(logo.style.backgroundImage,'url("blob:background-31086-2x.png")');
 assert.equal(logo.style.zIndex,'766');
 assert.ok(Number(logo.style.zIndex)>757,'the logo must paint above the full-canvas image');
 assert.equal(logo.style.width,value(logoGroup.boundsNoEffects.width)+'px');
 assert.equal(logo.style.height,value(logoGroup.boundsNoEffects.height)+'px');
 assert.match(readFileSync('app/page.tsx','utf8'),/import \{ currentPreview \} from "\.\.\/preview\/current-preview"/);
 assert.doesNotMatch(readFileSync('app/page.tsx','utf8'),/import\.meta\.glob/);
 assert.match(readFileSync('app/page.tsx','utf8'),/onClick=\{\(\) => openMainUnit\("970x546"\)\}/);
 assert.match(readFileSync('app/page.tsx','utf8'),/const selectedSize = Array\.from\(document\.querySelectorAll\("#sizePicker \.chip"\)\)/);
 assert.match(readFileSync('app/page.tsx','utf8'),/Teaser generation temporarily selects mobile-instream/);
 assert.match(readFileSync('app/page.tsx','utf8'),/const previousTransform = stage\.style\.transform;[\s\S]*?stage\.style\.transform = "none";[\s\S]*?stage\.style\.transform = previousTransform;/);
 assert.match(readFileSync('app/page.tsx','utf8'),/const videoLayer = Array\.from\(stage\.querySelectorAll\("\.cp-video"\)\)[\s\S]*?videoTarget/);
 assert.match(readFileSync('components/teaser-preview.tsx','utf8'),/matrix\(\$\{scaleX\}, 0, 0, \$\{scaleY\}, \$\{translateX\}, \$\{translateY\}\)/);
 assert.match(readFileSync('app/page.tsx','utf8'),/tqa:focus-finding/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/function openQaFinding\(finding\)/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/function openStructureFinding\(finding\)[\s\S]*?compareEnabled = false;[\s\S]*?activeSlide = slide \|\| null;/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/function openQaFinding\(finding\)[\s\S]*?compareEnabled = false;[\s\S]*?activeSlide = slideName;/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/function revealFindingTarget\(target\)[\s\S]*?closest\("\.cp-artboard-card"\)/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/function revealFindingTarget\(target\)[\s\S]*?stage\.scrollTop = 0;/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/function highlightSpacingTargets\(targets, ruleId\)/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/structure-text-highlight/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/animation: structure-text-blink \.8s steps\(1, end\) infinite/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/\.structure-highlight \{ --structure-highlight-color:#d9a441; outline:1\.5px dotted var\(--structure-highlight-color\)/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/\.cp-text\.structure-highlight \{ --structure-highlight-color: #d9a441; outline: 1\.5px dotted var\(--structure-highlight-color\)/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/animation: structure-outline-blink \.8s steps\(1, end\) infinite/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/const TEXT_QA_ENABLED = false/);
 assert.match(readFileSync('preview/archive/turbo-preview-7.8.19.html','utf8'),/#textQaBadge, #kerningPanel, #structureQA \{ display: none !important; \}/);
});
