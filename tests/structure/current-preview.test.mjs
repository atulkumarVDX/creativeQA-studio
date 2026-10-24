import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pointer = readFileSync("preview/current-preview.ts", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const current = readFileSync("preview/turbo-preview-7.12.5.html", "utf8");

test("QA Studio uses one explicit current-preview pointer", () => {
  assert.match(pointer, /import previewSource from "\.\/turbo-preview-7\.12\.5\.html\?raw"/);
  assert.match(pointer, /version: "7\.12\.5"/);
  assert.match(pointer, /path: "preview\/turbo-preview-7\.12\.5\.html"/);
  assert.match(page, /import \{ currentPreview \} from "\.\.\/preview\/current-preview"/);
  assert.doesNotMatch(page, /import\.meta\.glob/);
  assert.doesNotMatch(page, /preview\/archive/);
});

test("the pointer metadata and current build badge agree", () => {
  assert.match(current, /const PREVIEW_BUILD = "7\.12\.5"/);
  assert.match(current, /id="buildVersionTag"/);
  assert.match(current, /window\.CSM_PREVIEW_BUILD = PREVIEW_BUILD/);
  assert.match(page, /const PREVIEW_VERSION = currentPreview\.version/);
  assert.match(page, /className="preview-version">\{PREVIEW_VERSION\}/);
});

test("gallery arrows wrap slide state and animate manual transitions only", () => {
  assert.match(current, /function moveGallerySlide\(step, entry = null\)/);
  assert.match(current, /\(currentIndex \+ step \+ slides\.length\) % slides\.length/);
  assert.match(current, /function addGalleryArrowHitAreas\(entry\)/);
  assert.match(current, /aria-label", direction > 0 \? "Next gallery slide" : "Previous gallery slide"/);
  assert.match(current, /function animateGallerySlide\(entry, direction, outgoing\)/);
  assert.match(current, /prefers-reduced-motion: reduce/);
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
