import assert from "node:assert/strict";
import test from "node:test";

import { boxFeedbackConfig, uploadFeedbackToBox } from "../../scripts/box-feedback-upload.mjs";

const env = {
  BOX_CLIENT_ID: "client-id",
  BOX_CLIENT_SECRET: "client-secret",
  BOX_ENTERPRISE_ID: "enterprise-id",
  BOX_FEEDBACK_FOLDER_ID: "folder-id",
};

test("Box feedback configuration fails closed when credentials are missing", () => {
  assert.throws(() => boxFeedbackConfig({}), /not configured/i);
});

test("feedback upload authenticates server-side and targets the configured folder", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response(JSON.stringify({ access_token: "token" }), { status: 200 });
    return new Response(JSON.stringify({ entries: [{ id: "42", name: "feedback.zip" }] }), { status: 201 });
  };

  const result = await uploadFeedbackToBox({ bytes: new Uint8Array([1, 2, 3]), filename: "feedback.zip", env, fetchImpl });

  assert.equal(calls[0].url, "https://api.box.com/oauth2/token");
  assert.match(String(calls[0].options.body), /grant_type=client_credentials/);
  assert.equal(calls[1].url, "https://upload.box.com/api/2.0/files/content");
  assert.equal(calls[1].options.headers.Authorization, "Bearer token");
  assert.deepEqual(JSON.parse(calls[1].options.body.get("attributes")), { name: "feedback.zip", parent: { id: "folder-id" } });
  assert.equal(result.url, "https://app.box.com/file/42");
});

test("feedback upload surfaces Box authentication failures without exposing credentials", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: "invalid_client" }), { status: 401 });
  await assert.rejects(
    uploadFeedbackToBox({ bytes: new Uint8Array([1]), filename: "feedback.zip", env, fetchImpl }),
    error => /Box authentication failed \(401\)/.test(error.message) && !error.message.includes(env.BOX_CLIENT_SECRET),
  );
});
