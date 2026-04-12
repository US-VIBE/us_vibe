import { Body, Controller, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import type { IntegrationEvent, ValidationResult } from "../../../../specs/data-model/types";
import { EVENT_PUBLISHER, IEventPublisher } from "../integration/event-publisher.interface";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

function runValidation(openApiYaml: string): ValidationResult {
  const y = openApiYaml;
  const lintFail = y.includes("LINT_FAIL");
  const tsFail = y.includes("TS_FAIL");
  const contractFail = y.includes("INVALID_CONTRACT") || !y.includes("paths:");

  const lintPassed = !lintFail;
  const tsPassed = !tsFail;
  const contractPassed = !contractFail;
  const passed = lintPassed && tsPassed && contractPassed;

  return {
    passed,
    checks: {
      lint: {
        passed: lintPassed,
        errors: lintFail
          ? [
              {
                file: "src/api.ts",
                line: 1,
                rule: "demo/lint-fail",
                message: "[API] LINT_FAIL 포함 시 린트 실패."
              }
            ]
          : []
      },
      typecheck: {
        passed: tsPassed,
        errors: tsFail ? ["[API] TS_FAIL 포함 시 타입체크 실패."] : []
      },
      contract: {
        passed: contractPassed,
        diffs: contractFail
          ? [
              {
                path: "/auth/login",
                method: "POST",
                changeType: "modified" as const,
                affectedFields: ["response.body.token"],
                impactedConsumers: ["FE:LoginForm"]
              }
            ]
          : []
      }
    },
    prNumber: 12,
    commitSha: "c0ffee42"
  };
}

@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class ContractGateController {
  constructor(
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher
  ) {}

  @Post(":sessionId/contract/validate")
  async validate(
    @Param("sessionId") sessionId: string,
    @Body() body: { openApiYaml?: string },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const yaml = typeof body?.openApiYaml === "string" ? body.openApiYaml : "";
    const result = runValidation(yaml);
    const st = this.workspace.getContractState(sessionId);
    st.lastValidation = result;
    this.workspace.saveContractState(sessionId, st, req.user.sub);
    const sv = this.workspace.getWorkspaceStateVersion(sessionId);
    const ev: IntegrationEvent = {
      type: result.passed ? "VALIDATION_PASSED" : "VALIDATION_FAILED",
      sessionId,
      stateVersion: sv,
      triggeredBy: "user",
      payload: { validationResult: result },
      timestamp: new Date().toISOString()
    };
    await this.eventPublisher.publish(ev);
    return { ok: true, data: { validationResult: result } };
  }

  @Post(":sessionId/contract/approve")
  async approve(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    if (!this.workspace.isPromptSpecApproved(sessionId)) {
      return {
        ok: false,
        code: "PROMPT_SPEC_NOT_APPROVED",
        message: "Prompt-to-Spec 승인(POST .../prompt-spec/approve) 후에만 계약 최종 승인이 가능합니다."
      };
    }
    const st = this.workspace.getContractState(sessionId);
    if (!st.lastValidation?.passed) {
      return {
        ok: false,
        code: "CONTRACT_INVALID",
        message: "검증 통과 전에는 계약을 승인할 수 없습니다."
      };
    }
    st.contractApproved = true;
    this.workspace.saveContractState(sessionId, st, req.user.sub);
    const sv = this.workspace.getWorkspaceStateVersion(sessionId);
    const ev: IntegrationEvent = {
      type: "CONTRACT_CHANGED",
      sessionId,
      stateVersion: sv,
      triggeredBy: "user",
      payload: { contractDiffs: [], openApiVersion: "1.0" },
      timestamp: new Date().toISOString()
    };
    await this.eventPublisher.publish(ev);
    return {
      ok: true,
      data: { approved: true, approvedAt: new Date().toISOString() }
    };
  }
}
