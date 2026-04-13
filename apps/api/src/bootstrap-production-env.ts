/**
 * NODE_ENV=production 기동 전 환경 변수 검증.
 * docs/api/production-environment.md 참고.
 */

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** RFC 4122 UUID v4 (대소문자 무관) */
export function isUuidV4(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function assertProductionCorsOrigins(): string[] {
  const raw =
    process.env.API_CORS_ORIGINS?.trim() ||
    process.env.CORS_ORIGINS?.trim() ||
    "";
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    throw new Error(
      "[Bootstrap] NODE_ENV=production: set API_CORS_ORIGINS (comma-separated), e.g. https://app.example.com,http://localhost:3000"
    );
  }
  return origins;
}

/**
 * 프로덕션 보안 검증. 실패 시 프로세스 종료(throw).
 * SKIP_PRODUCTION_WEBHOOK_ENFORCEMENT=1 이면 GitHub 웹훅 관련 3종(시크릿·서명 강제·IP 허용 목록)만 생략.
 */
/**
 * 개발: 미설정 시 `github-ingest`. 프로덕션: 부트스트랩에서 UUID 강제 후에도 없으면 예외.
 */
export function resolveIntegrationWebhookSessionId(): string {
  const raw = process.env.INTEGRATION_WEBHOOK_SESSION_ID?.trim();
  if (raw) {
    return raw;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[Runtime] INTEGRATION_WEBHOOK_SESSION_ID missing in production (bootstrap should have prevented this)."
    );
  }
  return "github-ingest";
}

export function validateProductionEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const jwt = process.env.JWT_SECRET?.trim();
  if (!jwt || jwt.length < 32) {
    throw new Error(
      "[Bootstrap] NODE_ENV=production: JWT_SECRET is required (min 32 characters). See docs/api/production-environment.md"
    );
  }

  const sessionId = process.env.INTEGRATION_WEBHOOK_SESSION_ID?.trim();
  if (!sessionId || !isUuidV4(sessionId)) {
    throw new Error(
      "[Bootstrap] NODE_ENV=production: INTEGRATION_WEBHOOK_SESSION_ID must be a UUID v4 (simulation session id). Do not use the dev default."
    );
  }

  if (envFlagTrue(process.env.SKIP_PRODUCTION_WEBHOOK_ENFORCEMENT)) {
    return;
  }

  const hookSecret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
  if (!hookSecret || hookSecret.length < 16) {
    throw new Error(
      "[Bootstrap] NODE_ENV=production: GITHUB_WEBHOOK_SECRET is required (min 16 chars), or set SKIP_PRODUCTION_WEBHOOK_ENFORCEMENT=1 for non-webhook deployments only."
    );
  }

  if (!envFlagTrue(process.env.GITHUB_WEBHOOK_REQUIRE_SIGNATURE)) {
    throw new Error(
      "[Bootstrap] NODE_ENV=production: set GITHUB_WEBHOOK_REQUIRE_SIGNATURE=1"
    );
  }

  const allowRaw =
    process.env.WEBHOOK_ALLOWLIST?.trim() ||
    process.env.WEBHOOK_ALLOWED_CIDRS?.trim() ||
    "";
  if (!allowRaw) {
    throw new Error(
      "[Bootstrap] NODE_ENV=production: set WEBHOOK_ALLOWLIST or WEBHOOK_ALLOWED_CIDRS (GitHub delivery IPs/CIDRs). See docs/collaboration-env-and-endpoints.md §3.2"
    );
  }
}
