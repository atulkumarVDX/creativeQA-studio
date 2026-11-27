import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hookSource = readFileSync(new URL("../../features/preview-bridge/use-preview-messages.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
const teaserSource = readFileSync(new URL("../../features/teasers/use-teaser-workflow.ts", import.meta.url), "utf8");
test("host preview message handling stays in the preview bridge hook", () => {
  assert.match(hookSource, /window\.addEventListener\("message", listener\)/);
  assert.match(hookSource, /window\.removeEventListener\("message", listener\)/);
  assert.match(hookSource, /event\.data\?\.token !== bridgeToken/);
  for (const messageType of [
    "tqa:capture-state",
    "tqa:package-meta",
    "tqa:mobile-instream-frame",
    "tqa:mobile-instream-frame-error",
    "tqa:preview-ready",
    "tqa:preview-error",
  ]) {
    assert.ok(hookSource.includes(messageType), `missing host handling for ${messageType}`);
  }
  assert.match(pageSource, /usePreviewMessages\(\{/);
});
test("teaser bytes are extracted only after Teasers is selected", () => {
  assert.match(pageSource, /if \(section === "teasers"\) void teaserWorkflow\.loadTeaserAssets\(\)/);
  assert.match(teaserSource, /await extractPackageFiles\(source\.file,/);
  assert.match(teaserSource, /selectTeaserAssetNames\(source\.assets\)/);
  assert.doesNotMatch(pageSource, /extractPackageFiles|isTeaserAsset|function loadTeaserAssets/);
});

test("teaser workflow owns blob cleanup and generated mobile instream coordination", () => {
  assert.match(teaserSource, /function revokeMediaUrls\(media: TeaserMedia \| null\)/);
  assert.match(teaserSource, /URL\.revokeObjectURL\(url\)/);
  assert.match(teaserSource, /teaserLayoutUrlsRef\.current\.forEach\(url => URL\.revokeObjectURL\(url\)\)/);
  assert.match(teaserSource, /generationNeededRef\.current = Boolean\(needsGeneration && hasVideo\)/);
  assert.match(teaserSource, /pendingFrame\?\.requestId === generationRequestRef\.current/);
  assert.match(teaserSource, /type: "tqa:capture-mobile-instream"/);
  assert.match(pageSource, /teaserWorkflow\.applyPreparedPackage\(/);
  assert.match(pageSource, /teaserWorkflow\.beginPackage\(\)/);
});
