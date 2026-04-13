import { getAccessToken } from "./auth-storage";
import type { ChatAttachment } from "./chat-types";
import { uploadSessionChatImage } from "./workspace-collab-api";

export const CHAT_ATTACH_LIMITS = {
  maxAttachments: 5,
  maxImageBytes: 1_048_576,
  maxFileChars: 24_000
} as const;

const IMAGE_MIME = /^(image\/png|image\/jpeg|image\/webp)$/i;

const TEXT_EXT = /\.(txt|md|json|ya?ml|ts|tsx|js|jsx|css|html|svg|log)$/i;

function isProbablyTextFile(file: File): boolean {
  if (file.type.startsWith("text/") || file.type === "application/json") return true;
  return TEXT_EXT.test(file.name);
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(file);
  });
}

function readFileAsTextSlice(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const t = String(r.result ?? "");
      resolve(t.length > max ? `${t.slice(0, max)}\n\n…(이후 ${t.length - max}자 생략)` : t);
    };
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsText(file, "UTF-8");
  });
}

/** 단일 파일을 채팅 첨부로 변환 (실패 시 이유 문자열) */
export async function fileToChatAttachment(
  file: File,
  opts?: { apiBase?: string; sessionId?: string }
): Promise<{ ok: true; attachment: ChatAttachment } | { ok: false; error: string }> {
  if (IMAGE_MIME.test(file.type)) {
    if (file.size > CHAT_ATTACH_LIMITS.maxImageBytes) {
      return { ok: false, error: `이미지는 ${CHAT_ATTACH_LIMITS.maxImageBytes / 1024 / 1024}MB 이하여야 합니다: ${file.name}` };
    }
    const base = opts?.apiBase?.replace(/\/$/, "");
    const sid = opts?.sessionId?.trim();
    if (base && sid && getAccessToken()) {
      try {
        const up = await uploadSessionChatImage(base, sid, file);
        const viewUrl =
          up.signedViewUrl && up.signedViewUrl.length > 0
            ? up.signedViewUrl
            : `${base}${up.signedViewPath}`;
        return {
          ok: true,
          attachment: {
            type: "image_ref",
            imageId: up.id,
            mime: up.mime,
            name: file.name,
            viewUrl
          }
        };
      } catch {
        /* Nest 실패 시 아래 data URL 폴백 */
      }
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      return {
        ok: true,
        attachment: { type: "image", mime: file.type, dataUrl, name: file.name }
      };
    } catch {
      return { ok: false, error: `이미지를 읽을 수 없습니다: ${file.name}` };
    }
  }

  if (isProbablyTextFile(file)) {
    if (file.size > CHAT_ATTACH_LIMITS.maxFileChars * 4) {
      return { ok: false, error: `텍스트 파일이 너무 큽니다(약 ${Math.round(file.size / 1024)}KB): ${file.name}` };
    }
    try {
      const preview = await readFileAsTextSlice(file, CHAT_ATTACH_LIMITS.maxFileChars);
      return {
        ok: true,
        attachment: {
          type: "file",
          name: file.name,
          mime: file.type || "text/plain",
          preview
        }
      };
    } catch {
      return { ok: false, error: `파일을 읽을 수 없습니다: ${file.name}` };
    }
  }

  return {
    ok: false,
    error: `지원하지 않는 형식입니다(이미지 PNG/JPEG/WebP 또는 텍스트·코드 파일): ${file.name}`
  };
}
