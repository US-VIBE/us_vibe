import type { IntegrationEventType } from "../../../specs/data-model/types";

export const sprintCheckpoints = [
  { id: "cp1", label: "요구사항 승인", done: true },
  { id: "cp2", label: "API 계약 승인", done: false },
  { id: "cp3", label: "PR 리뷰 반영", done: false },
  { id: "cp4", label: "회고 리포트 생성", done: false }
] as const;

export type TimelineEntry = {
  id: string;
  type: IntegrationEventType;
  label: string;
  time: string;
};

export const sampleTimeline: TimelineEntry[] = [
  {
    id: "e1",
    type: "PR_OPENED",
    label: "PR #12 열림 (feature/login)",
    time: "10:02"
  },
  {
    id: "e2",
    type: "VALIDATION_PASSED",
    label: "린트·타입·계약 검증 통과",
    time: "10:05"
  },
  {
    id: "e3",
    type: "CODE_DELTA_ANALYZED",
    label: "코드 델타 분석 완료 (엔드포인트 2건 변경)",
    time: "10:06"
  },
  {
    id: "e4",
    type: "VFS_SNAPSHOT_CREATED",
    label: "VFS 스냅샷 생성 (snap-7f3a)",
    time: "10:07"
  },
  {
    id: "e5",
    type: "VFS_APPROVED",
    label: "스냅샷 승인 (게이트 통과)",
    time: "10:09"
  }
];

export const thinkingLines = [
  "[R1] 세션 컨텍스트 로드: sprint-01, 역할 매핑 확인",
  "[R1] D팀 이벤트 큐: PR_OPENED 수신 → 검증 파이프라인 예약",
  "[R1] 계약 diff 요약: POST /sessions 응답 필드 1건 추가",
  "[R1] Senior 에이전트: 리스크 낮음, QA 시나리오 2건 제안"
];
