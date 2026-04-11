import { existsSync, readFileSync } from "fs";
import { join } from "path";

function readRootPackageName(dir: string): string | null {
  const p = join(dir, "package.json");
  if (!existsSync(p)) {
    return null;
  }
  try {
    const j = JSON.parse(readFileSync(p, "utf-8")) as { name?: string };
    return j.name ?? null;
  } catch {
    return null;
  }
}

/** Nest `apps/api`에서 실행 시 루트 `us-vibe` 패키지 디렉터리 */
export function getMonorepoRoot(): string {
  const env = process.env.US_VIBE_REPO_ROOT?.trim();
  if (env && readRootPackageName(env) === "us-vibe") {
    return env;
  }

  let dir = __dirname;
  for (let i = 0; i < 14; i++) {
    if (readRootPackageName(dir) === "us-vibe") {
      return dir;
    }
    const parent = join(dir, "..");
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error(`us-vibe monorepo root not found (from ${__dirname})`);
}
