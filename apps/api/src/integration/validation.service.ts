import { Injectable, Logger } from "@nestjs/common";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type {
  ValidationResult,
  LintError,
  ContractDiff,
} from "../../../../specs/data-model/types";

const ROOT = path.resolve(__dirname, "../../../../../..");

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  async runAll(prNumber: number, commitSha: string): Promise<ValidationResult> {
    this.logger.log(`검증 시작: PR #${prNumber} (${commitSha})`);

    const [lint, typecheck, contract] = await Promise.all([
      this.runLint(),
      this.runTypecheck(),
      this.validateContract(),
    ]);

    const passed = lint.passed && typecheck.passed && contract.passed;
    this.logger.log(`검증 완료: ${passed ? "PASSED" : "FAILED"}`);

    return { passed, checks: { lint, typecheck, contract }, prNumber, commitSha };
  }

  async runLint(): Promise<{ passed: boolean; errors: LintError[] }> {
    const errors: LintError[] = [];
    let passed = true;
    for (const ws of ["api", "web"] as const) {
      try {
        execSync(`npm run lint -w ${ws}`, {
          cwd: ROOT,
          stdio: "pipe",
          encoding: "utf-8",
        });
        this.logger.log(`[lint:${ws}] PASSED`);
      } catch (err: unknown) {
        passed = false;
        const output = this.extractOutput(err);
        const parsed = this.parseLintOutput(output);
        this.logger.warn(`[lint:${ws}] FAILED: ${parsed.length}개 오류`);
        errors.push(...parsed);
      }
    }
    return { passed, errors };
  }

  async runTypecheck(): Promise<{ passed: boolean; errors: string[] }> {
    const errors: string[] = [];
    let passed = true;
    for (const proj of ["apps/api/tsconfig.json", "apps/web/tsconfig.json"] as const) {
      try {
        execSync(`npx tsc --noEmit -p ${proj}`, {
          cwd: ROOT,
          stdio: "pipe",
          encoding: "utf-8",
        });
        this.logger.log(`[typecheck:${proj}] PASSED`);
      } catch (err: unknown) {
        passed = false;
        const output = this.extractOutput(err);
        const lines = output
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        this.logger.warn(`[typecheck:${proj}] FAILED: ${lines.length}개 오류`);
        errors.push(...lines);
      }
    }
    return { passed, errors };
  }

  async validateContract(): Promise<{ passed: boolean; diffs: ContractDiff[] }> {
    const diffs: ContractDiff[] = [];

    const openapiPath = path.join(ROOT, "specs/openapi/v1.yaml");
    const contractPath = path.join(ROOT, "specs/api-contract.md");

    if (!fs.existsSync(openapiPath)) {
      this.logger.warn("[contract] FAILED: specs/openapi/v1.yaml 없음");
      return { passed: false, diffs };
    }
    if (!fs.existsSync(contractPath)) {
      this.logger.warn("[contract] FAILED: specs/api-contract.md 없음");
      return { passed: false, diffs };
    }

    const yamlContent = fs.readFileSync(openapiPath, "utf-8");
    const contractContent = fs.readFileSync(contractPath, "utf-8");

    if (
      !yamlContent.includes("openapi:") ||
      !yamlContent.includes("paths:")
    ) {
      this.logger.warn("[contract] FAILED: OpenAPI YAML 파싱 오류");
      return { passed: false, diffs };
    }

    // OpenAPI에서 경로 추출
    const pathMatches = yamlContent.match(/^  (\/[^\s:]+):/gm) ?? [];
    const openApiPaths = pathMatches.map((m) => m.trim().replace(/:$/, ""));

    // api-contract.md에서 경로 추출
    const contractMatches =
      contractContent.match(
        /`(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^`]*)`/g,
      ) ?? [];
    const contractPaths = contractMatches
      .map((m) => {
        const match = m.match(/`(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^`]*)`/);
        return match ? match[1] : null;
      })
      .filter((p): p is string => p !== null);

    // 계약에 있으나 OpenAPI에 없는 경로를 ContractDiff로 기록
    for (const cp of contractPaths) {
      const found = openApiPaths.some(
        (p) => p === cp || p.startsWith(cp),
      );
      if (!found) {
        diffs.push({
          path: cp,
          method: "UNKNOWN",
          changeType: "removed",
          affectedFields: [],
          impactedConsumers: ["FE", "QA"],
        });
      }
    }

    const passed = diffs.length === 0;
    this.logger.log(
      `[contract] ${passed ? "PASSED" : `FAILED: ${diffs.length}개 불일치`}`,
    );
    return { passed, diffs };
  }

  private extractOutput(err: unknown): string {
    if (
      err &&
      typeof err === "object" &&
      "stdout" in err &&
      "stderr" in err
    ) {
      const e = err as { stdout: string; stderr: string };
      return `${e.stdout ?? ""}\n${e.stderr ?? ""}`;
    }
    return String(err);
  }

  private parseLintOutput(output: string): LintError[] {
    const errors: LintError[] = [];
    // ESLint 출력 패턴: "  path/to/file.ts\n    line:col  error  message  rule"
    const lines = output.split("\n");
    let currentFile = "";
    for (const line of lines) {
      const fileMatch = line.match(/^([^\s].*\.(ts|tsx|js))$/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }
      const errorMatch = line.match(
        /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(.+)$/,
      );
      if (errorMatch && currentFile) {
        errors.push({
          file: currentFile,
          line: parseInt(errorMatch[1], 10),
          rule: errorMatch[5].trim(),
          message: errorMatch[4].trim(),
        });
      }
    }
    return errors;
  }
}
