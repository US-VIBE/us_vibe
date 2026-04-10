import * as path from "node:path";

/**
 * Repository root (contains `specs/`). Used for verify contract paths.
 * Override when the API cwd is not the monorepo (e.g. container).
 */
export function getMonorepoRoot(): string {
  const env = process.env.US_VIBE_REPO_ROOT?.trim();
  if (env) {
    return path.resolve(env);
  }
  return path.resolve(__dirname, "..", "..", "..");
}
