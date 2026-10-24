#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const localEnv = resolve(".env.local");
if (existsSync(localEnv) && typeof process.loadEnvFile === "function") process.loadEnvFile(localEnv);

const appArgs = process.argv.slice(2);
const renderer = spawn(process.execPath, ["scripts/ctv-ott-renderer.mjs"], { stdio: "inherit" });
const app = spawn(appArgs[0] || "vite", appArgs.slice(1), { stdio: "inherit", shell: false });

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  renderer.kill("SIGTERM");
  app.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
renderer.on("error", error => { console.error(`CTV/OTT renderer failed to start: ${error.message}`); stop(1); });
app.on("error", error => { console.error(`Preview app failed to start: ${error.message}`); stop(1); });
app.on("exit", (code, signal) => stop(typeof code === "number" ? code : signal ? 1 : 0));
