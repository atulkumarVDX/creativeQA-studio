import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Load the project's optional local environment file without printing values.
 * Existing process environment values retain Node's normal precedence.
 *
 * @param {string} projectRoot
 * @returns {boolean} whether `.env.local` was loaded
 */
export function loadProjectEnv(projectRoot) {
  const envFile = join(projectRoot, ".env.local");
  if (!existsSync(envFile)) return false;
  if (typeof process.loadEnvFile !== "function") {
    throw new Error("Node.js must support process.loadEnvFile to read .env.local.");
  }
  process.loadEnvFile(envFile);
  return true;
}
