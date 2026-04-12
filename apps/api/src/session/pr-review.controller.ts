import { Body, Controller, Get, Inject, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { EVENT_PUBLISHER, IEventPublisher } from "../integration/event-publisher.interface";
import {
  type PrComment,
  type PrSnap,
  WorkspacePersistenceService
} from "../persistence/workspace-persistence.service";

function allResolved(c: PrComment[]): boolean {
  return c.length > 0 && c.every((x) => x.status !== "pending");
}

function prEventPayload(snap: PrSnap): { prNumber: number; branch: string; author: string } {
  return {
    prNumber: snap.prNumber ?? 0,
    branch: snap.branch ?? "unknown",
    author: "workspace"
  };
}

@Controller("api/sessions")
@UseGuards(JwtAuthGuard)
export class PrReviewController {
  constructor(
    private readonly workspace: WorkspacePersistenceService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher
  ) {}

  @Get(":sessionId/pr-review")
  get(@Param("sessionId") sessionId: string, @Req() req: AuthedRequest) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    return { ok: true, data: this.workspace.getPrSnapshot(sessionId) };
  }

  @Post(":sessionId/pr-review/submit")
  async submit(
    @Param("sessionId") sessionId: string,
    @Body() body: { stateVersion?: number },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const cur = this.workspace.getPrSnapshot(sessionId);
    if (body.stateVersion != null && body.stateVersion !== cur.stateVersion) {
      return { ok: false, code: "VERSION_CONFLICT", message: "stateVersion 불일치" };
    }
    if (cur.phase !== "idle") {
      return { ok: true, data: cur };
    }
    const slug = "session";
    const next: PrSnap = {
      ...cur,
      stateVersion: cur.stateVersion + 1,
      prNumber: 12,
      branch: `feature/${slug}`,
      revisionRound: 1,
      phase: "open",
      comments: [
        {
          id: "c1",
          authorRole: "senior",
          authorLabel: "Senior",
          body: "[API] 에러 응답 스키마를 공통 DTO로 분리해 주세요.",
          status: "pending"
        },
        {
          id: "c2",
          authorRole: "fe",
          authorLabel: "FE",
          body: "[API] OpenAPI example과 실제 응답 필드명이 일치하는지 확인 부탁드립니다.",
          status: "pending"
        }
      ]
    };
    this.workspace.savePrSnapshot(sessionId, next, req.user.sub);
    const ev: IntegrationEvent = {
      type: "PR_OPENED",
      sessionId,
      stateVersion: next.stateVersion,
      triggeredBy: "user",
      payload: prEventPayload(next),
      timestamp: new Date().toISOString()
    };
    await this.eventPublisher.publish(ev);
    return { ok: true, data: next };
  }

  @Patch(":sessionId/pr-review/comments/:commentId")
  async patchComment(
    @Param("sessionId") sessionId: string,
    @Param("commentId") commentId: string,
    @Body() body: { status?: PrComment["status"]; stateVersion?: number },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const cur = this.workspace.getPrSnapshot(sessionId);
    if (body.stateVersion != null && body.stateVersion !== cur.stateVersion) {
      return { ok: false, code: "VERSION_CONFLICT", message: "stateVersion 불일치" };
    }
    const st = body.status;
    if (!st) {
      return { ok: false, code: "BAD_REQUEST", message: "status 필요" };
    }
    const next: PrSnap = {
      ...cur,
      stateVersion: cur.stateVersion + 1,
      comments: cur.comments.map((c) => (c.id === commentId ? { ...c, status: st } : c))
    };
    this.workspace.savePrSnapshot(sessionId, next, req.user.sub);
    const ev: IntegrationEvent = {
      type: "PR_UPDATED",
      sessionId,
      stateVersion: next.stateVersion,
      triggeredBy: "user",
      payload: prEventPayload(next),
      timestamp: new Date().toISOString()
    };
    await this.eventPublisher.publish(ev);
    return { ok: true, data: next };
  }

  @Post(":sessionId/pr-review/re-review")
  async reReview(
    @Param("sessionId") sessionId: string,
    @Body() body: { stateVersion?: number },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const cur = this.workspace.getPrSnapshot(sessionId);
    if (body.stateVersion != null && body.stateVersion !== cur.stateVersion) {
      return { ok: false, code: "VERSION_CONFLICT", message: "stateVersion 불일치" };
    }
    if (cur.revisionRound !== 1 || cur.phase !== "open" || !allResolved(cur.comments)) {
      return { ok: false, code: "INVALID_STATE", message: "재검토 조건 불충족" };
    }
    const next: PrSnap = {
      ...cur,
      stateVersion: cur.stateVersion + 1,
      revisionRound: 2,
      phase: "open",
      comments: [
        {
          id: "c3",
          authorRole: "senior",
          authorLabel: "Senior",
          body: "[API] 1차 반영 확인. 401/403 계약 테스트를 추가해 주세요.",
          status: "pending"
        },
        {
          id: "c4",
          authorRole: "qa",
          authorLabel: "QA",
          body: "[API] 엣지(중복 가입) 시나리오가 명세에 반영됐는지 검토 부탁드립니다.",
          status: "pending"
        }
      ]
    };
    this.workspace.savePrSnapshot(sessionId, next, req.user.sub);
    const ev: IntegrationEvent = {
      type: "PR_UPDATED",
      sessionId,
      stateVersion: next.stateVersion,
      triggeredBy: "user",
      payload: prEventPayload(next),
      timestamp: new Date().toISOString()
    };
    await this.eventPublisher.publish(ev);
    return { ok: true, data: next };
  }

  @Post(":sessionId/pr-review/final-approve")
  async finalApprove(
    @Param("sessionId") sessionId: string,
    @Body() body: { stateVersion?: number },
    @Req() req: AuthedRequest
  ) {
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    const cur = this.workspace.getPrSnapshot(sessionId);
    if (body.stateVersion != null && body.stateVersion !== cur.stateVersion) {
      return { ok: false, code: "VERSION_CONFLICT", message: "stateVersion 불일치" };
    }
    if (cur.revisionRound < 2 || cur.phase !== "open" || !allResolved(cur.comments)) {
      return { ok: false, code: "INVALID_STATE", message: "최종 승인 조건 불충족" };
    }
    const next: PrSnap = {
      ...cur,
      stateVersion: cur.stateVersion + 1,
      phase: "approved"
    };
    this.workspace.savePrSnapshot(sessionId, next, req.user.sub);
    const ev: IntegrationEvent = {
      type: "PR_MERGED",
      sessionId,
      stateVersion: next.stateVersion,
      triggeredBy: "user",
      payload: prEventPayload(next),
      timestamp: new Date().toISOString()
    };
    await this.eventPublisher.publish(ev);
    return { ok: true, data: next };
  }
}
