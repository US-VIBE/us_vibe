# 프로덕션 환경 변수 (API)

`NODE_ENV=production`일 때 API는 기동 전 [`apps/api/src/bootstrap-production-env.ts`](../../apps/api/src/bootstrap-production-env.ts)에서 아래를 검증합니다. 실패 시 프로세스가 종료됩니다.

## 필수

| 변수 | 요구 |
|------|------|
| `JWT_SECRET` | 32자 이상 |
| `INTEGRATION_WEBHOOK_SESSION_ID` | UUID v4 형식 (시뮬 세션 ID). 개발용 기본값 `github-ingest`는 프로덕션에서 사용할 수 없습니다. |
| `API_CORS_ORIGINS` 또는 `CORS_ORIGINS` | 허용할 브라우저 Origin을 쉼표로 구분 (예: `https://app.example.com`) |

## GitHub 웹훅 사용 시 (기본 강제)

웹훅을 쓰지 않는 일시 배포만 예외로 두려면 `SKIP_PRODUCTION_WEBHOOK_ENFORCEMENT=1`을 설정합니다. **운영에서는 켜지 마세요.**

| 변수 | 요구 |
|------|------|
| `GITHUB_WEBHOOK_SECRET` | 16자 이상 |
| `GITHUB_WEBHOOK_REQUIRE_SIGNATURE` | `1` 또는 `true` |
| `WEBHOOK_ALLOWLIST` 또는 `WEBHOOK_ALLOWED_CIDRS` | GitHub 훅 전달 IP/CIDR (쉼표 구분). `docs/collaboration-env-and-endpoints.md` §3.2 참고 |

## TLS

HTTP만 노출하면 토큰이 평문으로 전송됩니다. [배포 문서의 HTTPS 절](../deploy-aws-ec2-free-tier.md#https-리버스-프록시-권장)을 따르세요.
