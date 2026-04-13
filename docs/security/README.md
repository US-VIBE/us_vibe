# 보안 관련 기능 문서 (인덱스)

`develop`에 기능 단위로 반영된 보안 강화 항목과 설계 요약이다.

| 문서 | 주제 |
|------|------|
| [integration-sse-session-scoping.md](./integration-sse-session-scoping.md) | 통합 SSE 세션 격리·접근 검사 |
| [session-artifact-magic-bytes.md](./session-artifact-magic-bytes.md) | 산출물 업로드 매직 바이트 검증 |
| [authentication-refresh-jwt.md](./authentication-refresh-jwt.md) | 짧은 액세스 JWT·HttpOnly 리프레시 |
| [production-health-endpoints.md](./production-health-endpoints.md) | `/health/webhook-security` 프로덕션 기본 비노출 |
| [http-validation-and-web-headers.md](./http-validation-and-web-headers.md) | Helmet·ValidationPipe·Next 보안 헤더 |

상세 운영 변수는 `docs/api/production-environment.md`, `docs/backend/users-auth.md`, `docs/collaboration-env-and-endpoints.md`와 함께 본다.
