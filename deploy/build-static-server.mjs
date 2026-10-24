#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pointer = await readFile(join(root, "preview/current-preview.ts"), "utf8");
const versionMatch = pointer.match(/version:\s*"(\d+\.\d+\.\d+)"/);
if (!versionMatch) throw new Error("Could not read the current preview version from preview/current-preview.ts.");
const version = versionMatch[1];
const archive = join(root, "outputs", `turbo-qa-studio-${version}-static-server.tar.gz`);
const html = `turbo-preview-${version}.html`;
const renderer = await readFile(join(root, "scripts/ctv-ott-renderer.mjs"), "utf8");

if (!pointer.includes(html) || !pointer.includes(version) ||
    !renderer.includes(`build: "${version}"`) || !renderer.includes(html)) {
  throw new Error(`Build identity is not consistently ${version}; update the deployment package before building.`);
}

const build = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const staging = await mkdtemp(join(tmpdir(), "turbo-qa-static-release-"));
try {
  const release = join(staging, `turbo-qa-studio-${version}`);
  await mkdir(join(release, "scripts"), { recursive: true });
  await mkdir(join(release, "preview"), { recursive: true });
  await mkdir(join(release, "deploy/docker"), { recursive: true });
  await cp(join(root, "dist"), join(release, "dist"), { recursive: true });
  await cp(join(root, "scripts/ctv-ott-renderer.mjs"), join(release, "scripts/ctv-ott-renderer.mjs"));
  await cp(join(root, "scripts/box-feedback-upload.mjs"), join(release, "scripts/box-feedback-upload.mjs"));
  await cp(join(root, "preview", html), join(release, "preview", html));
  await cp(join(root, "deploy/README.md"), join(release, "DEPLOY.md"));
  await cp(join(root, "deploy/nginx"), join(release, "nginx"), { recursive: true });
  await cp(join(root, "deploy/turbo-qa-renderer.service"), join(release, "turbo-qa-renderer.service"));
  await cp(join(root, "deploy/docker/renderer.Dockerfile"), join(release, "deploy/docker/renderer.Dockerfile"));
  await cp(join(root, "deploy/docker/compose.yaml"), join(release, "deploy/docker/compose.yaml"));
  await mkdir(dirname(archive), { recursive: true });
  const packed = spawnSync("tar", ["-czf", archive, "-C", staging, `turbo-qa-studio-${version}`], { stdio: "inherit" });
  if (packed.error) throw packed.error;
  if (packed.status !== 0) process.exit(packed.status ?? 1);
  console.log(`Static-server release: ${archive}`);
} finally {
  await rm(staging, { recursive: true, force: true });
}
