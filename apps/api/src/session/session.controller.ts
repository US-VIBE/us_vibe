import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  ServiceUnavailableException,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import * as fs from "fs";
import { createReadStream } from "fs";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import { OpenAIArtifactEvalService } from "../ai/openai-artifact-eval.service";
import {
  WorkspacePersistenceService,
  type SessionArtifactEvaluation
} from "../persistence/workspace-persistence.service";
import { getScenarioPackById, renderGithubEnvSnippet } from "../scenarios/scenario-registry";
import { LOGIN_MVP_PACK } from "../scenarios/packs/login-mvp.pack";
import { buildRoleGapPayload } from "./role-gap.util";
import { chatImageDownloadSecret, signChatImageDownload } from "./chat-image-download.util";

/**
 * 워크스페이스 세션 — role-gap, Prompt-to-Spec, 게이트 조회
 */
@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(
    private readonly workspace: WorkspacePersistenceService,
    private readonly openaiArtifactEval: OpenAIArtifactEvalService
  ) {}

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
    const rawKind = typeof body?.kind === "string" ? body.kind.trim() : "";
    const kind =
      rawKind.length > 0 && /^[a-z][a-z0-9_-]{0,63}$/i.test(rawKind) ? rawKind.toLowerCase() : "erd";
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

  /**
   * 워크스페이스 채팅 이미지 업로드 — 산출물(artifacts)과 별도 저장.
   * 응답의 `signedViewPath`는 브라우저 `<img src>`용(만료 TTL). Next 서버는 JWT `GET .../file`로 바이트를 받을 수 있습니다.
   */
  @Post(":sessionId/chat-images")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 1_048_576 }
    })
  )
  uploadChatImage(
    @Param("sessionId") sessionId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          originalname: string;
        }
      | undefined,
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    if (!file?.buffer) {
      throw new BadRequestException({
        ok: false,
        code: "CHAT_IMAGE_FILE_REQUIRED",
        message: "multipart 필드 file 이 필요합니다."
      });
    }
    try {
      const record = this.workspace.saveSessionChatImage({
        sessionId,
        originalName: file.originalname || "chat-image",
        mime: file.mimetype,
        buffer: file.buffer
      });
      const exp = Math.floor(Date.now() / 1000) + 86_400;
      const sig = signChatImageDownload(sessionId, record.id, exp, chatImageDownloadSecret());
      const signedViewPath = `/api/chat-image-files/${encodeURIComponent(sessionId)}/${encodeURIComponent(record.id)}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
      const publicBase = (process.env.API_PUBLIC_URL ?? "").replace(/\/$/, "");
      const signedViewUrl = publicBase ? `${publicBase}${signedViewPath}` : null;
      return {
        ok: true,
        data: {
          id: record.id,
          mime: record.mime,
          originalName: record.originalName,
          sizeBytes: record.sizeBytes,
          signedViewPath,
          signedViewUrl
        }
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "CHAT_IMAGE_TOO_LARGE") {
        throw new BadRequestException({
          ok: false,
          code: msg,
          message: "채팅 이미지는 1MB 이하여야 합니다."
        });
      }
      if (msg === "CHAT_IMAGE_MIME_NOT_ALLOWED") {
        throw new BadRequestException({
          ok: false,
          code: msg,
          message: "PNG, JPEG, WebP만 업로드할 수 있습니다."
        });
      }
      throw e;
    }
  }

  /** 채팅 이미지 바이너리 — Bearer JWT (Next 서버 등 서버측 호출). */
  @Get(":sessionId/chat-images/:imageId/file")
  getChatImageFile(
    @Param("sessionId") sessionId: string,
    @Param("imageId") imageId: string,
    @Req() req: AuthedRequest
  ): StreamableFile {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const row = this.workspace.getSessionChatImage(sessionId, imageId);
    if (!row) {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_NOT_FOUND",
        message: "이미지를 찾을 수 없습니다."
      });
    }
    try {
      fs.accessSync(row.storedPath, fs.constants.R_OK);
    } catch {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_FILE_MISSING",
        message: "저장된 파일을 읽을 수 없습니다."
      });
    }
    return new StreamableFile(createReadStream(row.storedPath), {
      type: row.mime
    });
  }

  /** Body: `{ "force": true }` 이면 완료된 평가도 다시 호출합니다. */
  @Post(":sessionId/artifacts/:artifactId/evaluate")
  async evaluateArtifact(
    @Param("sessionId") sessionId: string,
    @Param("artifactId") artifactId: string,
    @Body() body: { force?: boolean },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    if (!this.openaiArtifactEval.isConfigured()) {
      throw new ServiceUnavailableException({
        ok: false,
        code: "OPENAI_NOT_CONFIGURED",
        message: "산출물 AI 평가에는 API 환경에 OPENAI_API_KEY가 필요합니다. (비전: gpt-4o-mini 등)"
      });
    }
    const art = this.workspace.getSessionArtifact(sessionId, artifactId);
    if (!art) {
      throw new NotFoundException({
        ok: false,
        code: "ARTIFACT_NOT_FOUND",
        message: "산출물을 찾을 수 없습니다."
      });
    }
    const force = Boolean(body?.force);
    if (!force && art.evaluation?.status === "completed") {
      return { ok: true, data: art, cached: true as const };
    }

    const now = new Date().toISOString();
    if (/^application\/pdf$/i.test(art.mime)) {
      const skipped: SessionArtifactEvaluation = {
        status: "skipped",
        reason:
          "PDF는 현재 자동 AI 비전 평가를 지원하지 않습니다. 스크린샷은 PNG/JPEG/WebP로 제출해 주세요.",
        evaluatedAt: now
      };
      const updated = this.workspace.setSessionArtifactEvaluation(sessionId, artifactId, skipped);
      return { ok: true, data: updated, cached: false as const };
    }

    const isImage =
      /^image\/(png|jpeg|webp)$/i.test(art.mime) || art.mime === "image/jpg";
    if (!isImage) {
      const skipped: SessionArtifactEvaluation = {
        status: "skipped",
        reason: "이 MIME 형식은 이미지 AI 평가 대상이 아닙니다.",
        evaluatedAt: now
      };
      const updated = this.workspace.setSessionArtifactEvaluation(sessionId, artifactId, skipped);
      return { ok: true, data: updated, cached: false as const };
    }

    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(art.storedPath);
    } catch {
      throw new NotFoundException({
        ok: false,
        code: "ARTIFACT_FILE_MISSING",
        message: "저장된 파일을 읽을 수 없습니다."
      });
    }

    const base64 = buffer.toString("base64");
    try {
      const { text, model, promptVersion } = await this.openaiArtifactEval.evaluateImage({
        mime: art.mime,
        base64,
        kind: art.kind
      });
      const completed: SessionArtifactEvaluation = {
        status: "completed",
        model,
        promptVersion,
        text,
        evaluatedAt: new Date().toISOString()
      };
      const updated = this.workspace.setSessionArtifactEvaluation(sessionId, artifactId, completed);
      if (updated) {
        this.workspace.appendInAppNotification({
          sessionId,
          kind: "artifact_evaluated",
          title: "AI 산출물 피드백",
          body: `${updated.kind} (${updated.originalName}): ${text.slice(0, 160)}${text.length > 160 ? "…" : ""}`
        });
      }
      return { ok: true, data: updated, cached: false as const };
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      const failed: SessionArtifactEvaluation = {
        status: "failed",
        error: errMsg,
        evaluatedAt: new Date().toISOString()
      };
      const updated = this.workspace.setSessionArtifactEvaluation(sessionId, artifactId, failed);
      return { ok: true, data: updated, cached: false as const };
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
