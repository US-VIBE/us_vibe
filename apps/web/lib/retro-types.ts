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

export interface RetroReport {
  id: string;
  sessionId: string;
  createdAt: string;
  kpis: RetroKpi;
  nextActions: [string, string, string];
}
