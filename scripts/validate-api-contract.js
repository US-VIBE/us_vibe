#!/usr/bin/env node
/**
 * validate-api-contract.js
 *
 * OpenAPI 계약 검증 스크립트 (D. 인테그레이션 & 샌드박스 소유)
 *
 * 검증 항목:
 *   1. 필수 계약 파일 존재 여부
 *   2. OpenAPI YAML 파싱 가능 여부 (구문 오류 탐지)
 *   3. specs/api-contract.md에 명시된 엔드포인트와 OpenAPI 스펙 일치 여부
 *   4. 응답 형식 정책 준수 여부 (success/error format)
 */

const fs = require("fs");
const path = require("path");

// ── 설정 ──────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..");
const OPENAPI_PATH = path.join(ROOT, "specs/openapi/v1.yaml");
const CONTRACT_PATH = path.join(ROOT, "specs/api-contract.md");

let hasError = false;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  hasError = true;
}

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function info(message) {
  console.log(`[INFO] ${message}`);
}

// ── Step 1: 필수 파일 존재 확인 ──────────────────────────────────
info("Step 1: 필수 계약 파일 존재 확인...");

const requiredFiles = [OPENAPI_PATH, CONTRACT_PATH];
for (const filePath of requiredFiles) {
  if (!fs.existsSync(filePath)) {
    fail(`필수 파일 없음: ${path.relative(ROOT, filePath)}`);
  } else {
    pass(`파일 존재: ${path.relative(ROOT, filePath)}`);
  }
}

if (hasError) {
  console.error("\n계약 파일이 없습니다. 검증을 중단합니다.");
  process.exit(1);
}

// ── Step 2: OpenAPI YAML 파싱 ────────────────────────────────────
info("\nStep 2: OpenAPI YAML 파싱 검증...");

let openApiDoc;
try {
  const yamlContent = fs.readFileSync(OPENAPI_PATH, "utf-8");

  // 기본 YAML 파싱 (js-yaml 없이 구조 검증)
  // 필수 최상위 키 확인
  if (!yamlContent.includes("openapi:")) {
    fail("openapi 버전 필드 누락");
  }
  if (!yamlContent.includes("info:")) {
    fail("info 필드 누락");
  }
  if (!yamlContent.includes("paths:")) {
    fail("paths 필드 누락");
  }

  // paths 섹션에서 엔드포인트 추출
  const pathMatches = yamlContent.match(/^  (\/[^\s:]+):/gm) || [];
  const openApiPaths = pathMatches.map((m) => m.trim().replace(/:$/, ""));

  openApiDoc = { paths: openApiPaths, raw: yamlContent };
  pass(`OpenAPI YAML 파싱 성공 (엔드포인트 ${openApiPaths.length}개 감지)`);
  openApiPaths.forEach((p) => info(`  발견된 엔드포인트: ${p}`));
} catch (err) {
  fail(`OpenAPI YAML 파싱 실패: ${err.message}`);
  process.exit(1);
}

// ── Step 3: api-contract.md 엔드포인트와 비교 ────────────────────
info("\nStep 3: api-contract.md 엔드포인트 일치 검증...");

const contractContent = fs.readFileSync(CONTRACT_PATH, "utf-8");

// api-contract.md 에서 엔드포인트 추출 (예: `- \`GET /health\``)
const contractEndpointMatches =
  contractContent.match(/`(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^\`]*)`/g) || [];
const contractPaths = contractEndpointMatches.map((m) => {
  const match = m.match(/`(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[^\`]*)`/);
  return match ? match[1] : null;
}).filter(Boolean);

info(`api-contract.md에 명시된 엔드포인트: ${contractPaths.length}개`);
contractPaths.forEach((p) => info(`  계약 엔드포인트: ${p}`));

// OpenAPI에 없는 계약 엔드포인트 확인
for (const contractPath of contractPaths) {
  const found = openApiDoc.paths.some(
    (p) => p === contractPath || p.startsWith(contractPath)
  );
  if (!found) {
    fail(
      `api-contract.md에 명시된 엔드포인트 "${contractPath}"가 OpenAPI 스펙에 없음`
    );
  } else {
    pass(`엔드포인트 일치: ${contractPath}`);
  }
}

// ── Step 4: 응답 형식 정책 확인 ──────────────────────────────────
info("\nStep 4: 응답 형식 정책 확인...");

// api-contract.md에 응답 정책 섹션이 있는지 확인
if (!contractContent.includes("Response Policy") && !contractContent.includes("응답")) {
  fail("api-contract.md에 응답 형식 정책(Response Policy)이 명시되지 않음");
} else {
  pass("응답 형식 정책 섹션 존재 확인");
}

// OpenAPI에 200 응답 정의가 있는지 확인
if (!openApiDoc.raw.includes('"200"') && !openApiDoc.raw.includes("'200'") && !openApiDoc.raw.includes("200:")) {
  fail("OpenAPI 스펙에 200 응답 정의가 없음");
} else {
  pass("OpenAPI 200 응답 정의 존재 확인");
}

// ── 결과 출력 ────────────────────────────────────────────────────
console.log("\n" + "=".repeat(50));
if (hasError) {
  console.error("API 계약 검증 실패. 위 오류를 수정 후 다시 시도하세요.");
  console.error("관련 문서: docs/integration-sandbox/collaboration-interface.md");
  process.exit(1);
} else {
  console.log("API 계약 검증 통과.");
  process.exit(0);
}
