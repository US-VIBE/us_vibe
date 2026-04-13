import * as crypto from "node:crypto";

const PAYLOAD_SEP = "\n";

/** 서명 URL용 비밀. 전용 키가 없으면 JWT_SECRET을 재사용한다. */
export function chatImageDownloadSecret(): string {
  const direct = process.env.CHAT_IMAGE_DOWNLOAD_SECRET?.trim();
  if (direct) return direct;
  const jwt = process.env.JWT_SECRET?.trim();
  if (jwt) return jwt;
  throw new Error("CHAT_IMAGE_DOWNLOAD_SECRET 또는 JWT_SECRET이 필요합니다.");
}

export function signChatImageDownload(
  sessionId: string,
  imageId: string,
  exp: number,
  secret: string
): string {
  const payload = `${sessionId}${PAYLOAD_SEP}${imageId}${PAYLOAD_SEP}${String(exp)}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyChatImageDownload(
  sessionId: string,
  imageId: string,
  exp: number,
  sig: string,
  secret: string
): boolean {
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return false;
  }
  try {
    const expected = signChatImageDownload(sessionId, imageId, exp, secret);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig.trim(), "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
