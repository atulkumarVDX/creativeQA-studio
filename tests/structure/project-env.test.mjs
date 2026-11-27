import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadProjectEnv } from "../../scripts/load-project-env.mjs";

test("project environment loader reads .env.local and preserves inherited values", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "turbo-project-env-"));
  const fileValueName = `TURBO_ENV_FILE_TEST_${process.pid}`;
  const inheritedName = `TURBO_ENV_INHERITED_TEST_${process.pid}`;
  const oldFileValue = process.env[fileValueName];
  const oldInheritedValue = process.env[inheritedName];
  delete process.env[fileValueName];
  process.env[inheritedName] = "from-process";

  try {
    await writeFile(
      join(projectRoot, ".env.local"),
      `${fileValueName}=from-file\n${inheritedName}=should-not-overwrite\n`
    );

    assert.equal(loadProjectEnv(projectRoot), true);
    assert.equal(process.env[fileValueName], "from-file");
    assert.equal(process.env[inheritedName], "from-process");
  } finally {
    if (oldFileValue === undefined) delete process.env[fileValueName];
    else process.env[fileValueName] = oldFileValue;
    if (oldInheritedValue === undefined) delete process.env[inheritedName];
    else process.env[inheritedName] = oldInheritedValue;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("project environment loader leaves projects without .env.local unchanged", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "turbo-project-env-empty-"));
  try {
    assert.equal(loadProjectEnv(projectRoot), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
