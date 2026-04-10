/** 워크스페이스 채팅 메시지 (사용자 · 에이전트 · 시스템) */

export type ChatMessage = {
  id: string;
  kind: "user" | "agent" | "system";
  text: string;
  agentId?: string;
  agentLabel?: string;
  displayName?: string;
};
