#!/usr/bin/env node
/**
 * detect-contract-changes.js
 *
 * PR 기준 OpenAPI 계약 변경 감지 스크립트 (D. 인테그레이션 & 샌드박스 소유)
 *
 * CI에서 호출됨 (GitHub Actions: contract-validation job)
 * 환경변수:
 *   BASE_SHA    - PR base 브랜치의 최신 커밋 SHA
 *   HEAD_SHA    - PR head 브랜치의 최신 커밋 SHA
 *   PR_NUMBER   - PR 번호 (GitHub 코멘트 작성용)
 *
 * 기능:
 *   - BASE..HEAD 사이에서 specs/openapi/ 및 specs/api-contract.md 변경 감지
 *   - ContractDiff 분석 (추가/수정/삭제 엔드포인트)
 *   - 변경 감지 시 .ai/contract-change-report.json 생성
 *   - GitHub Actions summary에 변경 내역 출력
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const BASE_SHA = process.env.BASE_SHA;
const HEAD_SHA = process.env.HEAD_SHA;
const PR_NUMBER = process.env.PR_NUMBER;

function run(cmd, fallback = "") {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch {
    return fallback;
  }
}

function info(msg) { console.log(`[INFO] ${msg}`); }
function warn(msg) { console.warn(`[WARN] ${msg}`); }

if (!BASE_SHA || !HEAD_SHA) {
  warn("BASE_SHA 또는 HEAD_SHA 환경변수 없음. PR 컨텍스트에서만 실행 가능합니다.");
  process.exit(0);
}

info(`PR #${PR_NUMBER || "unknown"} 계약 변경 감지 시작`);
info(`Base: ${BASE_SHA}`);
info(`Head: ${HEAD_SHA}`);

// ── specs/openapi/ · api-contract.md 변경 파일 감지 ──────────────
const diffFiles = run(
  `git diff --name-only ${BASE_SHA}..${HEAD_SHA} -- specs/openapi/ specs/api-contract.md`
).split("\n").filter(Boolean);

if (diffFiles.length === 0) {
  info("OpenAPI·api-contract 계약 변경 없음. 스킵합니다.");
  process.exit(0);
}

info(`계약 파일 변경 감지: ${diffFiles.join(", ")}`);

// ── 변경 내용 분석 ────────────────────────────────────────────────
const report = {
  prNumber: PR_NUMBER,
  detectedAt: new Date().toISOString(),
  changedFiles: diffFiles,
  addedEndpoints: [],
  removedEndpoints: [],
  modifiedEndpoints: [],
  impactSummary: [],
};

for (const file of diffFiles) {
  const diffOutput = run(`git diff ${BASE_SHA}..${HEAD_SHA} -- "${file}"`);
  const lines = diffOutput.split("\n");

  if (!file.endsWith("v1.yaml") && !file.includes("openapi")) {
    continue;
  }

  for (const line of lines) {
    // 추가된 경로
    const addedPath = line.match(/^\+\s+(\/[^:]+):/);
    if (addedPath && !line.startsWith("+++")) {
      report.addedEndpoints.push(addedPath[1]);
    }
    // 제거된 경로
    const removedPath = line.match(/^-\s+(\/[^:]+):/);
    if (removedPath && !line.startsWith("---")) {
      report.removedEndpoints.push(removedPath[1]);
    }
  }
}

// 중복 제거 및 수정 분류
const allAdded = [...new Set(report.addedEndpoints)];
const allRemoved = [...new Set(report.removedEndpoints)];

// 동시에 추가/제거된 것은 수정으로 분류
const modified = allAdded.filter((ep) => allRemoved.includes(ep));
report.modifiedEndpoints = modified;
report.addedEndpoints = allAdded.filter((ep) => !modified.includes(ep));
report.removedEndpoints = allRemoved.filter((ep) => !modified.includes(ep));

// 영향도 요약 생성
if (report.addedEndpoints.length > 0) {
  report.impactSummary.push(
    `신규 엔드포인트 ${report.addedEndpoints.length}개 — FE Agent가 연동 컴포넌트 추가 필요`
  );
}
if (report.removedEndpoints.length > 0) {
  report.impactSummary.push(
    `삭제된 엔드포인트 ${report.removedEndpoints.length}개 — 하위 호환성 검토 및 FE/QA 업데이트 필요`
  );
  report.impactSummary.push("⚠️  Senior Agent 검토 권장");
}
if (report.modifiedEndpoints.length > 0) {
  report.impactSummary.push(
    `수정된 엔드포인트 ${report.modifiedEndpoints.length}개 — FE/QA 에이전트 재검증 필요`
  );
}

const apiContractTouched = diffFiles.some((f) => f.endsWith("api-contract.md"));
if (apiContractTouched) {
  report.impactSummary.push(
    "specs/api-contract.md 변경 — 엔드포인트·응답 정책 문구 검토 및 OpenAPI와 정합 확인"
  );
}

// ── GitHub Actions 요약 출력 ──────────────────────────────────────
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  const summaryContent = `
## OpenAPI 계약 변경 감지 리포트

**PR #${PR_NUMBER}**

| 구분 | 엔드포인트 |
|------|-----------|
| 신규 추가 | ${report.addedEndpoints.join(", ") || "없음"} |
| 수정 | ${report.modifiedEndpoints.join(", ") || "없음"} |
| 삭제 | ${report.removedEndpoints.join(", ") || "없음"} |

### 영향도 요약
${report.impactSummary.map((s) => `- ${s}`).join("\n") || "- 영향 없음"}

### Gate B — PR 라벨
**담당(B):** 엔드포인트 추가·삭제·스키마 의미 변경이 있으면 GitHub PR에 **`[contract-changed]`** 라벨을 부착하세요. (`docs/checklist.md` Gate B)

> A(오케스트레이터)가 FE/QA 에이전트에게 재검토를 요청합니다.
`;
  fs.appendFileSync(summaryFile, summaryContent, "utf-8");
}

// ── 리포트 저장 ───────────────────────────────────────────────────
const aiDir = path.join(ROOT, ".ai");
if (!fs.existsSync(aiDir)) {
  fs.mkdirSync(aiDir, { recursive: true });
}

const reportPath = path.join(aiDir, "contract-change-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
info(`리포트 저장: ${path.relative(ROOT, reportPath)}`);

// ── 콘솔 출력 ────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
console.log("계약 변경 요약:");
console.log(`  신규: ${report.addedEndpoints.length}개`);
console.log(`  수정: ${report.modifiedEndpoints.length}개`);
console.log(`  삭제: ${report.removedEndpoints.length}개`);
report.impactSummary.forEach((s) => console.log(`  - ${s}`));

process.exit(0);
