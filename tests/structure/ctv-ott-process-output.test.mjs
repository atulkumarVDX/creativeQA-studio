import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { appendBoundedOutput } from "../../scripts/process-output.mjs";

const renderer = readFileSync(new URL("../../scripts/ctv-ott-renderer.mjs", import.meta.url), "utf8");

test("renderer keeps only bounded recent subprocess stderr", () => {
  assert.match(renderer, /stderr = appendBoundedOutput\(stderr, chunk\)/);

  let captured = "";
  const limit = 128;
  for (let index = 0; index < 1_000; index += 1) {
    captured = appendBoundedOutput(captured, `diagnostic-${index}\n`, limit);
    assert.ok(Buffer.byteLength(captured) <= limit);
  }
  assert.match(captured, /diagnostic-999\n$/);
  assert.doesNotMatch(captured, /diagnostic-0\n/);
});

test("bounded stderr still retains the useful tail of a large diagnostic chunk", () => {
  const captured = appendBoundedOutput("old output", `${"x".repeat(200_000)}final error`, 64);
  assert.ok(Buffer.byteLength(captured) <= 64);
  assert.equal(captured, `${"x".repeat(53)}final error`);
});
