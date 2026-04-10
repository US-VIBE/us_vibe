import * as fs from "fs";
import * as path from "path";

const REQUIRED_RELATIVE = ["specs/openapi/v1.yaml", "specs/api-contract.md"];

export function contractFilesPresent(
  repoRoot: string
): { ok: true } | { ok: false; missing: string[] } {
  const missing = REQUIRED_RELATIVE.filter(
    (rel) => !fs.existsSync(path.join(repoRoot, rel))
  );
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
