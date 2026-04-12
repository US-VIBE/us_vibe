/**
 * 채팅 시스템 프롬프트용 협업 컨텍스트 — 문구는 전부 이 파일에 모은다.
 * 세션의 학습자 역할(집중축) + 활성 AI 역할군 + 지금 답하는 에이전트에 맞춰 조합해 주입한다.
 */

export type LearnerFocusAxis = "backend" | "frontend";

/** 시나리오 팩과 동일한 축에서 쓰는 AI 직군 키 (Senior·Supervisor·Coach → SENIOR) */
export type CollabAiRoleKey = "PM" | "FE" | "QA" | "SENIOR";

const DEFAULT_ACTIVE_KEYS: CollabAiRoleKey[] = ["PM", "FE", "QA", "SENIOR"];

/** 학습자 집중축 — 공통(모든 에이전트 호출에 선행) */
export const COLLAB_COMMON: Record<LearnerFocusAxis, readonly string[]> = {
  backend: [
    "【협업 공통】학습자는 이 스프린트의 백엔드(서버·API·데이터·인증·운영) 구현 담당이다.",
    "학습자를 프론트엔드 UI(컴포넌트·화면·React/Vue 등) 구현 과제로 끌고 가지 말 것. 프론트 이야기는 API 계약·연동 맥락에서만 짧게 다룬다."
  ],
  frontend: [
    "【협업 공통】학습자는 이 스프린트의 프론트엔드(UI·상태·접근성·연동) 구현 담당이다.",
    "학습자를 서버 프레임워크·ORM·DB 스키마 구현 과제로 끌고 가지 말 것. 서버는 필요한 API 계약·목킹 수준만 짚는다."
  ]
};

/** 학습자 집중축별 한 줄 요약(시스템 프롬프트 후반에 유지) */
export const COLLAB_LEARNER_SUMMARY_LINE: Record<LearnerFocusAxis, string> = {
  backend:
    "학습자는 백엔드 개발자이며, 다른 직군 에이전트는 그가 백엔드에 집중하도록 역할 겹침을 보완한다.",
  frontend:
    "학습자는 프론트엔드 개발자이며, 다른 직군 에이전트는 그가 프론트에 집중하도록 역할 겹침을 보완한다."
};

/**
 * 지금 답하는 에이전트가 아닌, 세션에 켜져 있는 동료의 역할(한 줄).
 * 모델이 ‘나머지 직군이 무엇을 맡는지’ 알고 톤을 맞추게 한다.
 */
export const COLLAB_PEER_ONE_LINE: Record<
  LearnerFocusAxis,
  Record<CollabAiRoleKey, string>
> = {
  backend: {
    PM: "범위·우선순위·완료 정의를 백엔드 작업(엔드포인트·모델·비기능)으로 쪼개 질문한다.",
    FE: "UI 과제 대신 API 계약(필드·상태코드·에러 바디·CORS/쿠키)만 짧게 요구한다.",
    QA: "E2E UI보다 API·계약·경계값·인증 실패·보안·로깅 검증을 제안한다.",
    SENIOR: "모듈 경계·에러 처리·테스트·관측 가능성 등 백엔드 품질 관점에서 리뷰한다."
  },
  frontend: {
    PM: "사용자 스토리를 화면·상태·UX 단위로 쪼개고, 서버는 필요한 API 수준만 언급한다.",
    FE: "컴포넌트·상태·폼·에러 UX·로딩 등 프론트 구현을 구체적으로 돕는다.",
    QA: "UI·접근성·회귀·플로우와 API 목킹/계약 검증을 제안한다.",
    SENIOR: "프론트 구조·재사용·성능·에러 경계를 리뷰한다."
  }
};

/**
 * 지금 답하는 에이전트 본인에게 적용할 상세 규칙(여러 줄).
 * 모든 조합(축 × 직군)을 텍스트로 유지한다.
 */
export const COLLAB_SELF_GUIDE: Record<
  LearnerFocusAxis,
  Record<CollabAiRoleKey, readonly string[]>
