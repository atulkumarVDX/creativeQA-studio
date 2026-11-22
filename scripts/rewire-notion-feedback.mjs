#!/usr/bin/env node

import { existsSync } from "node:fs";

if (existsSync(".env.local") && typeof process.loadEnvFile === "function") process.loadEnvFile(".env.local");

const token = process.env.NOTION_API_TOKEN;
const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID?.replace(/-/g, "");
if (!token || !databaseId) throw new Error("Set NOTION_API_TOKEN and NOTION_FEEDBACK_DATABASE_ID in .env.local first.");

const notionVersion = "2025-09-03";
async function notion(path, options = {}) {
  const response = await fetch(`https://api.notion.com/v1/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": notionVersion,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || `Notion request failed (${response.status}).`);
  return result;
}

const database = await notion(`databases/${databaseId}`);
const databaseTitle = (database.title || []).map(part => part.plain_text || part.text?.content || "").join("");
if (databaseTitle !== "Report feedback") {
  await notion(`databases/${databaseId}`, { method: "PATCH", body: JSON.stringify({ title: [{ type: "text", text: { content: "Report feedback" } }] }) });
  console.log("Renamed the Notion database to Report feedback.");
}
const sources = await Promise.all((database.data_sources || []).map(async source => {
  try { return await notion(`data_sources/${source.id}`); } catch { return null; }
}));
const dataSource = sources.find(source => source && Object.values(source.properties || {}).some(property => property.type === "title"));
if (!dataSource) throw new Error("Could not find an accessible Report feedback data source with a title column.");

const feedbackTypes = [
  ["Visual mismatch", "red"], ["Finding looks incorrect", "orange"], ["Asset validation issue", "yellow"],
  ["Package loading issue", "purple"], ["Preview interaction issue", "blue"], ["Screenshot or report issue", "pink"],
  ["App UI issue", "brown"], ["Suggestion", "green"], ["Other issue", "gray"],
].map(([name, color]) => ({ name, color }));
const caseStatuses = [
  ["In progress", "blue"], ["Pass", "green"], ["Fail", "red"], ["Needs improvement", "yellow"],
  ["Blocked", "orange"], ["Not applicable", "gray"],
].map(([name, color]) => ({ name, color }));
const priorityOptions = [{ name: "High", color: "red" }, { name: "Medium", color: "yellow" }];
const desired = {
  "Feedback type": { select: { options: feedbackTypes } },
  "Test case": { rich_text: {} },
  "Test case priority": { select: { options: priorityOptions } },
  "Case status": { select: { options: caseStatuses } },
  "Feedback bundle URL": { url: {} },
  "Bundle file": { rich_text: {} },
  Description: { rich_text: {} },
  "Actual result": { rich_text: {} },
  "Expected result": { rich_text: {} },
  "Steps to reproduce": { rich_text: {} },
  "Evidence included": { rich_text: {} },
  "Supporting files": { rich_text: {} },
  "Pasted evidence": { rich_text: {} },
};
const updates = Object.fromEntries(Object.entries(desired).filter(([name, spec]) => {
  const existing = dataSource.properties?.[name];
  if (!existing) return true;
  const type = Object.keys(spec)[0];
  if (existing.type !== type) throw new Error(`The existing “${name}” column is ${existing.type}; expected ${type}. No type changes were made.`);
  if (type !== "select") return false;
  const existingOptions = existing.select?.options || [];
  const requiredOptions = spec.select.options;
  if (requiredOptions.every(option => existingOptions.some(current => current.name.toLowerCase() === option.name.toLowerCase()))) return false;
  return true;
}).map(([name, spec]) => {
  const existingOptions = dataSource.properties?.[name]?.select?.options || [];
  if (spec.select) {
    const requiredByName = new Map(spec.select.options.map(option => [option.name.toLowerCase(), option]));
    return [name, { select: { options: [
      ...existingOptions.map(option => requiredByName.has(option.name.toLowerCase()) ? { id: option.id } : { id: option.id }),
      ...spec.select.options.filter(option => !existingOptions.some(current => current.name.toLowerCase() === option.name.toLowerCase())),
    ] } }];
  }
  return [name, spec];
}));
if (!Object.keys(updates).length) {
  console.log("Report feedback columns are already configured.");
} else {
  await notion(`data_sources/${dataSource.id}`, { method: "PATCH", body: JSON.stringify({ properties: updates }) });
  console.log(`Updated Report feedback columns: ${Object.keys(updates).join(", ")}`);
}

const currentSchema = await notion(`data_sources/${dataSource.id}`);
if (currentSchema.properties?.["Review cycle"]) {
  await notion(`data_sources/${dataSource.id}`, { method: "PATCH", body: JSON.stringify({ properties: { "Review cycle": null } }) });
  console.log("Removed the Review cycle column; app version remains as feedback context.");
}
const refreshedSchema = await notion(`data_sources/${dataSource.id}`);
const titleProperty = Object.entries(refreshedSchema.properties).find(([, property]) => property.type === "title")?.[0];
const readRich = value => (value?.rich_text || value?.title || []).map(part => part.plain_text || part.text?.content || "").join("");
const titleOf = page => readRich(page.properties?.[titleProperty]);
const extract = (lines, label) => lines.find(line => line.startsWith(`${label}: `))?.slice(label.length + 2) || "";
let cursor;
let pages = [];
do {
  const result = await notion(`data_sources/${dataSource.id}/query`, { method: "POST", body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }) });
  pages = pages.concat(result.results || []);
  cursor = result.has_more ? result.next_cursor : null;
} while (cursor);

let backfilled = 0;
for (const page of pages) {
  const pageTitle = titleOf(page);
  if (!pageTitle.includes(" — ")) continue;
  const blocksResponse = await notion(`blocks/${page.id}/children?page_size=100`);
  const lines = (blocksResponse.results || []).map(block => {
    const value = block[block.type];
    return (value?.rich_text || []).map(part => part.plain_text || part.text?.content || "").join("");
  });
  if (!lines.some(line => line.startsWith("Feedback type: "))) continue;
  const rich = text => ({ rich_text: text ? [{ type: "text", text: { content: text.slice(0, 1800) } }] : [] });
  const selected = text => text ? { select: { name: text } } : { select: null };
  const props = {
    "Feedback type": selected(extract(lines, "Feedback type")),
    "Test case": rich(extract(lines, "Test case")),
    "Test case priority": selected(extract(lines, "Priority")),
    "Case status": selected(extract(lines, "Case status")),
    "Feedback bundle URL": { url: extract(lines, "Feedback bundle") || null },
    "Bundle file": rich(extract(lines, "Bundle file")),
    Reference: { url: extract(lines, "CCRV or Showcase URL") || null },
    Description: rich(extract(lines, "Description")),
    "Actual result": rich(extract(lines, "Actual result")),
    "Expected result": rich(extract(lines, "Expected result")),
    "Steps to reproduce": rich(extract(lines, "Steps to reproduce")),
    "Evidence included": rich(extract(lines, "Evidence in bundle")),
    "Supporting files": rich(extract(lines, "Supporting files")),
    "Pasted evidence": rich(extract(lines, "Pasted evidence")),
  };
  const pageProperties = Object.fromEntries(Object.entries(props).filter(([name, value]) => {
    const schema = refreshedSchema.properties[name];
    if (!schema || !value.select?.name) return Boolean(schema);
    return schema.select?.options?.some(option => option.name.toLowerCase() === value.select.name.toLowerCase());
  }));
  if (Object.keys(pageProperties).length) {
    await notion(`pages/${page.id}`, { method: "PATCH", body: JSON.stringify({ properties: pageProperties }) });
    backfilled += 1;
  }
}
console.log(`Backfilled ${backfilled} existing feedback ${backfilled === 1 ? "entry" : "entries"}.`);
