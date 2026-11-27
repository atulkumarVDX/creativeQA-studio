import { basename } from "node:path";
import { uploadFeedbackToBox } from "./box-feedback-upload.mjs";

const MAX_FEEDBACK_BYTES = 1 * 1024 * 1024 * 1024;
const MAX_NOTION_EVENT_BYTES = 32 * 1024;

export function createFeedbackService({ jsonResponse }) {
  async function receiveJson(request, maxBytes = MAX_NOTION_EVENT_BYTES) {
    const chunks = [];
    let received = 0;
    for await (const chunk of request) {
      received += chunk.length;
      if (received > maxBytes) throw new Error("The usage summary is too large.");
      chunks.push(chunk);
    }
    if (!received) throw new Error("The usage summary was empty.");
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }

  function notionRichText(value, maxLength = 1800) {
    const text = String(value ?? "").trim().slice(0, maxLength);
    return text ? [{ type: "text", text: { content: text } }] : [];
  }

  function notionSelect(value) {
    const name = String(value ?? "").trim();
    return name ? { select: { name } } : { select: null };
  }

  const NOTION_PILOT_VERSION = "2025-09-03";
  const NOTION_PILOT_PROPERTY_TYPES = {
    "Tester code": "rich_text",
    "Date": "date",
    "App version": "rich_text",
    "Package opened": "select",
    "Steps reached": "multi_select",
    "Tools used": "multi_select",
    "Time to first result (min)": "number",
    "Main blocker": "rich_text",
    "Ease rating": "number",
    "Tester comments": "rich_text"
  };

  async function notionRequest(path, token, options = {}) {
    const response = await fetch(`https://api.notion.com/v1/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_PILOT_VERSION,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Notion could not save this session.");
    return result;
  }

  async function findNotionDataSource(databaseId, token, databaseName = "Notion", propertyTypes = NOTION_PILOT_PROPERTY_TYPES) {
    const database = await notionRequest(`databases/${databaseId}`, token);
    const sources = Array.isArray(database.data_sources) ? database.data_sources : [];
    if (!sources.length) throw new Error(`Notion could not find a data source in the ${databaseName} database.`);

    const schemas = await Promise.all(sources.map(async source => {
      try {
        const dataSource = await notionRequest(`data_sources/${source.id}`, token);
        return { id: source.id, properties: dataSource.properties || {} };
      } catch {
        return null;
      }
    }));
    const compatible = schemas.filter(source => source && Object.values(source.properties).some(property => property.type === "title"));
    if (!compatible.length) throw new Error(`Notion could not read a title column in the ${databaseName} database.`);

    const score = source => Object.entries(propertyTypes).reduce((total, [name, type]) => (
      total + (source.properties[name]?.type === type ? 1 : 0)
    ), 0);
    compatible.sort((left, right) => score(right) - score(left));
    return compatible[0];
  }

  async function handleNotionPilotSession(request, response) {
    const token = process.env.NOTION_API_TOKEN;
    const databaseId = process.env.NOTION_PILOT_DATABASE_ID;
    if (!token || !databaseId) return jsonResponse(response, 503, { error: "Notion tracking is not configured." });
    const origin = request.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
        const configured = String(process.env.TURBO_APP_ORIGIN || "").replace(/\/$/, "");
        if (!local && (!configured || parsed.origin !== configured)) return jsonResponse(response, 403, { error: "Usage summaries are accepted only from the QA Studio app." });
      } catch {
        return jsonResponse(response, 403, { error: "Invalid app origin." });
      }
    }
    try {
      const body = await receiveJson(request);
      const fields = {
        "Session": { title: notionRichText(body.session, 100) },
        "Tester code": { rich_text: notionRichText(body.testerCode, 80) },
        "Date": { date: body.startedAt ? { start: new Date(body.startedAt).toISOString() } : null },
        "App version": { rich_text: notionRichText(body.appVersion, 40) },
        "Package opened": notionSelect(body.packageOpened),
        "Steps reached": { multi_select: (Array.isArray(body.stepsReached) ? body.stepsReached : []).slice(0, 12).map(name => ({ name: String(name).slice(0, 100) })) },
        "Tools used": { multi_select: (Array.isArray(body.toolsUsed) ? body.toolsUsed : []).slice(0, 12).map(name => ({ name: String(name).slice(0, 100) })) },
        "Time to first result (min)": { number: Number.isFinite(body.timeToFirstResultMinutes) ? Math.max(0, Math.min(1440, body.timeToFirstResultMinutes)) : null },
        "Main blocker": { rich_text: notionRichText(body.mainBlocker) },
        "Ease rating": { number: Number.isFinite(body.easeRating) ? Math.max(1, Math.min(5, body.easeRating)) : null },
        "Tester comments": { rich_text: notionRichText(body.comments) }
      };
      const normalizedDatabaseId = databaseId.replace(/-/g, "");
      const dataSource = await findNotionDataSource(normalizedDatabaseId, token, "Pilot Sessions");
      const titleProperty = Object.entries(dataSource.properties).find(([, property]) => property.type === "title")?.[0];
      const compatibleFields = Object.fromEntries(Object.entries(fields).filter(([name]) => (
        name === "Session" || dataSource.properties[name]?.type === NOTION_PILOT_PROPERTY_TYPES[name]
      )));
      compatibleFields[titleProperty] = fields.Session;
      delete compatibleFields.Session;
      const result = await notionRequest("pages", token, {
        method: "POST",
        body: JSON.stringify({
          parent: { type: "data_source_id", data_source_id: dataSource.id },
          properties: compatibleFields
        })
      });
      return jsonResponse(response, 201, { ok: true, id: result.id });
    } catch (error) {
      const message = error?.message || "Could not read the usage summary.";
      return jsonResponse(response, 502, { error: message });
    }
  }

  async function handleNotionFeedbackSubmission(request, response) {
    const token = process.env.NOTION_API_TOKEN;
    const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID;
    if (!token || !databaseId) return jsonResponse(response, 503, { error: "Notion feedback submissions are not configured." });
    const origin = request.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin);
        const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
        const configured = String(process.env.TURBO_APP_ORIGIN || "").replace(/\/$/, "");
        if (!local && (!configured || parsed.origin !== configured)) return jsonResponse(response, 403, { error: "Feedback records are accepted only from the QA Studio app." });
      } catch { return jsonResponse(response, 403, { error: "Invalid app origin." }); }
    }
    try {
      const body = await receiveJson(request);
      const reviewer = String(body.reviewer || "").trim().slice(0, 100);
      const bundleUrlInput = String(body.bundleUrl || "").trim();
      let bundleUrl;
      try {
        const parsed = new URL(bundleUrlInput);
        if (parsed.protocol !== "https:" || !(parsed.hostname === "box.com" || parsed.hostname.endsWith(".box.com"))) throw new Error();
        bundleUrl = parsed.href.slice(0, 2000);
      } catch { return jsonResponse(response, 400, { error: "Enter a valid HTTPS Box file link." }); }
      if (!reviewer) return jsonResponse(response, 400, { error: "Reviewer name is required." });
      const testCase = body.testCase && typeof body.testCase === "object" ? body.testCase : null;
      if (testCase && !["In progress", "Pass", "Fail", "Needs improvement", "Blocked", "Not applicable"].includes(String(testCase.status))) return jsonResponse(response, 400, { error: "Choose a case status before sharing." });
      const feedbackType = String(body.feedbackType || "Other").slice(0, 100);
      const reference = String(body.productionReference || "").trim();
      const packageName = String(body.package || "Not recorded").slice(0, 180);
      const caseTitle = testCase ? `${testCase.id} · ${testCase.name}` : "General feedback";
      const title = `${feedbackType} — ${caseTitle}`.slice(0, 100);
      const schemaTypes = {
        Reviewer: "rich_text", "Review date": "date", "App version": "rich_text", Package: "rich_text",
        "Feedback type": "select", "Test case": "rich_text", "Test case priority": "select", "Case status": "select", "Feedback bundle URL": "url", "Bundle file": "rich_text", Reference: "url",
        Description: "rich_text", "Actual result": "rich_text", "Expected result": "rich_text", "Steps to reproduce": "rich_text",
        "Evidence included": "rich_text", "Supporting files": "rich_text", "Pasted evidence": "rich_text",
      };
      const properties = {
        Review: { title: notionRichText(title, 100) },
        Reviewer: { rich_text: notionRichText(reviewer, 100) },
        "Review date": { date: { start: new Date().toISOString() } },
        "App version": { rich_text: notionRichText(body.appVersion, 40) },
        Package: { rich_text: notionRichText(packageName, 180) },
        "Feedback type": notionSelect(feedbackType),
        "Test case": { rich_text: notionRichText(caseTitle, 180) },
        "Test case priority": notionSelect(testCase?.priority),
        "Case status": notionSelect(testCase?.status),
        "Feedback bundle URL": { url: bundleUrl },
        "Bundle file": { rich_text: notionRichText(body.bundleFilename, 180) },
        Reference: { url: /^https?:\/\//i.test(reference) ? reference.slice(0, 2000) : null },
        Description: { rich_text: notionRichText(body.description, 1800) },
        "Actual result": { rich_text: notionRichText(body.actualResult, 1800) },
        "Expected result": { rich_text: notionRichText(body.expectedResult, 1800) },
        "Steps to reproduce": { rich_text: notionRichText(body.reproductionSteps, 1800) },
        "Evidence included": { rich_text: notionRichText(body.evidenceSummary, 1800) },
        "Supporting files": { rich_text: notionRichText(Array.isArray(body.supportingFiles) ? body.supportingFiles.join(", ") : "", 1800) },
        "Pasted evidence": { rich_text: notionRichText(Array.isArray(body.pastedImages) ? body.pastedImages.join(", ") : "", 1800) },
      };
      const dataSource = await findNotionDataSource(databaseId.replace(/-/g, ""), token, "Report feedback");
      const titleProperty = Object.entries(dataSource.properties).find(([, property]) => property.type === "title")?.[0];
      const compatible = Object.fromEntries(Object.entries(properties).filter(([name]) => name === "Review" || dataSource.properties[name]?.type === schemaTypes[name]));
      for (const name of ["Feedback type", "Case status", "Test case priority"]) {
        const select = compatible[name]?.select;
        if (select && !dataSource.properties[name]?.select?.options?.some(option => option.name === select.name)) delete compatible[name];
      }
      compatible[titleProperty] = properties.Review;
      delete compatible.Review;
      const blocks = [
        `Reviewer: ${reviewer}`, `Build: ${String(body.appVersion || "").slice(0, 40)}`,
        `Package: ${packageName}`, `Feedback type: ${feedbackType}`, `Test case: ${caseTitle}`,
        ...(testCase ? [`Case status: ${testCase.status}`, `Area: ${testCase.area || ""}`, `Priority: ${testCase.priority || ""}`] : []),
        `Feedback bundle: ${bundleUrl}`, `Bundle file: ${String(body.bundleFilename || "").slice(0, 180)}`,
        ...(reference ? [`CCRV or Showcase URL: ${reference}`] : []),
        ...(body.description ? [`Description: ${String(body.description)}`] : []),
        ...(body.actualResult ? [`Actual result: ${String(body.actualResult)}`] : []),
        ...(body.expectedResult ? [`Expected result: ${String(body.expectedResult)}`] : []),
        ...(body.reproductionSteps ? [`Steps to reproduce: ${String(body.reproductionSteps)}`] : []),
        ...(body.evidenceSummary ? [`Evidence in bundle: ${String(body.evidenceSummary)}`] : []),
        ...(Array.isArray(body.supportingFiles) && body.supportingFiles.length ? [`Supporting files: ${body.supportingFiles.slice(0, 20).map(name => String(name).slice(0, 180)).join(", ")}`] : []),
        ...(Array.isArray(body.pastedImages) && body.pastedImages.length ? [`Pasted evidence: ${body.pastedImages.slice(0, 20).map(name => String(name).slice(0, 180)).join(", ")}`] : []),
      ];
      const children = blocks.map(text => ({ object: "block", type: "paragraph", paragraph: { rich_text: notionRichText(text, 1800) } }));
      const result = await notionRequest("pages", token, { method: "POST", body: JSON.stringify({ parent: { type: "data_source_id", data_source_id: dataSource.id }, properties: compatible, children: children.slice(0, 100) }) });
      return jsonResponse(response, 201, { ok: true, id: result.id });
    } catch (error) {
      return jsonResponse(response, 502, { error: error?.message || "Could not share feedback to Notion." });
    }
  }

  async function receiveFeedbackBundle(request) {
    let received = 0;
    const chunks = [];
    for await (const chunk of request) {
      received += chunk.length;
      if (received > MAX_FEEDBACK_BYTES) throw new Error("Feedback bundle exceeds the 1 GB upload limit.");
      chunks.push(chunk);
    }
    if (!received) throw new Error("The feedback bundle was empty.");
    return Buffer.concat(chunks);
  }

  function feedbackFilename(request) {
    const raw = Array.isArray(request.headers["x-feedback-filename"])
      ? request.headers["x-feedback-filename"][0]
      : request.headers["x-feedback-filename"];
    let decoded = "turbo-feedback.zip";
    try { decoded = decodeURIComponent(String(raw || decoded)); } catch {}
    const safe = basename(decoded).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 180);
    return /\.zip$/i.test(safe) ? safe : `${safe || "turbo-feedback"}.zip`;
  }

  function isTrustedFeedbackOrigin(request) {
    const origin = request.headers.origin;
    if (!origin) return true;
    try {
      const parsed = new URL(origin);
      const localOrigin = ["127.0.0.1", "localhost", "::1"].includes(parsed.hostname)
        && ["http:", "https:"].includes(parsed.protocol);
      const configuredOrigin = String(process.env.TURBO_APP_ORIGIN || "").replace(/\/$/, "");
      return localOrigin || (configuredOrigin && parsed.origin === configuredOrigin);
    } catch {
      return false;
    }
  }

  async function handleFeedbackUpload(request, response) {
    if (!isTrustedFeedbackOrigin(request)) {
      return jsonResponse(response, 403, { error: "Feedback submissions are accepted only from the local QA Studio app." });
    }
    try {
      const bytes = await receiveFeedbackBundle(request);
      const uploaded = await uploadFeedbackToBox({ bytes, filename: feedbackFilename(request) });
      jsonResponse(response, 201, { ok: true, ...uploaded });
    } catch (error) {
      const message = error?.message || String(error);
      const status = /not configured/i.test(message) ? 503 : /exceeds|empty/i.test(message) ? 400 : 502;
      jsonResponse(response, status, { error: message });
    }
  }

  return async function handleFeedbackRequest(request, response, url) {
    if (request.method === "POST" && url.pathname === "/feedback/upload") {
      await handleFeedbackUpload(request, response);
      return true;
    }
    if (request.method === "POST" && url.pathname === "/notion/pilot-session") {
      await handleNotionPilotSession(request, response);
      return true;
    }
    if (request.method === "POST" && url.pathname === "/notion/feedback-submission") {
      await handleNotionFeedbackSubmission(request, response);
      return true;
    }
    return false;
  };
}
