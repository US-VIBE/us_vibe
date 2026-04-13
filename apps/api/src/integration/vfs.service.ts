import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";

export interface VfsFile {
  filePath: string;
  content: string;
}

export type SnapshotStatus = "pending" | "approved" | "rejected";

export interface VfsSnapshot {
  snapshotId: string;
  sessionId: string;
  agentType: string;
  status: SnapshotStatus;
  files: VfsFile[];
  createdAt: string;
  approvedAt?: string;
}

export interface VfsDiff {
  snapshotId: string;
  status: SnapshotStatus;
  agentType: string;
  createdAt: string;
  files: Array<{
    filePath: string;
    content: string;
    lineCount: number;
  }>;
}

// 스냅샷 메타(vfs_snapshot_index)는 SQLite(WorkspacePersistenceService) + GET /api/vfs/session/:sessionId/snapshot-index.
// TODO: 본문 JSON(vfs-store)을 DB로 옮기고, 승인 시 실 Git 브랜치 반영 — 인터페이스는 유지한 채 내부만 교체.
@Injectable()
export class VfsService {
  private readonly logger = new Logger(VfsService.name);
  private readonly storagePath: string;

  constructor() {
    this.storagePath = process.env.VFS_STORAGE_PATH
      ? path.resolve(process.env.VFS_STORAGE_PATH)
      : path.resolve(process.cwd(), "vfs-store");

    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      this.logger.log(`VFS 스토리지 디렉토리 생성: ${this.storagePath}`);
    }
  }

  async createSnapshot(
    files: VfsFile[],
    agentType: string,
    sessionId: string,
  ): Promise<VfsSnapshot> {
    const snapshotId = randomUUID();
    const snapshot: VfsSnapshot = {
      snapshotId,
      sessionId,
      agentType,
      status: "pending",
      files,
      createdAt: new Date().toISOString(),
    };

    await this.save(snapshotId, snapshot);
    this.logger.log(
      `VFS 스냅샷 생성: ${snapshotId} (agentType=${agentType}, files=${files.length}개)`,
    );
    return snapshot;
  }

  async getDiff(snapshotId: string): Promise<VfsDiff> {
    const snapshot = await this.load(snapshotId);

    return {
      snapshotId: snapshot.snapshotId,
      status: snapshot.status,
      agentType: snapshot.agentType,
      createdAt: snapshot.createdAt,
      files: snapshot.files.map((f) => ({
        filePath: f.filePath,
        content: f.content,
        lineCount: f.content.split("\n").length,
      })),
    };
  }

  async approveSnapshot(snapshotId: string): Promise<VfsSnapshot> {
    const snapshot = await this.load(snapshotId);

    if (snapshot.status !== "pending") {
      throw new Error(
        `스냅샷 ${snapshotId}은 이미 ${snapshot.status} 상태입니다.`,
      );
    }

    snapshot.status = "approved";
    snapshot.approvedAt = new Date().toISOString();
    await this.save(snapshotId, snapshot);

    this.logger.log(`VFS 스냅샷 승인: ${snapshotId}`);

    // TODO: 실 Git 브랜치 반영 (Shadow Branch → feature 브랜치 PR 생성)
    // A(오케스트레이터) Redis VFS_APPROVED 이벤트 발행은 VfsController에서 처리
    this.logger.warn(
      `[stub] 실 Git 반영은 TODO: snapshotId=${snapshotId} — A와 협업 후 구현`,
    );

    return snapshot;
  }

  async getSnapshot(snapshotId: string): Promise<VfsSnapshot> {
    return this.load(snapshotId);
  }

  private async save(snapshotId: string, snapshot: VfsSnapshot): Promise<void> {
    const filePath = path.join(this.storagePath, `${snapshotId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8");
  }

  private async load(snapshotId: string): Promise<VfsSnapshot> {
    const filePath = path.join(this.storagePath, `${snapshotId}.json`);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`스냅샷을 찾을 수 없습니다: ${snapshotId}`);
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as VfsSnapshot;
  }
}
