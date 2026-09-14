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
const group=(layerID,name,parentLayerID,left,top,width,height)=>({layerID,name,parentLayerID,layerKind:7,bounds:{left:0,top:0,width:6173,height:3424},boundsNoEffects:{left,top,width,height}});
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
test('fix version embeds its own engine while the base retains its original engine',()=>{
 const base=readFileSync('preview/turbo-preview-7.8.0.html','utf8'),fix=readFileSync('preview/turbo-preview-7.8.1.html','utf8');
 assert.ok(fix.includes(source));assert.ok(base.includes(readFileSync('scripts/structure/render-tree.js','utf8')));assert.ok(fix.includes('const PREVIEW_BUILD = "7.8.1"'));
});
