import { Controller, Logger, Param, Post, UseGuards } from "@nestjs/common";
import { execFile } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { getMonorepoRoot } from "../monorepo-root";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

const execFileAsync = promisify(execFile);

/**
 * 워크스페이스 DoD 자동 검증(§47-1a) — 계약 스크립트 + 워크스페이스 게이트 조건.
 */
@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class WorkspaceDodVerifyController {
  private readonly logger = new Logger(WorkspaceDodVerifyController.name);

  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Post(":sessionId/workspace-dod-verify")
  async verify(@Param("sessionId") sessionId: string) {
    const checks: Array<{ id: string; passed: boolean; detail?: string }> = [];

    const promptOk = this.workspace.isPromptSpecApproved(sessionId);
    checks.push({
      id: "prompt_spec_approved",
      passed: promptOk,
      detail: promptOk ? undefined : "POST .../prompt-spec/approve 필요"
    });

    const contract = this.workspace.getContractState(sessionId);
    const contractOk = Boolean(contract.lastValidation?.passed);
    checks.push({
      id: "contract_validation_passed",
      passed: contractOk,
      detail: contractOk ? undefined : "POST .../contract/validate 통과 필요"
    });

    const repoRoot = getMonorepoRoot();
    const script = path.join(repoRoot, "scripts", "validate-api-contract.js");
    let scriptOk = false;
    let scriptOut = "";
    if (fs.existsSync(script)) {
      try {
        const { stdout, stderr } = await execFileAsync(process.execPath, [script], {
          cwd: repoRoot,
          maxBuffer: 2 * 1024 * 1024,
          timeout: 120_000,
          windowsHide: true
        });
        scriptOut = (stdout + stderr).slice(-4000);
        scriptOk = true;
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; message?: string };
        scriptOut = `${err.stderr ?? ""}${err.stdout ?? ""}${err.message ?? ""}`.slice(-4000);
        scriptOk = false;
      }
    } else {
      scriptOut = `스크립트 없음: ${script}`;
    }
    checks.push({
      id: "validate_api_contract_script",
      passed: scriptOk,
      detail: scriptOk ? undefined : scriptOut.slice(0, 500)
    });

    const passed = checks.every((c) => c.passed);
    if (!passed) {
      this.logger.log(`workspace-dod-verify failed session=${sessionId}`);
    }
    return {
      ok: true,
      data: {
        passed,
        sessionId,
        checks,
        logTail: scriptOk ? undefined : scriptOut
      }
    };
  }
}
