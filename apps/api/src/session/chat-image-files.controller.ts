import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  StreamableFile
} from "@nestjs/common";
import * as fs from "fs";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";
import {
  chatImageDownloadSecret,
  verifyChatImageDownload
} from "./chat-image-download.util";

/**
 * 브라우저 `<img src>`용 서명 URL. JWT 없이 `exp`·HMAC만 검증한다.
 */
@Controller("api/chat-image-files")
export class ChatImageFilesController {
  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get(":sessionId/:imageId")
  getSignedFile(
    @Param("sessionId") sessionId: string,
    @Param("imageId") imageId: string,
    @Query("exp") expRaw: string,
    @Query("sig") sig: string
  ): StreamableFile {
    const exp = parseInt(String(expRaw ?? ""), 10);
    if (!sig || !Number.isFinite(exp)) {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_BAD_QUERY",
        message: "exp·sig 쿼리가 필요합니다."
      });
    }
    let secret: string;
    try {
      secret = chatImageDownloadSecret();
    } catch {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_SIGNING_UNAVAILABLE",
        message: "서명 키가 구성되어 있지 않습니다."
      });
    }
    if (!verifyChatImageDownload(sessionId, imageId, exp, sig, secret)) {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_BAD_SIGNATURE",
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
    try {
      fs.accessSync(row.storedPath, fs.constants.R_OK);
    } catch {
      throw new NotFoundException({
        ok: false,
        code: "CHAT_IMAGE_FILE_MISSING",
        message: "저장된 파일을 읽을 수 없습니다."
      });
    }
    return new StreamableFile(fs.createReadStream(row.storedPath), { type: row.mime });
  }
}
