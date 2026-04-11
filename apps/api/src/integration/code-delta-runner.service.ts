import { Injectable, Logger } from "@nestjs/common";
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { CodeDeltaSummary } from "../../../../specs/data-model/types";
import { getMonorepoRoot } from "./monorepo-root";

const OUTPUT_REL = join(".ai", "code-delta-summary.json");

/** push 웹훅에서 `scripts/code-delta-analyzer.js`를 실행해 CodeDeltaSummary를 얻는다. */
@Injectable()
export class CodeDeltaRunnerService {
  private readonly logger = new Logger(CodeDeltaRunnerService.name);

  runForPush(beforeSha: string, afterSha: string): CodeDeltaSummary {
    const root = getMonorepoRoot();
    const script = join(root, "scripts", "code-delta-analyzer.js");
    if (!existsSync(script)) {
      this.logger.warn(`code-delta-analyzer not found: ${script}`);
      return this.fallback(afterSha);
    }

    try {
      execFileSync(process.execPath, [script], {
        cwd: root,
        env: {
          ...process.env,
          CODE_DELTA_BASE_SHA: beforeSha,
          CODE_DELTA_HEAD_SHA: afterSha,
          GITHUB_SHA: afterSha
        },
        maxBuffer: 20 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"]
      });
      const outPath = join(root, OUTPUT_REL);
      if (existsSync(outPath)) {
        const raw = readFileSync(outPath, "utf-8");
        const parsed = JSON.parse(raw) as CodeDeltaSummary;
        if (parsed && typeof parsed.commitSha === "string") {
          return parsed;
        }
      }
    } catch (e) {
      this.logger.warn(`code-delta-analyzer failed: ${(e as Error).message}`);
    }
    return this.fallback(afterSha);
  }

  private fallback(commitSha: string): CodeDeltaSummary {
    return {
      commitSha,
      analyzedAt: new Date().toISOString(),
      newEndpoints: [],
      modifiedEndpoints: [],
      removedEndpoints: [],
      dtoChanges: [],
      riskItems: [],
      contractChanged: false,
      changedFiles: []
    };
  }
}
