import { Injectable, Logger } from "@nestjs/common";
import type { ValidationResult, ContractDiff } from "../../../../specs/data-model/types";

interface GitHubCommentResponse {
  id: number;
  html_url: string;
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);
  private readonly githubToken: string;

  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN ?? "";
    if (!this.githubToken) {
      this.logger.warn(
        "GITHUB_TOKEN 환경변수가 설정되지 않았습니다. PR 코멘트 자동 생성이 비활성화됩니다.",
      );
    }
  }

  async postPrComment(
    owner: string,
    repo: string,
    prNumber: number,
    body: string,
  ): Promise<GitHubCommentResponse | null> {
    if (!this.githubToken) {
      this.logger.warn(`[stub] PR #${prNumber} 코멘트 작성 스킵 (GITHUB_TOKEN 없음)`);
      return null;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`GitHub API 오류 ${response.status}: ${errorText}`);
        }

        const result = (await response.json()) as GitHubCommentResponse;
        this.logger.log(
          `PR #${prNumber} 코멘트 작성 완료: ${result.html_url}`,
        );
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(
          `PR 코멘트 작성 실패 (시도 ${attempt}/3): ${lastError.message}`,
        );
        if (attempt < 3) {
          await this.sleep(attempt * 1000);
        }
      }
    }

    this.logger.error(`PR #${prNumber} 코멘트 작성 최종 실패: ${lastError?.message}`);
    return null;
  }

  buildValidationFailReport(
    result: ValidationResult,
    options?: { preambleMarkdown?: string }
  ): string {
    const { checks } = result;

    const rows = [
      `| ESLint | ${checks.lint.passed ? "✅ 통과" : `❌ ${checks.lint.errors.length}개 오류`} |`,
      `| TypeScript | ${checks.typecheck.passed ? "✅ 통과" : `❌ ${checks.typecheck.errors.length}개 오류`} |`,
      `| OpenAPI 계약 | ${checks.contract.passed ? "✅ 통과" : `❌ ${checks.contract.diffs.length}개 불일치`} |`,
    ].join("\n");

    const sections: string[] = [];

    if (!checks.lint.passed && checks.lint.errors.length > 0) {
      const errorList = checks.lint.errors
        .slice(0, 10)
        .map((e) => `- \`${e.file}:${e.line}\` — \`${e.rule}\` ${e.message}`)
        .join("\n");
      sections.push(`### ESLint 오류 상세\n${errorList}`);
    }

    if (!checks.typecheck.passed && checks.typecheck.errors.length > 0) {
      const errorList = checks.typecheck.errors
        .slice(0, 10)
        .map((e) => `- ${e}`)
        .join("\n");
      sections.push(`### TypeScript 오류 상세\n${errorList}`);
    }

    if (!checks.contract.passed && checks.contract.diffs.length > 0) {
      const diffList = checks.contract.diffs
        .map(
          (d) =>
            `- \`${d.method} ${d.path}\` — ${d.changeType} (영향: ${d.impactedConsumers.join(", ")})`,
        )
        .join("\n");
      sections.push(`### OpenAPI 계약 불일치 상세\n${diffList}`);
    }

    const core = [
      "## 정적 검증 실패 리포트",
      "",
      "| 검증 항목 | 결과 |",
      "|-----------|------|",
      rows,
      "",
      sections.join("\n\n"),
      "",
      "> 수정 후 커밋을 추가하면 자동으로 재검증됩니다.",
      "> 도움이 필요하면 채팅 채널에서 QA Agent에게 질문하세요.",
    ].join("\n");

    const preamble = options?.preambleMarkdown?.trim();
    if (preamble) {
      return `${preamble}\n\n---\n\n${core}`;
    }
    return core;
  }

  buildContractChangeReport(diffs: ContractDiff[]): string {
    if (diffs.length === 0) return "";

    const added = diffs.filter((d) => d.changeType === "added");
    const modified = diffs.filter((d) => d.changeType === "modified");
    const removed = diffs.filter((d) => d.changeType === "removed");

    const formatList = (items: ContractDiff[]): string =>
      items.length > 0
        ? items
            .map(
              (d) =>
                `- \`${d.method} ${d.path}\` (영향: ${d.impactedConsumers.join(", ")})`,
            )
            .join("\n")
        : "없음";

    return [
      "## OpenAPI 계약 변경 감지",
      "",
      `**신규 추가 (${added.length}개)**`,
      formatList(added),
      "",
      `**수정 (${modified.length}개)**`,
      formatList(modified),
      "",
      `**삭제 (${removed.length}개)**`,
      formatList(removed),
      "",
      "> A(오케스트레이터)가 FE/QA 에이전트에게 재검토를 요청합니다.",
    ].join("\n");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
