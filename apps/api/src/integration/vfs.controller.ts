import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  Logger,
  Inject,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthedRequest } from "../auth/authed-request";
import { VfsService, VfsFile, VfsSnapshot, VfsDiff } from "./vfs.service";
import { EVENT_PUBLISHER, IEventPublisher } from "./event-publisher.interface";
import type { IntegrationEvent } from "../../../../specs/data-model/types";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

interface CreateSnapshotDto {
  files: VfsFile[];
  agentType: string;
  sessionId: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  code?: string;
  message?: string;
}

@Controller("api/vfs")
@UseGuards(JwtAuthGuard)
export class VfsController {
  private readonly logger = new Logger(VfsController.name);

  constructor(
    private readonly vfsService: VfsService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
    private readonly workspace: WorkspacePersistenceService,
  ) {}

  @Post("snapshot")
  @HttpCode(201)
  async createSnapshot(
    @Body() dto: CreateSnapshotDto,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse<{ snapshotId: string; diffUrl: string }>> {
    this.workspace.assertWorkspaceSessionAccess(dto.sessionId, req.user.sub);
    const snapshot = await this.vfsService.createSnapshot(
      dto.files,
      dto.agentType,
      dto.sessionId,
    );

    const diffUrl = `/api/vfs/diff/${snapshot.snapshotId}`;

    const event: IntegrationEvent = {
      type: "VFS_SNAPSHOT_CREATED",
      sessionId: dto.sessionId,
      stateVersion: this.workspace.getWorkspaceStateVersion(dto.sessionId),
      triggeredBy: "agent",
      payload: {
        snapshotId: snapshot.snapshotId,
        vfsBranch: `vfs/${snapshot.snapshotId}`,
        diffUrl,
      },
      timestamp: new Date().toISOString(),
    };
    await this.eventPublisher.publish(event);

    return {
      ok: true,
      data: { snapshotId: snapshot.snapshotId, diffUrl },
    };
  }

  @Get("diff/:snapshotId")
  async getDiff(
    @Param("snapshotId") snapshotId: string,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse<VfsDiff>> {
    const snap = await this.vfsService.getSnapshot(snapshotId);
    this.workspace.assertWorkspaceSessionAccess(snap.sessionId, req.user.sub);
    const diff = await this.vfsService.getDiff(snapshotId);
    return { ok: true, data: diff };
  }

  @Post("approve/:snapshotId")
  @HttpCode(200)
  async approveSnapshot(
    @Param("snapshotId") snapshotId: string,
    @Req() req: AuthedRequest,
  ): Promise<ApiResponse<VfsSnapshot>> {
    const pending = await this.vfsService.getSnapshot(snapshotId);
    this.workspace.assertWorkspaceSessionAccess(pending.sessionId, req.user.sub);
    const snapshot = await this.vfsService.approveSnapshot(snapshotId);

    const event: IntegrationEvent = {
      type: "VFS_APPROVED",
      sessionId: snapshot.sessionId,
      stateVersion: this.workspace.getWorkspaceStateVersion(snapshot.sessionId),
      triggeredBy: "user",
      payload: {
        snapshotId: snapshot.snapshotId,
        targetBranch: `feature/${snapshot.sessionId}`,
      },
      timestamp: new Date().toISOString(),
    };
    await this.eventPublisher.publish(event);

    this.logger.log(`VFS 승인 이벤트 발행 완료: ${snapshotId}`);
    return { ok: true, data: snapshot };
  }
}
