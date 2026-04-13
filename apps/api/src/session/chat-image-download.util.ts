import { createHmac, timingSafeEqual } from "crypto";

const PAYLOAD_PREFIX = "v1";

export function signChatImageDownload(
  sessionId: string,
  imageId: string,
  expUnixSec: number,
  secret: string
): string {
  const payload = `${PAYLOAD_PREFIX}|${sessionId}|${imageId}|${expUnixSec}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyChatImageDownload(
  sessionId: string,
  imageId: string,
  expUnixSec: number,
  sigHex: string,
  secret: string
): boolean {
  if (!Number.isFinite(expUnixSec) || expUnixSec <= 0) return false;
  if (!sigHex || typeof sigHex !== "string" || sigHex.length !== 64) return false;
  if (Math.floor(Date.now() / 1000) > expUnixSec) return false;
  const expected = signChatImageDownload(sessionId, imageId, expUnixSec, secret);
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sigHex, "utf8"));
  } catch {
    return false;
  }
}

export function chatImageDownloadSecret(): string {
  const raw =
    process.env.CHAT_IMAGE_DOWNLOAD_SECRET?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "dev-insecure-chat-image-secret";
  return raw;
}
