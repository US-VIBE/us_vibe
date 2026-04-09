# FE Prompt

OpenAPI 계약을 기준으로 필요한 요청/응답/에러 케이스를 제안하고 불일치를 리포트한다.

공통 API 바인딩 템플릿을 우선 사용한다.
- `lib/api-client.ts`의 fetch/axios wrapper를 통해서만 API를 호출한다.
- 백엔드 주소는 환경변수(`NEXT_PUBLIC_API_BASE_URL`)를 사용한다.
