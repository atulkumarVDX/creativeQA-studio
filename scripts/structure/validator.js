// Executes only explicitly supported portions of the existing LS registry.
// No required-child policy is inferred from template examples or prose.
async function scanStructure(data, registry, progress = () => {}, cancelled = () => false, contracts = {}, structureIndex = null) {
  const layers = data.rawLayers || [], byId = structureIndex?.sourceById || new Map(), children = structureIndex?.sourceChildren || new Map();
  const findings = [], unchecked = new Set(), nodes = [], coverage = [];
  let executedCheckCount = 0;
  const rules = new Map(registry.rules.map(rule => [rule.id, rule]));
  const group = layer => layer.layerSection?._value === 'layerSectionStart';
  const profiles = registry.components.map(profile => ({ ...profile, pattern: new RegExp(profile.canonicalNamePattern) }));
  const contractId = profile => profile.id === 'textCTA' ? 'cta' : profile.id === 'ctvOttScenes' ? 'ctvOtt' : profile.id;
  for (const contract of contracts.profiles || []) coverage.push({ id: contract.id, basis: contract.basis, instances: 0, executed: [], unchecked: [...contract.requiredChildren, ...contract.checks] });
  if (!structureIndex) for (const layer of layers) {
    byId.set(layer.layerID, layer);
    if (!children.has(layer.parentLayerID)) children.set(layer.parentLayerID, []);
    children.get(layer.parentLayerID).push(layer);
  }
  function ancestry(layer) {
    const chain = [], seen = new Set();
    while (layer && !seen.has(layer.layerID)) {
      seen.add(layer.layerID); chain.unshift(layer); layer = byId.get(layer.parentLayerID);
    }
    return chain;
  }
  function add(id, layer, expected, detected, severity, evidence = {}) {
    const rule = rules.get(id), chain = ancestry(layer);
    findings.push({ ruleId: id, title: rule.title, severity: severity || (rule.severity === 'error' ? 'review' : rule.severity), basis: rule.basis,
      layerId: layer.layerID, path: chain.map(node => node.name).join(' / '),
      artboardId: chain.find(node => (data.document?.artboards || []).includes(node.layerID))?.layerID,
      ancestryIds: chain.map(node => node.layerID), expected, detected, fix: rule.repair, ...evidence });
  }
  function checkContract(profile, layer, direct) {
    const contract = contracts.profiles?.find(item => item.id === contractId(profile));
    if (!contract || contract.id === 'cta' || contract.id === 'ctvOtt') return;
    const audit = coverage.find(item => item.id === contract.id);
    audit.instances++;
    for (const requirement of contract.requiredChildren) {
      // Explicit literal children and typed children only. Descriptive
      // requirements, inheritance and runtime behavior stay unchecked.
      const literal = /^([A-Za-z][A-Za-z0-9]*)(?:: (rectangle shape|shape|group|pixel\/Smart Object))?$/.exec(requirement);
      let pattern, kind, owners = [layer];
      if (literal) { pattern = new RegExp('^' + literal[1] + '$'); kind = literal[2]; }
      else {
        const alternatives = /^(before or left|after or right): group$/.exec(requirement);
        if (alternatives) { pattern = new RegExp('^(' + alternatives[1].replace(' or ', '|') + ')$'); kind = 'group'; }
        else {
        const nested = /^(slideN|triggerN)\/(frame|closeButton): (rectangle shape|rectangle or ellipse|pixel\/Smart Object)$/.exec(requirement);
        const state = /^(slide identifier groups|trigger identifier groups|target identifier groups|categoryN: groups)$/.exec(requirement);
        if (nested) { owners = direct.filter(node => group(node) && new RegExp('^' + nested[1].replace('N', '[0-9]+') + '$').test(node.name)); pattern = new RegExp('^' + nested[2] + '$'); kind = nested[3]; }
        else if (state) {
          const prefix = requirement.split(/ identifier|N:/)[0];
          // Use state grammar already represented by this profile, or its
          // documented control paths. No new identifier aliases introduced.
          if (![...profile.statePaths, ...profile.observedControlPaths].some(path => path.split('/')[0] === prefix + 'N')) continue;
          pattern = new RegExp('^' + prefix + '[0-9]+$'); kind = 'group';
        } else continue;
        }
      }
      if (!owners.length) continue;
      executedCheckCount += owners.length;
      if (!audit.executed.includes(requirement)) audit.executed.push(requirement);
      audit.unchecked = audit.unchecked.filter(item => item !== requirement);
      for (const owner of owners) {
        const childrenHere = (children.get(owner.layerID) || []).filter(node => !String(node.name || '').startsWith(registry.normalization.excludedAncestorPrefix));
        const named = childrenHere.filter(node => pattern.test(node.name || ''));
        const valid = named.filter(node => !kind || (kind === 'group' ? group(node) : kind === 'pixel/Smart Object' ? [1, 5].includes(node.layerKind) : node.layerKind === 4));
        if (!valid.length) add('LS-008', owner, requirement + ' (direct child)', named.length ? named.map(node => `${node.name} (kind ${node.layerKind})`).join(', ') : 'Required direct child absent', contract.basis === 'template-observed' ? 'review' : 'warning', {
          basis: contract.basis, contractId: contract.id, contractPages: contract.pages,
          fix: `Restore ${requirement} under its documented owner using the ${contract.id} authoring contract. Preserve component-specific optional children and source artwork.`
        });
        if (kind?.includes('rectangle')) {
          unchecked.add(`${contract.id}: shape subtype validation unchecked; exported layerKind confirms shape type only`);
        }
      }
    }
    const boundsCheck = 'If gallery and slide frames both exist, their bounds must match per guide.';
    if (contract.id === 'rmGallery' && contract.checks.includes(boundsCheck)) {
      const rootFrames = direct.filter(node => node.name === 'frame' && node.layerKind === 4);
      const rect = node => ['top', 'left', 'width', 'height'].map(key => typeof node.bounds?.[key] === 'number' ? node.bounds[key] : node.bounds?.[key]?._value);
      if (rootFrames.length === 1) for (const slide of direct.filter(node => group(node) && /^slide[0-9]+$/.test(node.name))) {
        const slideFrames = (children.get(slide.layerID) || []).filter(node => node.name === 'frame' && node.layerKind === 4);
        if (slideFrames.length !== 1) continue;
        const rootRect = rect(rootFrames[0]), slideRect = rect(slideFrames[0]);
        if (![...rootRect, ...slideRect].every(Number.isFinite)) continue;
        if (!audit.executed.includes(boundsCheck)) audit.executed.push(boundsCheck);
        audit.unchecked = audit.unchecked.filter(item => item !== boundsCheck);
        if (rootRect.some((value, i) => value !== slideRect[i])) add('LS-008', slideFrames[0], `Gallery frame bounds [top, left, width, height]: ${rootRect.join(', ')}`, `Slide frame bounds: ${slideRect.join(', ')}`, 'warning', {
          basis: contract.basis, contractId: contract.id, contractPages: contract.pages,
          fix: 'Match the optional slide frame bounds to its owning RM Gallery frame as documented. Preserve artwork layers and verify the intended crop.'
        });
      }
    }
  }
  for (let i = 0; i < layers.length; i++) {
    if (cancelled()) return null;
    const layer = layers[i], chain = ancestry(layer);
    nodes.push(structureIndex?.nodes.get(layer.layerID) || { layerId: layer.layerID, parentId: layer.parentLayerID, rawName: layer.name, path: chain.map(node => node.name).join(' / '), bounds: layer.bounds, order: layer.itemIndex, visible: layer.visible });
    // LS-002: hidden saved states are still audited; excluded ancestors are not.
    if (!chain.some(node => String(node.name || '').startsWith(registry.normalization.excludedAncestorPrefix))) {
      const direct = (children.get(layer.layerID) || []).filter(node => !String(node.name || '').startsWith(registry.normalization.excludedAncestorPrefix));
      const matched = profiles.filter(profile => profile.pattern.test(layer.name || '') && (profile.kind !== 'group' || group(layer)));
      const cta = group(layer) && (/^button\d*$/i.test(layer.name || ''));
      // Detect deviations from known component families for review, without
      // treating the deviation as a verified alias or applying its contract.
      if (!matched.length && !cta && group(layer)) {
        const candidate = profiles.find(profile => new RegExp('^' + profile.id + '(?:$|[0-9_-])', 'i').test(layer.name || ''));
        if (candidate) {
          add('LS-004', layer, candidate.canonicalNamePattern, `Unrecognized component name: ${layer.name}`, 'review');
          unchecked.add(`${ancestry(layer).map(node => node.name).join(' / ')} [ID ${layer.layerID}]: unknown component; authoring and runtime checks skipped`);
        }
      }
      if (cta && rules.has('LS-013')) {
        executedCheckCount += 3;
        const audit = coverage.find(item => item.id === 'cta');
        if (audit) { audit.instances++; audit.executed = ['buttonN: CTA group with positive integer N', 'frame: shape', 'When image/Smart Object background is present, its role name must be background.']; audit.unchecked = audit.unchecked.filter(item => !audit.executed.includes(item)); }
        if (!new RegExp(registry.components.find(profile => profile.id === 'textCTA').canonicalNamePattern).test(layer.name))
          add('LS-013', layer, 'buttonN, N = positive integer', layer.name);
        const frames = direct.filter(node => node.name === 'frame' && node.layerKind === 4);
        if (!frames.length) add('LS-013', layer, 'A direct frame child', direct.map(node => node.name).join(', ') || 'No direct children');
        for (const child of direct.filter(node => !group(node) && !node.textKey && [1, 5].includes(node.layerKind) && node.name !== 'background' && node.name !== 'frame'))
          add('LS-013', child, 'Optional CTA image/Smart Object named exactly background', child.name);
        unchecked.add('CTA runtime frame promotion, borders, clipping and stacking: production mapping unverified');
      }
      for (const profile of matched) {
        unchecked.add(`${profile.id}: runtime and remaining authoring checks are unchecked (${profile.basis})`);
        // Execute the selected profile's explicit authoring requirements.
        // Optional frame rules are never inherited from unrelated profiles.
        checkContract(profile, layer, direct);
        if (profile.rules.includes('LS-007') && profile.recommendedChildPaths.includes('frame')) {
          executedCheckCount++;
          const frames = direct.filter(node => node.name === 'frame' && node.layerKind === 4);
          if (frames.length > 1) add('LS-007', layer, 'At most one direct frame shape', `${frames.length} direct frame shapes`);
        }
        if (profile.rules.includes('LS-005')) {
          executedCheckCount++;
          for (const statePath of profile.statePaths.filter(path => !path.includes('<'))) {
            let owners = [layer];
            const segments = statePath.split('/');
            for (let s = 0; s < segments.length; s++) {
              const pattern = new RegExp('^' + segments[s].replace(/N/g, '[0-9]+') + '$');
              const next = [];
              for (const owner of owners) {
                const states = (children.get(owner.layerID) || []).filter(node => group(node) && pattern.test(node.name || ''));
                if (s === segments.length - 1) {
                  const keys = new Map();
                  for (const state of states) {
                    const key = state.name.replace(/\d+$/, digits => String(Number(digits)));
                    if (keys.has(key)) add('LS-005', state, `Unique ${key} among direct siblings of ${owner.name}`, `Duplicate state; other layer ID ${keys.get(key)}`);
                    else keys.set(key, state.layerID);
                  }
                }
                next.push(...states);
              }
              owners = next;
            }
          }
        }
      }
    }
    if ((i + 1) % 100 === 0 || i === layers.length - 1) {
      progress(i + 1, layers.length);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  unchecked.add('LS-001, LS-003, LS-004, LS-006, LS-008–LS-012: not fully implemented; no universal frame, slide or numbering requirement inferred');
  for (const audit of coverage) if (!audit.instances) audit.unchecked.unshift('No instance checked: no verified registry/context mapping was selected in this package');
  return { findings, unchecked: [...unchecked], coverage, executedCheckCount, coverageComplete: unchecked.size === 0, nodes, registryVersion: registry.schemaVersion };
}
function structureResultSummary(result) {
  const warnings = result.findings.filter(finding => finding.severity === 'warning').length;
  if (result.findings.length) return `${warnings} warning(s) · ${result.findings.length - warnings} item(s) needing review`;
  return result.executedCheckCount > 0
    ? 'No issues detected in executed checks'
    : 'No supported structural checks ran for this package';
}
function structureCoveragePresentation(result) {
  return {
    checkedProfiles: result.coverage.filter(profile => profile.instances > 0),
    unselectedProfileCount: result.coverage.filter(profile => profile.instances === 0).length,
    limitations: result.unchecked.filter(text => !text.includes(': unknown component;'))
  };
}
if (typeof module !== 'undefined') module.exports = { scanStructure };
