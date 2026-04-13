import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

@Controller("api/integration/webhook-routes")
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class IntegrationWebhookRoutesController {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    const routes = this.workspace.listGithubRepoWebhookRoutesForUser(req.user.sub);
    return { ok: true, data: { routes } };
  }

  @Post()
  register(
    @Req() req: AuthedRequest,
    @Body() body: { repoFullName?: string; sessionId?: string }
  ): { ok: true; data: { repoFullName: string; sessionId: string } } {
    const sessionId = body.sessionId?.trim() ?? "";
    const repoFullName = body.repoFullName?.trim() ?? "";
    if (!sessionId || !repoFullName) {
      throw new BadRequestException("repoFullName, sessionId가 필요합니다.");
    }
    this.workspace.assertWorkspaceSessionAccess(sessionId, req.user.sub);
    this.workspace.upsertGithubRepoWebhookRoute(repoFullName, sessionId, req.user.sub);
    return {
      ok: true,
      data: {
        repoFullName: this.workspace.normalizeGithubRepoFullName(repoFullName),
        sessionId
      }
    };
  }

  @Delete()
  remove(
    @Req() req: AuthedRequest,
    @Query("repoFullName") repoFullName?: string
  ): { ok: true; data: { deleted: boolean; repoFullName: string } } {
    const raw = repoFullName?.trim() ?? "";
    if (!raw) {
      throw new BadRequestException("repoFullName 쿼리가 필요합니다.");
    }
    const deleted = this.workspace.deleteGithubRepoWebhookRoute(raw, req.user.sub);
    return {
      ok: true,
      data: {
        deleted,
        repoFullName: this.workspace.normalizeGithubRepoFullName(raw),
      },
    };
  }
}
