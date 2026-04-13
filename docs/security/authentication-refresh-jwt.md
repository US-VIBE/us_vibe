# 인증: 액세스 JWT 단축 및 HttpOnly 리프레시

## 목적

- 액세스 토큰 노출 창을 줄이기 위해 **짧은 만료(15분)**.
- 리프레시는 **HttpOnly·Secure(프로덕션)·SameSite** 쿠키로 전달하고, 회전(rotate) 시 이전 `jti`를 Redis 거부 목록에 넣는다(설정 시).

## 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/register`, `/api/auth/login` | 응답 본문에 `accessToken`·`user`; 리프레시는 쿠키로 설정 |
| POST | `/api/auth/refresh` | 쿠키 기반 재발급·리프레시 회전 |
| POST | `/api/auth/logout` | Bearer 액세스 폐기 + 리프레시 쿠키 삭제·폐기 |
| POST | `/auth/*` | 레거시 표면과 동일한 토큰·쿠키 정책(본문에 `refreshToken` 포함) |

## 코드 위치

- `apps/api/src/auth/auth.service.ts`, `auth.module.ts`, `jwt-auth.guard.ts`, `auth.types.ts`
- `apps/api/src/auth/api-auth.controller.ts`, `auth.controller.ts`
- `apps/api/src/auth/refresh-cookie.util.ts`, `apps/api/src/auth/dto/auth-credentials.dto.ts`
- `apps/web/lib/auth-api.ts` (`refreshAuthSession`), `apps/web/lib/api-fetch.ts` (401 시 1회 리프레시)

## 환경 변수

`REFRESH_COOKIE_SAMESITE`: API와 웹이 다른 사이트일 때 `none`과 HTTPS 조합 등. 자세한 표는 `docs/backend/users-auth.md`, `docs/api/production-environment.md` 참고.
