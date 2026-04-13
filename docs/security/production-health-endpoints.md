# 프로덕션 헬스·웹훅 노출 제한

## 목적

`GET /health/webhook-security`는 공격면 분석에 유용한 요약(서명 모드, 시크릿 설정 여부, allowlist 규칙 수 등)을 노출한다. **프로덕션에서는 기본 비활성화(404)**하고, 운영 스모크가 필요할 때만 켠다.

## 환경 변수

| 변수 | 값 | 설명 |
|------|-----|------|
| `EXPOSE_WEBHOOK_SECURITY_HEALTH` | `1` / `true` | `NODE_ENV=production`일 때 해당 경로가 200을 반환하도록 허용 |

## 코드 위치

- `apps/api/src/app.controller.ts` (`getHealthWebhookSecurity`)

배포 예시 변수: `deploy/env.deploy.example`, API 예시: `apps/api/.env.example`. 운영 절차 문구: `docs/collaboration-env-and-endpoints.md`, `docs/api/production-environment.md`.
