import * as crypto from "node:crypto";

/** 프로토콜 고정 문자열 — 다른 HMAC 용도와 페이로드 충돌 방지 */
const PAYLOAD_PREFIX = "usvibe-chat-image-v1";

/**
 * 서명 URL용 비밀.
 * `CHAT_IMAGE_DOWNLOAD_SECRET` → `JWT_SECRET` 순으로 사용하고,
 * 프로덕션에서는 둘 다 없으면 예외를 던진다.
 */
export function chatImageDownloadSecret(): string {
  const direct = process.env.CHAT_IMAGE_DOWNLOAD_SECRET?.trim();
  if (direct) return direct;
  const jwt = process.env.JWT_SECRET?.trim();
  if (jwt) return jwt;
  if (process.env.NODE_ENV !== "production") {
    return "dev-insecure-chat-image-secret";
  }
  throw new Error("CHAT_IMAGE_DOWNLOAD_SECRET 또는 JWT_SECRET이 필요합니다.");
}

export function signChatImageDownload(
  sessionId: string,
  imageId: string,
  expUnixSec: number,
  secret: string
): string {
  const payload = `${PAYLOAD_PREFIX}|${sessionId}|${imageId}|${expUnixSec}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyChatImageDownload(
  sessionId: string,
  imageId: string,
  expUnixSec: number,
  sigHex: string,
  secret: string
): boolean {
  if (!Number.isFinite(expUnixSec) || expUnixSec <= 0) return false;
  const trimmed = typeof sigHex === "string" ? sigHex.trim().toLowerCase() : "";
  if (!trimmed || trimmed.length !== 64 || !/^[0-9a-f]{64}$/.test(trimmed)) {
    return false;
  }
  if (Math.floor(Date.now() / 1000) > expUnixSec) return false;
  const expected = signChatImageDownload(sessionId, imageId, expUnixSec, secret);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(trimmed, "utf8")
    );
  } catch {
    return false;
  }
}
