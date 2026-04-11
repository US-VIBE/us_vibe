# B(백엔드) 리뷰 요청: OpenAPI · 공유 타입

D 연동 작업으로 다음이 추가·변경되었을 수 있으니 **B가 SSOT 관점에서 검토**해 주세요.

- [specs/openapi/v1.yaml](../../specs/openapi/v1.yaml) — `POST /webhooks/github`, `GET /api/integration/events`, `GET /api/validation/status/{prNumber}`, VFS 3종 경로·스키마.
- [specs/api-contract.md](../../specs/api-contract.md) — 위 경로와 응답 래핑 정책 요약.
- [specs/data-model/types.ts](../../specs/data-model/types.ts) — `IntegrationEventType`에 `VALIDATION_LOOP_DETECTED` 등 D 이벤트 타입.

계약 변경이 확정되면 팀 핸드셰이크에 따라 FE/QA 영향도와 `[contract-changed]` 라벨을 맞춥니다.
