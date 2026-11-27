import assert from "node:assert/strict";
import test from "node:test";
import { createFeedbackService } from "../../scripts/feedback-service.mjs";

function responseRecorder() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

test("feedback service routes only the existing POST endpoints", async () => {
  const handleFeedbackRequest = createFeedbackService({
    jsonResponse(response, status, body) {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify(body));
    },
  });
  const response = responseRecorder();

  assert.equal(await handleFeedbackRequest(
    { method: "GET", headers: {} }, response, new URL("http://localhost/feedback/upload")
  ), false);
  assert.equal(await handleFeedbackRequest(
    { method: "POST", headers: { origin: "https://untrusted.example" } },
    response,
    new URL("http://localhost/feedback/upload")
  ), true);
  assert.equal(response.status, 403);
  assert.deepEqual(JSON.parse(response.body), {
    error: "Feedback submissions are accepted only from the local QA Studio app.",
  });
});

test("Notion feedback routes keep their origin rejection contract", async () => {
  const originalEnvironment = Object.fromEntries(
    ["TURBO_APP_ORIGIN", "NOTION_API_TOKEN", "NOTION_PILOT_DATABASE_ID", "NOTION_FEEDBACK_DATABASE_ID"]
      .map(name => [name, process.env[name]])
  );
  process.env.NOTION_API_TOKEN = "test-token";
  process.env.NOTION_PILOT_DATABASE_ID = "pilot-db";
  process.env.NOTION_FEEDBACK_DATABASE_ID = "feedback-db";
  delete process.env.TURBO_APP_ORIGIN;
  try {
    const handleFeedbackRequest = createFeedbackService({
      jsonResponse(response, status, body) {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body));
      },
    });
    for (const pathname of ["/notion/pilot-session", "/notion/feedback-submission"]) {
      const response = responseRecorder();
      assert.equal(await handleFeedbackRequest(
        { method: "POST", headers: { origin: "https://untrusted.example" } },
        response,
        new URL(`http://localhost${pathname}`)
      ), true);
      assert.equal(response.status, 403);
      assert.match(JSON.parse(response.body).error, /accepted only from the QA Studio app/);
    }
  } finally {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("Box upload keeps its local-origin and missing-configuration response", async () => {
  const names = ["BOX_CLIENT_ID", "BOX_CLIENT_SECRET", "BOX_ENTERPRISE_ID", "BOX_FEEDBACK_FOLDER_ID"];
  const originalEnvironment = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  try {
    const handleFeedbackRequest = createFeedbackService({
      jsonResponse(response, status, body) {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(body));
      },
    });
    const response = responseRecorder();
    const request = {
      method: "POST",
      headers: { origin: "http://localhost:5173", "x-feedback-filename": "review.zip" },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from("zip bytes");
      },
    };

    assert.equal(await handleFeedbackRequest(request, response, new URL("http://localhost/feedback/upload")), true);
    assert.equal(response.status, 503);
    assert.match(JSON.parse(response.body).error, /Box submission is not configured/i);
  } finally {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
