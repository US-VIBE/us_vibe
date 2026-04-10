import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";

/**
 * 세션 API 스텁 — FE 계약 (role-gap, prompt-spec)
 */
@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class SessionController {
  @Get(":sessionId/role-gap")
  roleGap(@Param("sessionId") sessionId: string) {
    return {
      ok: true,
      data: {
        sessionId,
        stateVersion: 1,
        humanRoleIds: ["be"],
        humanRoleLabels: ["Backend Developer (학습자)"],
        injectedAgents: [
          { agentId: "agent_pm", role: "PM", displayName: "PM 에이전트" },
          { agentId: "agent_fe", role: "FE", displayName: "FE 에이전트" },
          { agentId: "agent_qa", role: "QA", displayName: "QA 에이전트" },
          { agentId: "agent_senior", role: "Senior", displayName: "Senior 에이전트" },
          { agentId: "agent_supervisor", role: "Supervisor", displayName: "Supervisor" },
          { agentId: "agent_coach", role: "Coach", displayName: "Coach" }
        ],
        summary:
          "[API 스텁] 백엔드 단독 팀: PM·FE·QA·Senior·Supervisor·Coach 에이전트가 결손을 보강해 채팅에 참여합니다."
      }
    };
  }

  /** POST body: { promptText: string } */
  @Post(":sessionId/prompt-spec/convert")
  convertPrompt(
    @Param("sessionId") sessionId: string,
    @Body() body: { promptText?: string }
  ) {
    const promptText = typeof body?.promptText === "string" ? body.promptText : "";
    return {
      ok: true,
      data: {
        specVersion: 1,
        template: {
          goal: "[API 스텁] 학습자 요청을 수용 기준으로 구체화한다.",
          scope: promptText.slice(0, 400) + (promptText.length > 400 ? "…" : ""),
          constraints: "공통 에러 포맷 유지, 계약 게이트와 충돌 시 재검토.",
          acceptanceCriteria: [
            "요구 범위가 문장으로 명확히 구분된다.",
            "비목표가 최소 1개 이상 명시된다.",
            "완료 조건이 검증 가능한 형태다."
          ],
          nonGoals: ["프론트엔드 화면 구현", "성능 최적화 범위 확대"]
        },
        rawMarkdown: `# 요구사항 초안 (API 스텁)\n\n세션: ${sessionId}\n\n${promptText || "(빈 입력)"}`
      }
    };
  }

  /** POST body: { specVersion: number } */
  @Post(":sessionId/prompt-spec/approve")
  approveSpec(
    @Param("sessionId") sessionId: string,
    @Body() body: { specVersion?: number }
  ) {
    const specVersion = typeof body?.specVersion === "number" ? body.specVersion : 1;
    return {
      ok: true,
      data: {
        status: "approved" as const,
        specVersion,
        approvedAt: new Date().toISOString()
      }
    };
  }
}
