# Orchestrator (O-1 · O-2 · O-3)

런타임 오케스트레이션과 에이전트 정책의 **문서 단일 기준**이다. Nest `SessionController`·`ContractGateController` 등 REST 게이트와 `agents/*` 정책을 같은 흐름으로 읽는다.

## O-1 세션 오케스트레이션

- 시뮬 세션 상태 전이는 `apps/api/src/sessions/sessions.service.ts` 및 `scenario-runner.service.ts`가 담당한다.
- 워크스페이스(스토리) 쪽 게이트는 `api/sessions/:sessionId/*` 아래 컨트롤러와 SQLite `WorkspacePersistenceService`가 SSOT다.
- 라우팅·감독 규칙의 정적 기준: `routing-rules.md`, `supervisor-policy.md`, `role-gap-detector-policy.md`.

## O-2 에이전트 정책 버전

- 역할별 `*-policy.md` / `*-prompt.md`를 Git으로 버전 관리한다. 런타임에서 하드코딩한 프롬프트를 추가하지 않고, 이 디렉터리를 우선 참조한다.
- 상위 계약: 루트 `agents/README.md`, `docs/project-contract.md`.

## O-3 회고 KPI와 이벤트 로그

- API가 산출하는 회고 KPI는 `apps/api/src/session/retro-kpi.util.ts`의 `computeRetroKpisFromEvents` / `buildKpiBasisSummary`와 SQLite `integration_events` 스트림을 기준으로 한다.
- `RetroController` 생성 리포트의 `kpiBasis` 필드는 위 유틸과 동일 근거를 한 줄로 요약한다(F-6).

## REST 집계 (O-1 브리지)

- `GET /api/sessions/{sessionId}/orchestrator-context` — `role-gap`, `workspace-gates`, 에이전트 정책·REST 문서 경로錨을 한 응답으로 묶어 외부 오케스트레이터·도구가 읽기 쉽게 한다.
- 외부 런타임 연결·O-3 SSOT 합의(폴링/SSE·SQLite vs Postgres): [`docs/agents/external-orchestrator-and-ssot.md`](../../docs/agents/external-orchestrator-and-ssot.md)

## 관련 구현 경로

| 관심사 | 코드 |
|--------|------|
| 통합 이벤트 발행·SQLite | `apps/api/src/integration/event-publisher.sqlite.ts` |
| Postgres 타임라인 미러 | `apps/api/src/integration/integration-timeline-bridge.service.ts` |
| 코드 델타 → ProjectState | `WorkspacePersistenceService.patchProjectStateCodeDelta` |
