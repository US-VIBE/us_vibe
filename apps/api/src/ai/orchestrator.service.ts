import { Injectable, Logger } from "@nestjs/common";
import { GeminiService } from "./gemini.service";
import * as fs from "fs";
import * as path from "path";
import type { SessionArtifactRecord } from "../persistence/workspace-persistence.service";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { buildRoleGapPayload } from "../session/role-gap.util";

/** Supervisor `processTurn` JSON 파싱 결과(느슨한 형태). */
export interface SupervisorOrchestrationDecision {
  supervisorResponse?: string;
  decisions?: Array<{ agentRole: string; instruction: string }>;
}

export interface ArtifactEvaluationResult {
  agentRole: string;
  feedbackMarkdown: string;
  rubric: SessionArtifactRecord["rubric"];
}

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
    } catch {
      return "";
    }
  }

  async processTurn(
    sessionId: string,
    userMessage: string
  ): Promise<SupervisorOrchestrationDecision> {
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
        return JSON.parse(jsonMatch[0]) as SupervisorOrchestrationDecision;
      }
      
      return { supervisorResponse: resultText, decisions: [] };
    } catch (e) {
      this.logger.error(`Orchestration 실패: ${(e as Error).message}`);
      throw e;
    }
  }

  async invokeAgent(role: string, instruction: string, _sessionId: string): Promise<string> {
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

  async evaluateArtifact(
    sessionId: string,
    artifactId: string
  ): Promise<ArtifactEvaluationResult> {
    const artifact = this.workspace.getSessionArtifact(sessionId, artifactId);
    if (!artifact) {
      throw new Error(`Artifact not found: ${artifactId}`);
    }

    const reviewerPolicy = this.loadPolicy("artifact-reviewer-policy.md");
    const agentRole = artifact.kind.toLowerCase() === "erd" ? "Senior" : "QA";
    
    const buffer = fs.readFileSync(artifact.storedPath);
    const system = `
${reviewerPolicy}

You are reviewing an artifact of kind: ${artifact.kind} as a ${agentRole} agent.
Evaluate based on the rubrics and provide a professional feedback.
`;
    const user = `Please review the following artifact: ${artifact.originalName} (${artifact.mime})`;

    const resultText = await this.gemini.generateMultimodal(system, user, {
      buffer,
      mimeType: artifact.mime
    });

    // Parse JSON
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    let rubric = artifact.rubric;
    let feedbackMarkdown = resultText;
    
    if (jsonMatch) {
      try {
        const aiEvaluation = JSON.parse(jsonMatch[0]);
        rubric = {
          passed: aiEvaluation.passed ?? artifact.rubric.passed,
          checks: [
            ...artifact.rubric.checks,
            ...(aiEvaluation.checks || [])
          ]
        };
        // Remove JSON from the feedback text if it was included in markdown code blocks
        feedbackMarkdown = resultText.replace(/```json[\s\S]*?```/, "").trim();
        if (feedbackMarkdown === resultText) {
          feedbackMarkdown = resultText.replace(jsonMatch[0], "").trim();
        }
      } catch {
        this.logger.warn("Failed to parse AI evaluation JSON");
      }
    }

    // Update DB
    this.workspace.updateArtifactAiReview(artifactId, rubric);

    return { agentRole, feedbackMarkdown, rubric };
  }
}
