import { Injectable, Logger } from "@nestjs/common";
import { GeminiService } from "./gemini.service";
import * as fs from "fs";
import * as path from "path";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { buildRoleGapPayload } from "../session/role-gap.util";

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly gemini: GeminiService,
    private readonly workspace: WorkspacePersistenceService,
  ) {}

  private loadPolicy(filename: string): string {
    try {
      // us_vibe 디렉토리 기준 (monorepo root에서 apps/api 실행 시)
      const root = process.cwd();
      // agents 디렉토리는 us_vibe 루트에 있음
      const p = path.join(root, "agents", "orchestrator", filename);
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf-8");
      }
      this.logger.warn(`Policy 파일 없음: ${p}`);
      return "";
    } catch (e) {
      this.logger.warn(`Policy 로드 실패 (${filename}): ${(e as Error).message}`);
      return "";
    }
  }

  private loadAgentPolicy(agentDir: string, filename: string): string {
    try {
      const root = process.cwd();
      const p = path.join(root, "agents", agentDir, filename);
      if (fs.existsSync(p)) {
        return fs.readFileSync(p, "utf-8");
      }
      return "";
    } catch (e) {
      return "";
    }
  }

  async processTurn(sessionId: string, userMessage: string): Promise<any> {
    const prof = this.workspace.getSessionProfile(sessionId);
    const roleGap = buildRoleGapPayload(sessionId, prof);
    const projectState = this.workspace.getProjectState(sessionId);
    const contract = this.workspace.getContractState(sessionId);
    const prSnap = this.workspace.getPrSnapshot(sessionId);

    const supervisorPolicy = this.loadPolicy("supervisor-policy.md");
    const routingRules = this.loadPolicy("routing-rules.md");

    const context = {
      sessionId,
      roleGap,
      projectState,
      gates: {
        contractValidated: contract.lastValidation?.passed ?? false,
        contractApproved: contract.contractApproved,
        prPhase: prSnap.phase,
      },
    };

    const systemPrompt = `
${supervisorPolicy}

## Routing Rules
${routingRules}

## Current Session Context (JSON)
${JSON.stringify(context, null, 2)}

당신은 Supervisor 에이전트입니다. 사용자의 입력과 현재 세션 상태를 분석하여 다음을 결정하십시오:
1. 다음에 발언할 에이전트 (PM, FE, QA, Senior, Coach 중 최대 2개)
2. 각 에이전트에게 전달할 구체적인 요청 사항 (Instruction)
3. 만약 직접 응답이 가능하다면 응답 내용

응답은 반드시 JSON 형식을 포함해야 합니다:
{
  "decisions": [
    { "agentRole": "PM", "instruction": "..." }
  ],
  "supervisorResponse": "..."
}
`;

    try {
      const resultText = await this.gemini.generateText(systemPrompt, userMessage);
      this.logger.debug(`Supervisor Decision: ${resultText}`);
      
      // JSON 추출 시도
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return { supervisorResponse: resultText, decisions: [] };
    } catch (e) {
      this.logger.error(`Orchestration 실패: ${(e as Error).message}`);
      throw e;
    }
  }

  async invokeAgent(role: string, instruction: string, sessionId: string): Promise<string> {
    const agentDir = `${role.toLowerCase()}-agent`;
    const policy = this.loadAgentPolicy(agentDir, `${role.toLowerCase()}-policy.md`);
    const promptRef = this.loadAgentPolicy(agentDir, `${role.toLowerCase()}-prompt.md`);

    const system = `
Role: ${role} Agent
Policy:
${policy}

Instruction: ${instruction}
`;
    return this.gemini.generateText(system, promptRef || "유연하게 답변하십시오.");
  }
}
