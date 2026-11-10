import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pointer = readFileSync("preview/current-preview.ts", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const current = readFileSync("preview/turbo-preview-7.15.5.html", "utf8");

test("QA Studio uses one explicit current-preview pointer", () => {
  assert.match(pointer, /import previewSource from "\.\/turbo-preview-7\.15\.5\.html\?raw"/);
  assert.match(pointer, /version: "7\.15\.5"/);
  assert.match(pointer, /path: "preview\/turbo-preview-7\.15\.5\.html"/);
  assert.match(page, /import \{ currentPreview \} from "\.\.\/preview\/current-preview"/);
  assert.doesNotMatch(page, /import\.meta\.glob/);
  assert.doesNotMatch(page, /preview\/archive/);
});

test("the pointer metadata and current build badge agree", () => {
  assert.match(current, /const PREVIEW_BUILD = "7\.15\.5"/);
  assert.match(current, /id="buildVersionTag"/);
  assert.match(current, /window\.CSM_PREVIEW_BUILD = PREVIEW_BUILD/);
  assert.match(page, /const PREVIEW_VERSION = currentPreview\.version/);
  assert.match(page, /className="preview-version">\{PREVIEW_VERSION\}/);
});

test("Main Unit begins in Compare and names the focused alternative clearly", () => {
  assert.match(current, /id="compareToggle" class="seg-btn compare-toggle active"[^>]*aria-pressed="true">Compare/);
  assert.match(current, /id="previewModeBtn" class="seg-btn"[^>]*aria-pressed="false">Single view/);
  assert.match(current, /let compareEnabled = true;/);
  assert.match(current, /includedNames = new Set\(allEntries\.map\(entry => entry\.model\.name\)\);/);
});

test("layout audit is explicitly marked as beta and advisory", () => {
  assert.match(current, /id="layoutAuditBtn"[^>]*aria-label="Layout audit beta"/);
  assert.match(current, /#layoutAuditBtn::after[\s\S]*content:"BETA"/);
  assert.match(current, /Package ready for layout audit[\s\S]*layout-audit-beta-badge[\s\S]*>Beta<\/span>/);
  assert.match(current, /<h2>Layout audit <span class="layout-audit-beta-badge">Beta<\/span><\/h2>/);
  assert.match(current, /Advisory rendered-geometry checks · review before handoff/);
  assert.match(current, /Run beta audit/);
});

test("numbered CTA groups and the documented client-logo role are clickable QA targets", () => {
  assert.match(current, /const isCta = \/\^button\[1-9\]\\d\*\$\/i\.test\(layer\.name \|\| ''\) && frames\.length === 1;/);
  assert.match(current, /Project CTA contract: a numbered button group with one direct frame is/);
  assert.match(current, /button-clientLogo is the documented, actionable client-logo role/);
  assert.match(current, /targets\.add\(element\)/);
  assert.match(current, /target\.style\.pointerEvents = "auto"/);
  assert.match(current, /target\.classList\.add\("qa-clickout"\)/);
  assert.match(current, /target\?\.closest\("\.qa-clickout"\)/);
  assert.match(current, /layout-audit-mode \.cp-structure-group\.qa-clickout \{ cursor:crosshair; \}/);
});

test("category galleries keep category and nested slide states separate", () => {
  assert.match(current, /const categoryGroups = galleryChildren\.filter\(layer => \/\^category\\d\+\$\/i\.test/);
  assert.match(current, /homeLayerId: galleryChildren\.find/);
  assert.match(current, /gallery\.categories\[activeCategory\]/);
  assert.match(current, /function bindCategoryGalleryControls\(entry\)/);
  assert.match(current, /bindButton\(element, "Back to category list"/);
  assert.match(current, /bindButton\(element, "Previous category"/);
  assert.match(current, /bindButton\(element, "Next category"/);
});

test("gallery arrows wrap slide state and animate manual transitions only", () => {
  assert.match(current, /function moveGallerySlide\(step, entry = null\)/);
  assert.match(current, /\(currentIndex \+ step \+ slides\.length\) % slides\.length/);
  assert.match(current, /function addGalleryArrowHitAreas\(entry\)/);
  assert.match(current, /aria-label", direction > 0 \? "Next gallery slide" : "Previous gallery slide"/);
  assert.match(current, /function animateGallerySlide\(entry, direction, outgoing\)/);
  assert.match(current, /prefers-reduced-motion: reduce/);
  assert.match(current, /function bindGalleryArrow\(entry, element, direction, componentFamily\)/);
  assert.match(current, /aria-keyshortcuts", "Enter Space"/);
  assert.match(current, /gallery\.componentFamily/);
});

test("gallery arrow traversal defines export exclusions in its own script scope", () => {
  assert.match(current, /const P = window\.CSM_PREVIEW;\n  const NO_EXPORT_PREFIX = "\.";/);
  assert.match(current, /function galleryArrowTargets\(entry\)[\s\S]*?startsWith\(NO_EXPORT_PREFIX\)/);
});

test("canvas tabs delegate to the existing tab state controls", () => {
  assert.match(current, /function canvasTabNameFromTarget\(target\)/);
  assert.match(current, /stageWrap\.addEventListener\("click", event =>/);
  assert.match(current, /selectCanvasTab\(tabName\)/);
  assert.match(current, /activeSlide = null;/);
  assert.match(current, /menu\.style\.pointerEvents = "auto"/);
  assert.match(current, /trigger\.style\.pointerEvents = "auto"/);
  assert.match(current, /trigger\.style\.cursor = "pointer"/);
  assert.match(current, /title\.style\.cursor = "pointer"/);
  assert.match(current, /shape\.style\.cursor = "pointer"/);
  assert.match(current, /trigger\.tabIndex = 0/);
  assert.match(current, /trigger\.setAttribute\("aria-selected", String\(t\.active\)\)/);
});
