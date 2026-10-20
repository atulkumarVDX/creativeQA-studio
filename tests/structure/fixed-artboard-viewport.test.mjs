import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preview = readFileSync("preview/turbo-preview-7.9.11.html", "utf8");

test("preview keeps artboards at authored scale and scrolls narrow viewports", () => {
  const computeScale = preview.match(/function computeScale\([^)]*\) \{([\s\S]*?)\n  \}/);
  assert.ok(computeScale, "computeScale must exist");
  assert.match(computeScale[1], /^\s*return 1;\s*$/);
  assert.match(preview, /#stageWrap \{ padding-left: 0; padding-right: 0; overflow-x: auto; \}/);
  assert.match(preview, /\.stage-row-preview \{ justify-content: flex-start; width: max-content; min-width: 100%; \}/);
});
