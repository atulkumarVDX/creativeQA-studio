import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ts from "typescript";

const serviceSource = readFileSync(new URL("../../features/ctv-ott/render-package.ts", import.meta.url), "utf8");
const serviceJavaScript = ts.transpileModule(serviceSource, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const serviceModule = await import(`data:text/javascript;base64,${Buffer.from(serviceJavaScript).toString("base64")}`);
const { ctvOttRenderErrorMessage, renderCtvOttVideos } = serviceModule;

test("CTV/OTT host service checks health, posts each requested format, and returns video URLs", async () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const calls = [];
  let nextUrl = 0;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/health")) return new Response("{}", { status: 200 });
    return new Response(new Blob([String(input)]), { status: 200 });
  };
  URL.createObjectURL = () => `blob:ctv-ott-test-${++nextUrl}`;

  try {
    const file = new File(["zip"], "campaign.zip", { type: "application/zip" });
    const videos = await renderCtvOttVideos(file, ["ctv", "ott"]);
    assert.deepEqual(videos, { ctv: "blob:ctv-ott-test-1", ott: "blob:ctv-ott-test-2" });
    assert.equal(calls[0].url, "/api/ctv-ott/health");
    assert.equal(calls[1].url, "/api/ctv-ott/render?format=ctv");
    assert.equal(calls[2].url, "/api/ctv-ott/render?format=ott");
    assert.equal(calls[1].init.headers["X-Package-Name"], "campaign.zip");
    assert.equal(calls[1].init.body, file);
  } finally {
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectURL;
  }
});

test("CTV/OTT host service reports renderer API errors and connection guidance", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => String(input).endsWith("/health")
    ? new Response("{}", { status: 200 })
    : Response.json({ error: "Unsupported package profile." }, { status: 422 });

  try {
    await assert.rejects(
      renderCtvOttVideos(new File(["zip"], "campaign.zip"), ["ctv"]),
      /CTV render failed: Unsupported package profile\./,
    );
    assert.match(ctvOttRenderErrorMessage(new TypeError("Failed to fetch")), /Start QA Studio with npm run dev/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
