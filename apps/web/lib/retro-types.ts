/** 스토리5 회고 — KPI 4종 + 다음 액션 3개 (설계 §25) */

export interface RetroKpi {
  /** 역할 균형 지표 0–100 */
  roleBalanceScore: number;
  /** 재작업률 % */
  reworkRatePercent: number;
  /** 리뷰 반영률 % */
  reviewReflectionPercent: number;
  /** 커뮤니케이션 품질 점수 0–100 */
  communicationScore: number;
}

export interface RetroKpiCitation {
  eventType: string;
  timestamp: string;
  note: string;
}

export interface RetroKpiEvidenceBlock {
  key: "roleBalance" | "rework" | "reviewReflection" | "communication";
  labelKo: string;
  score: number;
  unit: string;
  summary: string;
  citations: RetroKpiCitation[];
}

export interface RetroReport {
  id: string;
  sessionId: string;
  createdAt: string;
  kpis: RetroKpi;
  nextActions: [string, string, string];
  /** API 생성 리포트에만 채워질 수 있음 */
  kpiBasis?: string;
  kpiEvidence?: RetroKpiEvidenceBlock[];
}
