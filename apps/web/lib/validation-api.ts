import { apiFetch } from "./api-fetch";

export type ValidationCacheRow = {
  prNumber: number;
  result: {
    passed: boolean;
    checks: Record<string, unknown>;
    prNumber: number;
    commitSha: string;
  };
  checkedAt: string;
};

export type PrValidationStatusEnvelope = {
  prNumber: number;
  consecutiveFailures: number;
  validation: ValidationCacheRow | null;
};

export async function fetchPrValidationStatus(
  apiBase: string,
  prNumber: number
): Promise<PrValidationStatusEnvelope | null> {
  const base = apiBase.replace(/\/$/, "");
  const res = await apiFetch(`${base}/api/validation/status/${prNumber}`);
  if (!res.ok) {
    throw new Error(`validation status ${res.status}`);
  }
  const body = (await res.json()) as {
    ok?: boolean;
    data?: PrValidationStatusEnvelope | null;
  };
  if (!body?.ok) {
    return null;
  }
  return body.data ?? null;
}
