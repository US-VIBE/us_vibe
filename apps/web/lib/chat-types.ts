/** 워크스페이스 채팅 메시지 (사용자 · 에이전트 · 시스템) */

/** 사용자 메시지에만 사용. 스크린샷·GitHub UI 등은 이미지, 코드 스냅샷·로그는 텍스트 파일로 전달 */
export type ChatAttachment =
  | { type: "image"; mime: string; dataUrl: string; name?: string }
  /** Nest `POST .../chat-images` 저장 후 — 미리보기는 `viewUrl`(서명 URL 또는 API 베이스+경로) */
  | { type: "image_ref"; imageId: string; mime: string; name?: string; viewUrl: string }
  | { type: "file"; name: string; mime: string; preview: string };

export type ChatMessage = {
  id: string;
  kind: "user" | "agent" | "system";
  text: string;
  agentId?: string;
  agentLabel?: string;
  displayName?: string;
  /** 사용자 메시지: 이미지(data URL) 또는 작은 텍스트 파일 미리보기 */
  attachments?: ChatAttachment[];
};
