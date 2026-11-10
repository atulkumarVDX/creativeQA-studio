import { readFileSync, writeFileSync } from "node:fs";

const pointer = readFileSync("preview/current-preview.ts", "utf8");
const target = pointer.match(/path: "([^"]+)"/)[1];
const source = readFileSync("lib/preview-media.js", "utf8").replace("export function", "function");
const html = readFileSync(target, "utf8");
const startMarker = "  // BEGIN SHARED MEDIA LIFECYCLE\n";
const endMarker = "  // END SHARED MEDIA LIFECYCLE";
const start = html.indexOf(startMarker);
const end = html.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Current preview is missing the lifecycle markers.");
writeFileSync(target, html.slice(0, start + startMarker.length) + source + html.slice(end));
