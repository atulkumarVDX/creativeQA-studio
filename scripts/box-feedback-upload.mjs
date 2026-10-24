const BOX_TOKEN_URL = "https://api.box.com/oauth2/token";
const BOX_UPLOAD_URL = "https://upload.box.com/api/2.0/files/content";

function required(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function boxFeedbackConfig(env = process.env) {
  const config = {
    clientId: required(env.BOX_CLIENT_ID),
    clientSecret: required(env.BOX_CLIENT_SECRET),
    enterpriseId: required(env.BOX_ENTERPRISE_ID),
    folderId: required(env.BOX_FEEDBACK_FOLDER_ID),
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) {
    throw new Error("Direct Box submission is not configured. Add the Box credentials and destination folder ID to .env.local.");
  }
  return config;
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function uploadFeedbackToBox({ bytes, filename, env = process.env, fetchImpl = fetch }) {
  const config = boxFeedbackConfig(env);
  const tokenResponse = await fetchImpl(BOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      box_subject_type: "enterprise",
      box_subject_id: config.enterpriseId,
    }),
  });
  const tokenBody = await responseJson(tokenResponse);
  if (!tokenResponse.ok || !tokenBody?.access_token) {
    throw new Error(`Box authentication failed${tokenResponse.status ? ` (${tokenResponse.status})` : ""}.`);
  }

  const form = new FormData();
  form.append("attributes", JSON.stringify({ name: filename, parent: { id: config.folderId } }));
  form.append("file", new Blob([bytes], { type: "application/zip" }), filename);
  const uploadResponse = await fetchImpl(BOX_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    body: form,
  });
  const uploadBody = await responseJson(uploadResponse);
  const uploaded = uploadBody?.entries?.[0];
  if (!uploadResponse.ok || !uploaded?.id) {
    const reason = uploadBody?.message || uploadBody?.code;
    throw new Error(`Box upload failed${uploadResponse.status ? ` (${uploadResponse.status})` : ""}${reason ? `: ${reason}` : "."}`);
  }
  return {
    id: String(uploaded.id),
    name: String(uploaded.name || filename),
    url: `https://app.box.com/file/${uploaded.id}`,
  };
}
