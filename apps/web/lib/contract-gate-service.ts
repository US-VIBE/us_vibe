import { apiFetch } from "./api-fetch";
import type { LearningSession } from "./session-types";
import type { ValidationResult } from "@specs/data-model/types";

export type { ValidationResult } from "@specs/data-model/types";

function unwrap<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true && o.data !== undefined) return o.data as T;
  return json as T;
}

const apiBase = () => process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

/**
 * 문서에 `LINT_FAIL` / `TS_FAIL` / `INVALID_CONTRACT` 포함 시 해당 검증만 실패 (데모용).
 * 기본: openapi 3 + paths 존재 시 계약 통과.
 */
export function mockValidateOpenApi(openApiYaml: string): ValidationResult {
  const y = openApiYaml;
  const lintFail = y.includes("LINT_FAIL");
  const tsFail = y.includes("TS_FAIL");
  const contractFail = y.includes("INVALID_CONTRACT") || (!y.includes("paths:") && y.trim().length > 0);

  const lintPassed = !lintFail;
  const tsPassed = !tsFail;
  const contractPassed = !contractFail;

  const passed = lintPassed && tsPassed && contractPassed;

  return {
    passed,
    checks: {
      lint: {
        passed: lintPassed,
        errors: lintFail
          ? [
              {
                file: "src/api.ts",
                line: 1,
                rule: "demo/lint-fail",
                message: "목업: YAML에 LINT_FAIL 문자열이 있으면 린트 실패로 처리합니다."
              }
            ]
          : []
      },
      typecheck: {
        passed: tsPassed,
        errors: tsFail ? ["목업: TS_FAIL 문자열이 있으면 타입체크 실패로 처리합니다."] : []
      },
      contract: {
        passed: contractPassed,
        diffs: contractFail
          ? [
              {
                path: "/auth/login",
                method: "POST",
                changeType: "modified",
                affectedFields: ["response.body.token"],
                impactedConsumers: ["FE:LoginForm", "QA:contract-tests"]
              }
            ]
          : []
      }
    },
    prNumber: 12,
    commitSha: "c0ffee42"
  };
}

export function isValidationPassing(v: ValidationResult | null): boolean {
  return v != null && v.passed;
}

/**
 * POST /api/sessions/:sessionId/contract/validate
 * body: { openApiYaml: string }
 */
export async function validateOpenApiContract(
  session: LearningSession,
  openApiYaml: string
): Promise<ValidationResult> {
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/contract/validate`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ openApiYaml })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<{ validationResult: ValidationResult }>(json);
        if (data?.validationResult) return data.validationResult;
      }
    } catch (e) {
      console.warn("[contract-gate] validate API 실패, 목업", e);
    }
  }
  return mockValidateOpenApi(openApiYaml);
}

/**
 * POST /api/sessions/:sessionId/contract/approve
 * body: { validationPassed: boolean } — 클라이언트는 마지막 검증이 passed일 때만 호출
 */
export async function approveContractGate(
  session: LearningSession,
  lastValidation: ValidationResult | null
): Promise<{ approved: boolean; approvedAt: string }> {
  if (!isValidationPassing(lastValidation)) {
    return Promise.reject(new Error("검증 통과 전에는 승인할 수 없습니다."));
  }
  const base = apiBase();
  if (base) {
    try {
      const res = await apiFetch(
        `${base}/api/sessions/${encodeURIComponent(session.sessionId)}/contract/approve`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ validationPassed: true })
        }
      );
      if (res.ok) {
        const json: unknown = await res.json();
        const data = unwrap<{ approved: boolean; approvedAt: string }>(json);
        if (data?.approved) return data;
      }
    } catch (e) {
      console.warn("[contract-gate] approve API 실패, 목업", e);
    }
  }
  return { approved: true, approvedAt: new Date().toISOString() };
}
