// Source records are independent of DOM instances and selected state.
function buildStructureIndex(data) {
  const sourceById = new Map(), sourceChildren = new Map(), nodes = new Map(), diagnostics = [];
  const value = item => typeof item === 'number' ? item : item?._value;
  const rect = bounds => {
    if (!bounds) return null;
    const box = Object.fromEntries(['top', 'left', 'width', 'height'].map(key => [key, value(bounds[key])]));
    return Object.values(box).every(Number.isFinite) ? Object.freeze(box) : null;
  };
  for (const layer of data.rawLayers || []) {
    if (sourceById.has(layer.layerID)) diagnostics.push({ type: 'duplicate-id', layerId: layer.layerID });
    sourceById.set(layer.layerID, layer);
    if (!sourceChildren.has(layer.parentLayerID)) sourceChildren.set(layer.parentLayerID, []);
    sourceChildren.get(layer.parentLayerID).push(layer);
  }
  for (const layer of data.rawLayers || []) {
    const chain = [], seen = new Set(); let ancestor = layer;
    while (ancestor && !seen.has(ancestor.layerID)) {
      seen.add(ancestor.layerID); chain.unshift(ancestor); ancestor = sourceById.get(ancestor.parentLayerID);
    }
    if (ancestor) diagnostics.push({ type: 'cycle', layerId: layer.layerID });
    const absoluteBounds = rect(layer.bounds), parentBounds = rect(sourceById.get(layer.parentLayerID)?.bounds);
    const parentRelativeBounds = absoluteBounds && parentBounds ? Object.freeze({ ...absoluteBounds, top: absoluteBounds.top - parentBounds.top, left: absoluteBounds.left - parentBounds.left }) : null;
    nodes.set(layer.layerID, Object.freeze({ layerId: layer.layerID, parentId: layer.parentLayerID, rawName: layer.name,
      path: chain.map(item => item.name).join(' / '), ancestryIds: Object.freeze(chain.map(item => item.layerID)),
      artboardId: chain.find(item => (data.document?.artboards || []).includes(item.layerID))?.layerID,
      children: Object.freeze((sourceChildren.get(layer.layerID) || []).map(item => item.layerID)),
      order: layer.itemIndex, visible: layer.visible, opacity: layer.opacity, blendMode: layer.mode?._value,
      excluded: chain.some(item => String(item.name || '').startsWith('.')), absoluteBounds, parentRelativeBounds,
      hasMask: !!(layer.hasUserMask || layer.hasVectorMask), transform: layer.textKey?.transform || null }));
  }
  return Object.freeze({ nodes, sourceById, sourceChildren, diagnostics: Object.freeze(diagnostics) });
}

function componentFrameBounds(frame) {
  // Matched production CTA geometry uses pathBounds, not padded raster bounds.
  const path = frame.pathBounds?.pathBounds;
  const value = item => typeof item === 'number' ? item : item?._value;
  if (path) {
    const top = value(path.top), left = value(path.left), bottom = value(path.bottom), right = value(path.right);
    if ([top, left, bottom, right].every(Number.isFinite)) return { top, left, width: right - left, height: bottom - top };
  }
  return preciseShapeBoundsOf(frame);
}

