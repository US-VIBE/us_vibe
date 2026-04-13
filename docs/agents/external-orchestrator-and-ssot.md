# 외부 오케스트레이터(O-1) · 이벤트 단일 소스(O-3) — 구현 가이드

비전 백로그 [vision-product-backlog.md](../vision-product-backlog.md)의 **O-1**(LangGraph/Supervisor 등 실제 런타임)과 **O-3**(KPI·이벤트를 오케스트레이터가 읽는 단일 파이프)을 코드에 붙일 때의 **권장 접점**이다. Nest 앱을 대체하지 않고, 별 프로세스가 API·스트림을 소비한다.

## O-1 권장 연결면

1. **컨텍스트 스냅샷:** `GET /api/sessions/{sessionId}/orchestrator-context` (Bearer JWT) — 게이트·role-gap·정책 문서 경로. 구현: [session.controller.ts](../../apps/api/src/session/session.controller.ts).
2. **통합 이벤트:** `GET /api/integration/events` (폴링) 또는 `GET /api/integration/stream` (SSE), 선택적으로 Redis Pub/Sub 동일 페이로드.
3. **시뮬 세션:** 공개 Postgres 시나리오 API `GET/PATCH /sessions/{id}`, `POST /sessions/{id}/run-scenario` 등 — 오케스트레이터가 “사람 학습자” 역할을 자동화할 때 사용.
4. **실패·재시도:** 웹훅·큐 재전송과 중복 잡은 [d-integration-pipeline.md](../integration-sandbox/d-integration-pipeline.md) §4·§5를 전제로, 오케스트레이터 쪽은 **멱등 키**(세션 ID + 이벤트 타임스탬프/ID)로 중복 처리한다.

외부 프로세스 저장소 위치·배포는 팀 표준에 맡기되, 저장소 루트 `agents/orchestrator/README.md`와 이 문서를 PR에 링크하면 Gate G-3에 유리하다.

## O-3 단일 소스(현재 합의안)

| 데이터 | MVP 권장 SSOT | 소비자 |
|--------|----------------|--------|
| GitHub·검증·VFS·코드델타 이벤트 | SQLite `integration_events` (+ 워크스페이스 `ProjectState`) | 웹 연동 탭, 회고 `retro-kpi.util` |
| 시뮬 타임라인·게이트 B→C | Postgres `collaboration_events` / `simulation_sessions` | `/simulate`, 통합 뷰의 Postgres 줄기 |
| **병합 타임라인(사용자에게 한 줄)** | API `GET /api/integration/unified-timeline` — 서버가 두 소스를 합쳐 반환 | FE 병합 탭 |

Postgres를 이벤트의 **유일한** SSOT로 옮기는 작업은 [d-integration-pipeline.md](../integration-sandbox/d-integration-pipeline.md) §7 B 핸드오프와 별 티켓으로 진행한다. 오케스트레이터는 위 합의가 바뀔 때까지 **SQLite 스트림 + orchestrator-context**를 1차 입력으로 삼고, 시뮬 전용 단계는 Postgres API를 직접 호출한다.

## 관련 문서

- [agents/orchestrator/README.md](../../agents/orchestrator/README.md)
- [session-id-sync.md](../integration-sandbox/session-id-sync.md)
- [collaboration-env-and-endpoints.md](../collaboration-env-and-endpoints.md)
