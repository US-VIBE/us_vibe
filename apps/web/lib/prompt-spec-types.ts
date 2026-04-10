/** 스토리2 Prompt → Spec — 서버 계약 (POST convert / POST approve) */

export interface SpecTemplate {
  goal: string;
  scope: string;
  constraints: string;
  acceptanceCriteria: string[];
  nonGoals: string[];
}

export interface SpecConversionResult {
  specVersion: number;
  template: SpecTemplate;
  /** 미리보기용 마크다운 */
  rawMarkdown: string;
}

export interface SpecApprovalResult {
  status: "approved";
  specVersion: number;
  approvedAt: string;
}
