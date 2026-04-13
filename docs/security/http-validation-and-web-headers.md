# HTTP 하드닝 및 입력 검증

## API (Nest)

- **Helmet**: 비프로덕션에서는 CSP 등을 완화한 프로필, 프로덕션에서는 기본 Helmet.
- **ValidationPipe**: 전역 `whitelist`·`transform` (엄격한 `forbidNonWhitelisted`는 사용하지 않아 기존 바디 호환 유지).
- **class-validator**: 로그인·회원가입 등 DTO가 붙은 엔드포인트에서 이메일·비밀번호 길이 검증.

코드: `apps/api/src/main.ts`, `apps/api/package.json` (`class-validator`, `class-transformer`).

## 웹 (Next)

`apps/web/next.config.mjs`의 `headers()`로 다음 응답 헤더를 전 경로에 적용한다.

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: 카메라·마이크·지리 위치 비활성

## 계약

OpenAPI·`specs/api-contract.md`는 동일 PR에서 보안 관련 경로·응답을 반영한다.
