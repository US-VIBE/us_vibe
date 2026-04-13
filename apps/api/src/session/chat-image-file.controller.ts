import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import * as fs from "fs";
import type { Response } from "express";
import { verifyChatImageDownload, chatImageDownloadSecret } from "./chat-image-download.util";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

/**
 * 채팅 첨부 이미지 공개 조회 — `<img src>` 용.
 * `exp`·`sig`는 업로드 응답에서 발급되며 TTL이 지나면 무효입니다.
 */
@Controller("api/chat-image-files")
export class ChatImageFileController {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get(":sessionId/:imageId")
  getSignedFile(
    @Param("sessionId") sessionId: string,
    @Param("imageId") imageId: string,
    @Query("exp") expRaw: string,
    @Query("sig") sig: string,
    @Res({ passthrough: false }) res: Response
  ): void {
    const exp = Number(expRaw);
    const secret = chatImageDownloadSecret();
    if (!verifyChatImageDownload(sessionId, imageId, exp, sig ?? "", secret)) {
      throw new UnauthorizedException({
        ok: false,
        code: "CHAT_IMAGE_SIG_INVALID",
        message: "서명이 올바르지 않거나 만료되었습니다."
      });
    }
    const row = this.workspace.getSessionChatImage(sessionId, imageId);
    if (!row) {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_NOT_FOUND",
        message: "이미지를 찾을 수 없습니다."
      });
    }
    let buf: Buffer;
    try {
      buf = fs.readFileSync(row.storedPath);
    } catch {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_FILE_MISSING",
        message: "저장된 파일을 읽을 수 없습니다."
      });
    }
    res.setHeader("Content-Type", row.mime);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.status(200).send(buf);
  }
}