function createStructuralMount(entry) {
  const { model, stageEl, scale, structureIndex } = entry;
  const groups = new Map(), resolving = new Set();
  const source = structureIndex.sourceById, children = structureIndex.sourceChildren;
  const unit = item => typeof item === 'number' ? item : item?._value;
  function ensureGroup(id) {
    if (id === model.rootLayerId || id == null) return { element: stageEl, left: 0, top: 0 };
    if (groups.has(id)) return groups.get(id);
    const layer = source.get(id), node = structureIndex.nodes.get(id);
    if (!layer || node?.artboardId !== model.rootLayerId || resolving.has(id)) return { element: stageEl, left: 0, top: 0 };
    resolving.add(id);
    const parent = ensureGroup(layer.parentLayerID);
    const element = document.createElement('div');
    element.className = 'cp-structure-group';
    element.dataset.structureLayerId = String(id); element.dataset.psdParentId = String(layer.parentLayerID);
    element.dataset.psdPath = node.path; element.dataset.psdRole = 'group';
    element.dataset.psdVisibility = String(node.visible); element.dataset.psdOrder = String(node.order);
    element.dataset.geometryPolicy = 'transparent-source-wrapper';
    Object.assign(element.style, { position: 'absolute', left: '0px', top: '0px', width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' });
    let left = parent.left, top = parent.top, frameId = null;
    element.setAttribute('name', layer.name || '');
    // Ordinary groups own their exported coordinate rectangle. Large or
    // document-wide bounds are retained, not guessed from visible children.
    // Overflow remains visible because bounds alone do not establish clipping.
    const bounds = node.absoluteBounds;
    if (bounds && bounds.width >= 0 && bounds.height >= 0) {
      left = bounds.left - model.originLeft; top = bounds.top - model.originTop;
      element.dataset.geometryPolicy = 'exported-group-bounds';
      Object.assign(element.style, { left: (left - parent.left) * scale + 'px', top: (top - parent.top) * scale + 'px', width: bounds.width * scale + 'px', height: bounds.height * scale + 'px' });
    }
    const direct = (children.get(id) || []).filter(child => !String(child.name || '').startsWith('.'));
    const frames = direct.filter(child => child.name === 'frame' && child.layerKind === 4);
    // Legacy button is rendered as evidenced; authoring naming QA stays separate.
    if (/^button\d*$/i.test(layer.name || '') && frames.length === 1 && direct.some(child => !!child.textKey)) {
      const frame = frames[0], box = componentFrameBounds(frame);
      if (box && [box.top, box.left, box.width, box.height].every(Number.isFinite)) {
        const r = { left: box.left - model.originLeft, top: box.top - model.originTop, width: box.width, height: box.height, layer };
        const horizontal = mobileExpandableHorizontalBox(entry, r);
        left = horizontal.left; top = r.top; frameId = frame.layerID;
        element.classList.add('cp-cta', 'action'); element.dataset.psdRole = 'cta';
        element.style.zIndex = String(layer.itemIndex || 0);
        element.setAttribute('name', layer.name); element.dataset.geometryPolicy = 'frame-path-bounds'; element.dataset.frameLayerId = String(frameId);
        Object.assign(element.style, { left: (left - parent.left) * scale + 'px', top: (top - parent.top) * scale + 'px', width: horizontal.width * scale + 'px', height: box.height * scale + 'px', pointerEvents: 'auto', backgroundSize: 'cover', backgroundPosition: 'center center' });
        const fill = getShapeFillStyle(frame), border = getShapeBorderStyle(frame), radius = getShapeBorderRadius(frame);
        if (fill) element.style.backgroundColor = fill.color;
        if (border) element.style.border = `${border.width * scale}px ${border.style} ${border.color}`;
        if (radius) element.style.borderRadius = radius;
        const opacity = unit(layer.opacity);
        if (Number.isFinite(opacity)) element.style.opacity = String(opacity / 255);
      }
    }
    parent.element.appendChild(element);
    const group = { element, left, top, frameId };
    groups.set(id, group); resolving.delete(id); return group;
  }
  function mount(element, renderable) {
    const layer = renderable.layer;
    const node = structureIndex.nodes.get(layer?.layerID);
    const ownerId = renderable.instanceOwnerId ?? layer?.parentLayerID;
    const parent = ensureGroup(ownerId);
    if (parent.frameId === layer?.layerID) return; // frame is promoted into the CTA box.
    if (layer) {
      element.dataset.structureLayerId = String(layer.layerID); element.dataset.psdParentId = String(layer.parentLayerID);
      element.dataset.psdPath = node?.path || layer.name; element.dataset.psdOrder = String(layer.itemIndex);
    }
    element.dataset.renderOwnerId = String(ownerId ?? model.rootLayerId);
    // Existing painting computes artboard coordinates. Rebase exactly once
    // into its source parent. Missing bounds retain the parent's origin.
    if (element.style.left) element.style.left = (parseFloat(element.style.left) - parent.left * scale) + 'px';
    if (element.style.top) element.style.top = (parseFloat(element.style.top) - parent.top * scale) + 'px';
    parent.element.appendChild(element);
  }
  return { mount, groups };
}
