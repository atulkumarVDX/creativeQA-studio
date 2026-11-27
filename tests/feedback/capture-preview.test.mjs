import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";

const source = readFileSync(new URL("../../features/feedback/capture-preview.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadCapturePreview(windowMock) {
  const compiledModule = { exports: {} };
  new Function("require", "module", "exports", javascript)((name) => { throw new Error(`Unexpected import: ${name}`); }, compiledModule, compiledModule.exports);
  return { captureFeedbackPreview: compiledModule.exports.captureFeedbackPreview, windowMock };
}

test("preview capture rejects when the active iframe is unavailable", async () => {
  const { captureFeedbackPreview } = loadCapturePreview({});
  await assert.rejects(captureFeedbackPreview(null, "bridge-token"), /active preview is unavailable/);
});

test("preview capture accepts only the matching token and request and removes its listener", async () => {
  let listener;
  let posted;
  let removed;
  let timerCleared = false;
  const windowMock = {
    setTimeout(callback) { this.timeout = callback; return 123; },
    clearTimeout(id) { timerCleared = id === 123; },
    addEventListener(type, callback) { assert.equal(type, "message"); listener = callback; },
    removeEventListener(type, callback) { assert.equal(type, "message"); removed = callback === listener; },
  };
  globalThis.window = windowMock;
  try {
    const { captureFeedbackPreview } = loadCapturePreview(windowMock);
    const frame = { contentWindow: { postMessage(message, target) { posted = { message, target }; } } };
    const resultPromise = captureFeedbackPreview(frame, "bridge-token");
    assert.equal(posted.target, "*");
    assert.equal(posted.message.type, "tqa:capture-feedback");
    listener({ data: { token: "wrong-token", requestId: posted.message.requestId, type: "tqa:feedback-capture", dataUrl: "wrong" } });
    listener({ data: { token: "bridge-token", requestId: "wrong-request", type: "tqa:feedback-capture", dataUrl: "wrong" } });
    listener({ data: { token: "bridge-token", requestId: posted.message.requestId, type: "tqa:feedback-capture", dataUrl: "data:image/png;base64,AA==", state: { artboard: "300x250" } } });
    assert.deepEqual(await resultPromise, { dataUrl: "data:image/png;base64,AA==", state: { artboard: "300x250" } });
    assert.equal(timerCleared, true);
    assert.equal(removed, true);
  } finally {
    delete globalThis.window;
  }
});
