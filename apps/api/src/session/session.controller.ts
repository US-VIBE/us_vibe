import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import { getScenarioPackById, renderGithubEnvSnippet } from "../scenarios/scenario-registry";
import { LOGIN_MVP_PACK } from "../scenarios/packs/login-mvp.pack";
import { buildRoleGapPayload } from "./role-gap.util";

/**
 * 워크스페이스 세션 — role-gap, Prompt-to-Spec, 게이트 조회
 */
@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get(":sessionId/role-gap")
  roleGap(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const profile = this.workspace.getSessionProfile(sessionId);
    return {
      ok: true,
      data: buildRoleGapPayload(sessionId, profile)
    };
  }

  @Patch(":sessionId/session-profile")
  patchSessionProfile(
    @Param("sessionId") sessionId: string,
    @Body() body: { humanRoleIds?: string[] },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const ids = Array.isArray(body?.humanRoleIds)
      ? body.humanRoleIds.map((x) => String(x).toLowerCase().trim()).filter(Boolean)
      : [];
    if (ids.length === 0) {
      return {
        ok: false,
        code: "BAD_REQUEST",
        message: "humanRoleIds 배열이 필요합니다."
      };
    }
    const cur = this.workspace.getSessionProfile(sessionId);
    cur.humanRoleIds = ids;
    this.workspace.saveSessionProfile(sessionId, cur, req.user.sub);
    return { ok: true, data: buildRoleGapPayload(sessionId, cur) };
  }

  @Get(":sessionId/integration-hints")
  integrationHints(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const pack = getScenarioPackById("login-mvp") ?? LOGIN_MVP_PACK;
    const snippet = renderGithubEnvSnippet(pack, sessionId);
    const recommendedServerEnvLine = `INTEGRATION_WEBHOOK_SESSION_ID=${sessionId}`;
    return {
      ok: true,
      data: {
        integrationWebhookSessionId: sessionId,
        recommendedServerEnvLine,
        bffSyncNote:
          "API 서버(Railway 등) 환경 변수에 위 한 줄을 설정하면 웹훅·코드델타가 이 학습 세션 UUID와 맞습니다. 서버 .env 파일을 앱이 직접 쓰지는 않습니다.",
        simulateOnlyPath: "/simulate",
        envSnippet: snippet,
        docPath: "docs/collaboration-env-and-endpoints.md",
        note:
          "GitHub 웹훅이 이 UUID를 sessionId로 쓰면 Postgres 타임라인·SQLite 통합 이벤트가 한 세션에 묶입니다."
      }
    };
  }

  @Get(":sessionId/in-app-notifications")
  inAppNotifications(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    return {
      ok: true,
      data: this.workspace.listInAppNotifications(sessionId)
    };
  }

  @Get(":sessionId/artifacts")
  listArtifacts(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    return { ok: true, data: this.workspace.listSessionArtifacts(sessionId) };
  }

  @Post(":sessionId/artifacts")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024 }
    })
  )
  uploadArtifact(
    @Param("sessionId") sessionId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          originalname: string;
        }
      | undefined,
    @Body() body: { kind?: string },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    if (!file?.buffer) {
      throw new BadRequestException({
        ok: false,
        code: "ARTIFACT_FILE_REQUIRED",
        message: "multipart 필드 file 이 필요합니다."
      });
    }
    const kind = typeof body?.kind === "string" && body.kind.trim() ? body.kind.trim() : "erd";
    try {
      const record = this.workspace.saveSessionArtifact({
        sessionId,
        kind,
        originalName: file.originalname || "upload",
        mime: file.mimetype,
        buffer: file.buffer
      });
      this.workspace.appendInAppNotification({
        sessionId,
        kind: "artifact_uploaded",
        title: "산출물 접수",
        body: `${record.kind} (${record.originalName}) 루브릭 통과: ${record.rubric.passed ? "예" : "아니오"}`
      });
      return { ok: true, data: record };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "ARTIFACT_TOO_LARGE") {
        throw new BadRequestException({
          ok: false,
          code: msg,
          message: "파일이 5MB 한도를 초과했습니다."
        });
      }
      if (msg === "ARTIFACT_MIME_NOT_ALLOWED") {
        throw new BadRequestException({
          ok: false,
          code: msg,
          message: "PNG, JPEG, WebP, PDF만 업로드할 수 있습니다."
        });
      }
      throw e;
    }
  }

  @Get(":sessionId/workspace-gates")
  workspaceGates(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const contract = this.workspace.getContractState(sessionId);
    const prof = this.workspace.getSessionProfile(sessionId);
    const pr = this.workspace.getPrSnapshot(sessionId);
    return {
      ok: true,
      data: {
        promptSpecApproved: this.workspace.isPromptSpecApproved(sessionId),
        promptSpecApprovedVersion: prof.promptSpecApprovedVersion,
        contractValidatedPass: contract.lastValidation?.passed ?? false,
        contractApproved: contract.contractApproved,
        prPhase: pr.phase,
        prRevisionRound: pr.revisionRound
      }
    };
  }

  /** POST body: { promptText: string } */
  @Post(":sessionId/prompt-spec/convert")
  convertPrompt(
    @Param("sessionId") sessionId: string,
    @Body() body: { promptText?: string },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const promptText = typeof body?.promptText === "string" ? body.promptText : "";
    return {
      ok: true,
      data: {
        specVersion: 1,
        template: {
          goal: "학습자 요청을 수용 기준으로 구체화한다.",
          scope: promptText.slice(0, 400) + (promptText.length > 400 ? "…" : ""),
          constraints: "공통 에러 포맷 유지, 계약 게이트와 충돌 시 재검토.",
          acceptanceCriteria: [
            "요구 범위가 문장으로 명확히 구분된다.",
            "비목표가 최소 1개 이상 명시된다.",
            "완료 조건이 검증 가능한 형태다."
          ],
          nonGoals: ["프론트엔드 화면 구현", "성능 최적화 범위 확대"]
        },
        rawMarkdown: `# 요구사항 초안\n\n세션: ${sessionId}\n\n${promptText || "(빈 입력)"}`
      }
    };
  }

  /** POST body: { specVersion: number } — 승인 시 SQLite 프로필에 기록 (계약 게이트 선행 조건) */
  @Post(":sessionId/prompt-spec/approve")
  approveSpec(
    @Param("sessionId") sessionId: string,
    @Body() body: { specVersion?: number },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const specVersion = typeof body?.specVersion === "number" ? body.specVersion : 1;
    const prof = this.workspace.getSessionProfile(sessionId);
    prof.promptSpecApprovedVersion = specVersion;
    prof.promptSpecApprovedAt = new Date().toISOString();
    this.workspace.saveSessionProfile(sessionId, prof, req.user.sub);
    return {
      ok: true,
      data: {
        status: "approved" as const,
        specVersion,
        approvedAt: prof.promptSpecApprovedAt
      }
    };
  }

  /**
   * O-1: 워크스페이스 게이트·role-gap·시나리오 팩·agents 문서 앵커를 한 응답으로 묶어
   * 오케스트레이터/도구가 REST에서 단일 진입점으로 읽을 수 있게 한다.
   */
  @Get(":sessionId/orchestrator-context")
  orchestratorContext(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const prof = this.workspace.getSessionProfile(sessionId);
    const contract = this.workspace.getContractState(sessionId);
    const pr = this.workspace.getPrSnapshot(sessionId);
    const pack = getScenarioPackById("login-mvp") ?? LOGIN_MVP_PACK;
    return {
      ok: true,
      data: {
        sessionId,
        defaultScenarioPackId: pack.id,
        roleGap: buildRoleGapPayload(sessionId, prof),
        workspaceGates: {
          promptSpecApproved: this.workspace.isPromptSpecApproved(sessionId),
          promptSpecApprovedVersion: prof.promptSpecApprovedVersion,
          contractValidatedPass: contract.lastValidation?.passed ?? false,
          contractApproved: contract.contractApproved,
          prPhase: pr.phase,
          prRevisionRound: pr.revisionRound
        },
        agentPolicyAnchors: [
          "agents/orchestrator/README.md",
          "agents/orchestrator/routing-rules.md",
          "agents/orchestrator/supervisor-policy.md",
          "agents/orchestrator/role-gap-detector-policy.md"
        ],
        restAnchors: {
          scenariosCatalog: "GET /scenarios/catalog",
          simulationSessions: "POST /sessions",
          workspaceGates: "GET /api/sessions/:sessionId/workspace-gates"
        }
      }
    };
  }
}
