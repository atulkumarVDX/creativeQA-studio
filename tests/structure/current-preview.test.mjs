import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pointer = readFileSync("preview/current-preview.ts", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const current = readFileSync("preview/turbo-preview-7.12.0.html", "utf8");

test("QA Studio uses one explicit current-preview pointer", () => {
  assert.match(pointer, /import previewSource from "\.\/turbo-preview-7\.12\.0\.html\?raw"/);
  assert.match(pointer, /version: "7\.12\.0"/);
  assert.match(pointer, /path: "preview\/turbo-preview-7\.12\.0\.html"/);
  assert.match(page, /import \{ currentPreview \} from "\.\.\/preview\/current-preview"/);
  assert.doesNotMatch(page, /import\.meta\.glob/);
  assert.doesNotMatch(page, /preview\/archive/);
});

test("the pointer metadata and current build badge agree", () => {
  assert.match(current, /const PREVIEW_BUILD = "7\.12\.0"/);
  assert.match(current, /id="buildVersionTag"/);
  assert.match(current, /window\.CSM_PREVIEW_BUILD = PREVIEW_BUILD/);
  assert.match(page, /const PREVIEW_VERSION = currentPreview\.version/);
  assert.match(page, /className="preview-version">\{PREVIEW_VERSION\}/);
});