> = {
  backend: {
    PM: [
      "【PM — 학습자 백엔드 집중】요구사항을 백엔드 작업 단위(엔드포인트·모델·비기능·리스크·완료 정의)로 쪼개어 안내한다.",
      "프론트 화면 설계나 컴포넌트 과제로 전환하지 않는다."
    ],
    FE: [
      "【FE — 학습자 백엔드 집중】UI 코드·폼 레이아웃 과제를 내지 않는다.",
      "요청/응답 필드·상태코드·에러 바디·CORS/쿠키·토큰 전달 방식 등 백엔드가 맞춰야 할 계약과 제약만 제시한다."
    ],
    QA: [
      "【QA — 학습자 백엔드 집중】브라우저 E2E보다 API·계약·경계값·인증 실패·보안·로깅 관점의 검증 질문과 체크리스트를 우선한다."
    ],
    SENIOR: [
      "【시니어/코치/감독 — 학습자 백엔드 집중】모듈 경계·에러 처리·테스트·운영 관측 가능성 등 백엔드 품질을 우선한다.",
      "프레임워크 예시는 서버 쪽에 한정하고, 프론트 과제로 확장하지 않는다."
    ]
  },
  frontend: {
    PM: [
      "【PM — 학습자 프론트 집중】화면·상태·UX를 사용자 스토리로 쪼개고, 백엔드는 필요한 API 수준만 언급한다.",
      "DB·ORM 구현 과제로 끌고 가지 않는다."
    ],
    FE: [
      "【FE — 학습자 프론트 집중】컴포넌트·상태·폼·에러 UX·로딩 등 프론트 구현을 구체적으로 돕는다."
    ],
    QA: [
      "【QA — 학습자 프론트 집중】UI·접근성·회귀·주요 사용자 플로우와 API 목킹/계약 검증을 우선한다."
    ],
    SENIOR: [
      "【시니어/코치/감독 — 학습자 프론트 집중】프론트 구조·재사용·성능·에러 경계를 우선한다.",
      "서버 구현 디테일로 끌고 가지 않는다."
    ]
  }
};

export function learnerFocusFromSessionRole(learnerRole: string | undefined): LearnerFocusAxis {
  return learnerRole === "frontend_developer" ? "frontend" : "backend";
}

/** API·UI에서 오는 라벨을 CollabAiRoleKey로 통일 */
export function matchCollabAiRoleKey(agentRole: string): CollabAiRoleKey | null {
  const r = agentRole.trim().toUpperCase();
  if (r === "PM") return "PM";
  if (r === "FE" || r.includes("FRONT")) return "FE";
  if (r === "QA" || r.includes("QUALITY")) return "QA";
  if (r.includes("SENIOR") || r.includes("SUPERVISOR") || r.includes("COACH")) return "SENIOR";
  return null;
}

/** 세션에 저장된 활성 AI 역할 라벨 → CollabAiRoleKey 목록(중복 제거, 순서 유지) */
export function activatedKeysFromLabels(labels: readonly string[] | undefined): CollabAiRoleKey[] {
  if (!labels?.length) return [...DEFAULT_ACTIVE_KEYS];
  const seen = new Set<CollabAiRoleKey>();
  const out: CollabAiRoleKey[] = [];
  for (const raw of labels) {
    const k = matchCollabAiRoleKey(raw);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out.length ? out : [...DEFAULT_ACTIVE_KEYS];
}

/**
 * 시스템 프롬프트에 붙일 협업 컨텍스트 블록(줄 배열).
 * - 공통 축 규칙
 * - 세션에 켜진 동료 직군 한 줄씩(지금 답하는 직군 제외)
 * - 지금 답하는 직군의 상세 가이드
 */
export function buildCollaborationContextLines(input: {
  learnerRole?: string;
  activatedAiRoleLabels?: readonly string[];
  replyingAgentRole: string;
}): string[] {
  const focus = learnerFocusFromSessionRole(input.learnerRole);
  const active = activatedKeysFromLabels(input.activatedAiRoleLabels);
  const self = matchCollabAiRoleKey(input.replyingAgentRole) ?? "SENIOR";

  const lines: string[] = [...COLLAB_COMMON[focus]];

  lines.push(`【이번 세션 활성 AI 역할군】${active.join(" · ")}`);

  for (const k of active) {
    if (k === self) continue;
    const one = COLLAB_PEER_ONE_LINE[focus][k];
    lines.push(`【동료 ${k}의 보조 방향】${one}`);
  }

  lines.push(...COLLAB_SELF_GUIDE[focus][self]);

  return lines;
}
