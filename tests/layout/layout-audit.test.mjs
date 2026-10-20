import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const previewPath = new URL("../../preview/archive/turbo-preview-7.9.6.html", import.meta.url);
const html = await readFile(previewPath, "utf8");

function section(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing section start: ${start}`);
  assert.notEqual(to, -1, `missing section end: ${end}`);
  return html.slice(from, to);
}

test("layout audit uses element selection independently of finding presence", () => {
  const handler = section('stageWrap.addEventListener("click", event => {', '}, true);');
  assert.match(handler, /const clicked = auditClickedElement\(event, stage\)/);
  assert.match(handler, /selectLayoutAuditElement\(entry, clicked\.element, clicked\.relatedLayerIds, matches\)/);
  assert.doesNotMatch(handler, /if \(!matches\.length\) return/);
  assert.ok(handler.indexOf("event.preventDefault()") < handler.indexOf("const matches"));
});

test("empty-canvas, same-element, and rerun paths clear persistent visual state", () => {
  assert.match(html, /if \(!clicked\.element\) \{\s*clearLayoutAuditSelection\(\)/);
  assert.match(html, /if \(sameElement && sameSelection\) clearLayoutAuditSelection\(\)/);
  const rerun = section("async function runLayoutAudit", "function prepareLayoutAuditForPackage");
  assert.match(rerun, /selectedElement = null/);
  assert.match(rerun, /clearLayoutAuditOverlayNodes\(\)/);
});

test("declared automated rules exactly match executable finding rules", () => {
  const registry = section("const LAYOUT_AUDIT_RULES", "const layoutAuditState");
  const evaluator = section("function inspectLayoutAuditStage", "function currentLayoutAuditArtboard");
  const declared = [...registry.matchAll(/id: "([A-Z]+-[0-9]+)"/g)].map(match => match[1]).sort();
  const executable = [...new Set([...evaluator.matchAll(/ruleId: "([A-Z]+-[0-9]+)"/g)].map(match => match[1]))].sort();
  assert.deepEqual(declared, executable);
  assert.ok(declared.length >= 12);
});

test("finding cards expose severity, difference, and layer identity", () => {
  const renderer = section("function renderLayoutAuditFindings", "function clearLayoutAuditOverlayNodes");
  assert.match(renderer, /severityLabel\.textContent = accepted \? "accepted" : finding\.severity/);
  assert.match(renderer, /\["difference", auditSignedPx\(finding\.delta\)\]/);
  assert.match(renderer, /finding\.layerName/);
  assert.match(renderer, /finding\.layerId/);
});

test("coverage and rerun summaries distinguish package and current-view scope", () => {
  assert.match(html, /skippedArtboards/);
  assert.match(html, /source-only\/non-preview artboard/);
  assert.match(html, /current-view states refreshed/);
  assert.match(html, /package states retained/);
});

test("alignment guide reaches both elements and the label clears the CTA", () => {
  const context = vm.createContext({});
  vm.runInContext(section("function auditMeasurementGeometry", "function appendAuditMeasurement"), context);
  vm.runInContext(section("function auditPlaceLabel", "function renderSelectedLayoutAuditOverlays"), context);
  const cta = { left: 176, top: 378, right: 447, bottom: 416, centerX: 311.5, centerY: 397 };
  const copy = { left: 193, top: 321, right: 750, bottom: 342, centerX: 471.5, centerY: 331.5 };
  const stage = { clientWidth: 970, clientHeight: 546 };
  const guide = context.auditMeasurementGeometry({ ruleId: "CTA-007", expected: "shared left alignment" }, cta, copy, stage, null);
  assert.equal(guide.points[0][0], 176);
  assert.equal(guide.points[1][0], 193);
  assert.ok(guide.segments.some(segment => segment[0] === 193 && segment[1] === copy.bottom));
  const label = context.auditPlaceLabel(cta, copy, 230, 34, 970, 546, []);
  assert.ok(label.left > cta.right);
  assert.ok(label.right < 970);
  assert.ok(label.bottom <= 546);
  const narrowCta = { left: 10, top: 421, right: 116, bottom: 479, centerX: 63, centerY: 450 };
  const narrowCopy = { left: 23, top: 329, right: 122, bottom: 403 };
  const compactLabel = context.auditPlaceLabel(narrowCta, narrowCopy, 96, 24, 160, 600, [], true);
  assert.equal(compactLabel.left, narrowCta.left);
  assert.equal(compactLabel.top, narrowCta.bottom + 6);
  assert.ok(compactLabel.bottom < 520);
  assert.ok(compactLabel.left >= 8 && compactLabel.right <= 152);
});

test("supports primary and comparison element selection", () => {
  assert.match(html, /event\.shiftKey/);
  assert.match(html, /comparisonElements/);
  assert.match(html, /addComparison/);
  assert.match(html, /layoutAuditState\.selectedElement/);
});

test("does not warn when a spacing measurement has no traceable target", () => {
  assert.match(html, /targetSource: "none"/);
  assert.match(html, /Measured.*No target|\[\["measured", finding\.actual\], \["target", "No target"\]\]/);
  assert.match(html, /severity: "info"/);
});

test("checks the shared left edge across heading, copy, and CTA", () => {
  assert.match(html, /TYPE-003/);
  assert.match(html, /heading, sub-copy, and CTA/);
  assert.match(html, /auditCopyContentRect/);
  assert.match(html, /a leading bullet is audited/);
  assert.match(html, /separately and never becomes the shared CTA alignment anchor/);
  assert.match(html, /comparisonMeasurements/);
  assert.match(html, /Manual comparison ·/);
  assert.match(html, /No expected value/);
  assert.match(html, /box-shadow:inset 0 0 0 9999px rgba\(84,211,154,.4\)/);
  assert.match(html, /audit-chip-manual/);
  assert.match(html, /relationshipFindings/);
  assert.match(html, /Comparison mode shows only findings that belong to the selected pair/);
});

test("renders compact measurement chips and limits overlay density", () => {
  assert.match(html, /audit-chip/);
  assert.match(html, /auditMeasurementChipValue/);
  assert.match(html, /maxVisibleRelationships/);
  assert.match(html, /slice\(0, layoutAuditState\.maxVisibleRelationships\)/);
  assert.match(html, /stroke:none; filter:drop-shadow/);
  const overlay = section("function renderSelectedLayoutAuditOverlays", "function selectLayoutAuditFindings");
  assert.doesNotMatch(overlay, /audit-label|const leader|group\.append\(leader/);
});

test("supports scoped finding exceptions with accepted counts and undo", () => {
  assert.match(html, /Accept exception/);
  assert.match(html, /This relationship only/);
  assert.match(html, /This element on this artboard/);
  assert.match(html, /This rule across package/);
  assert.match(html, /acceptedExceptions: new Map/);
  assert.match(html, /isLayoutAuditFindingAccepted/);
  assert.match(html, /layoutAuditUndoException/);
  assert.match(html, /accepted/);
  assert.match(html, /findingActions\.append\(button, acceptButton\)/);
  assert.match(html, /layout-audit-finding-actions \.layout-audit-accept-button \{ margin-left:auto !important;/);
  assert.match(html, /Restore exception/);
  assert.match(html, /accepted \? "#54d39a"/);
});
