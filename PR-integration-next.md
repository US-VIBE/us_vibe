# PR: 연동·워크스페이스 구체화 (`feature/hanseungjun-d-integration-next` → `develop`)

## Summary

### What changed?

- **운영·환경 문서**: `INTEGRATION_WEBHOOK_SESSION_ID` 권장 기본값·예외(로컬/데모/CI/스테이징)를 [`docs/collaboration-env-and-endpoints.md`](docs/collaboration-env-and-endpoints.md) §3.1 등에 고정하고, [`apps/api/.env.example`](apps/api/.env.example)·[`docs/integration-sandbox/event-vocabulary-map.md`](docs/integration-sandbox/event-vocabulary-map.md)와 연결.
- **계약·스펙**: `GET /api/integration/unified-timeline` 응답의 `postgresTimeline` 항목을 OpenAPI [`CollaborationEventTimelineItem`](specs/openapi/v1.yaml)로 명시하고 [`specs/api-contract.md`](specs/api-contract.md)에 정렬·스키마 설명 보강.
- **동기화 플로우**: [`docs/integration-sandbox/session-id-sync.md`](docs/integration-sandbox/session-id-sync.md) 신규, 샌드박스 README 링크.
- **FE·웹 계약 문서**: [`docs/fe-web-integration.md`](docs/fe-web-integration.md)에 Redis Pub/Sub·SSE 페이로드 표, 통합 타임라인 UI( SQLite / Postgres 탭 ), `workspace-dod-verify` vs `POST /sessions/:id/verify` 관계 표기.
- **웹 구현**: [`integration-tools-panel`](apps/web/components/workspace/integration-tools-panel.tsx)에서 통합 타임라인 탭, `activeSprintGoal` PATCH·`VERSION_CONFLICT` 처리; [`workspace-collab-api`](apps/web/lib/workspace-collab-api.ts)·[`unified-timeline-api`](apps/web/lib/unified-timeline-api.ts) 보강.
- **프로세스**: [`docs/checklist.md`](docs/checklist.md) Gate B·GitHub PR·`[contract-changed]` 섹션, [`docs/team-role-charter.md`](docs/team-role-charter.md) B 역할 한 줄.

### Why does it matter?

- 시뮬·웹훅·워크스페이스가 **같은 session 식별자**를 쓰는지 문서와 UI 계약이 맞아야 데모·디버깅·학습 시나리오가 끊기지 않습니다.
- Redis/SSE·unified-timeline **스키마와 UI 결정**이 명시되어 A/C가 소비할 때 불일치·재협상 비용이 줄어듭니다.
- **OpenAPI와 api-contract 동시 갱신**으로 계약 단일성을 유지하고, Gate·라벨 규칙으로 리뷰 트리거가 분명해집니다.

---

## Role Scope Check

<!-- [`docs/team-role-charter.md`](docs/team-role-charter.md) 기준 역할 침범 여부 확인 -->

- [ ] 내 역할 범위(Deliverable Ownership) 내 변경만 포함
- [ ] Out of Scope 항목은 제안 형태로만 포함 (직접 변경 없음)

**참고 (리뷰어용):** 본 PR은 문서·OpenAPI·Next.js 클라이언트가 함께 들어갑니다. 작성자는 본인이 **D / B / C 중 어떤 범위를 직접 소유했는지**에 맞춰 위 항목을 체크하고, 타 역할 영역은 합의·리뷰 근거를 PR 스레드에 남겨 주세요.

---

## Checklist

- [x] API 계약 변경 시 `specs/openapi/v*.yaml` 및 `specs/api-contract.md` 동시 갱신
- [ ] API 계약 변경 시 PR에 `[contract-changed]` 라벨 추가 (B 담당)
- [x] 관련 Gate 체크리스트(`docs/checklist.md`) 상태 업데이트
- [ ] CI (lint / typecheck / contract-validation / build) 통과 확인

**로컬에서 확인한 항목 (PR 작성 시점):** `node scripts/validate-api-contract.js`, `npm run lint -w web` 통과. 전체 CI는 머지 전 파이프라인에서 재확인해 주세요.

---

## Related Gate

<!-- 해당하는 항목 체크 -->

- [ ] Gate A: 요구사항 변경
- [x] Gate B: API 계약 변경 (`specs/openapi/v1.yaml`, `specs/api-contract.md`)
- [x] Gate C: 구현/리뷰 (웹 패널·API 클라이언트)
- [ ] Gate D: 회고/평가

---

## 커밋 요약 (기능별)

| 커밋 메시지 요약 | 주요 경로 |
|------------------|-----------|
| `docs(api): INTEGRATION_WEBHOOK_SESSION_ID…` | `collaboration-env-and-endpoints`, `event-vocabulary-map`, `apps/api/.env.example` |
| `specs: unified-timeline postgresTimeline…` | `specs/openapi/v1.yaml`, `specs/api-contract.md` |
| `docs: 워크스페이스 sessionId와 시뮬·웹훅…` | `session-id-sync.md`, `integration-sandbox/README` |
| `docs(web): fe-web-integration에 SSE·타임라인·DoD…` | `docs/fe-web-integration.md` |
| `feat(web): 통합 타임라인 탭·ProjectState PATCH UI` | `integration-tools-panel`, `unified-timeline-api`, `workspace-collab-api` |
| `docs(process): Gate B/C·[contract-changed]…` | `docs/checklist.md`, `docs/team-role-charter.md` |
| `chore: PR 본문 마크다운…` | `PR-integration-next.md` |
