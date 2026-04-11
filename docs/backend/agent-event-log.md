# Collaboration and agent event log

협업·인증 전체 엔드포인트·환경 변수 요약: [`docs/api/collaboration-endpoints-and-env.md`](../api/collaboration-endpoints-and-env.md).

## Purpose

`POST /collaboration/events` appends an **append-only** row to `collaboration_events` for observability of the multi-agent loop (supervisor routing, agent replies, contract checks, and user-visible turns).

## Storage

- Table: `collaboration_events` (see migration `CreateCollaborationEvents1739120600000`).
- Columns map to [`CollaborationEvent`](../../src/backend/src/entities/collaboration-event.entity.ts).

## HTTP

| Method | Path | Notes |
|--------|------|--------|
| POST | `/collaboration/events` | 201, body `{ eventType, payload?, sessionId? }`, returns `{ id, createdAt }`. |

OpenAPI: [`specs/openapi/v1.yaml`](../../specs/openapi/v1.yaml).

## Event vocabulary (orchestrator handshake)

These `eventType` values are reserved for cross-team alignment (extend only with A approval):

| eventType | When to emit |
|-----------|----------------|
| `supervisor_route` | Supervisor chose target agent(s) and rationale summary. |
| `agent_reply` | An agent produced a user-visible or tool-visible response chunk. |
| `contract_violation` | Output conflicts with OpenAPI, data model, or SSOT. |
| `user_message` | End-user or learner message entered the session. |
| `kickoff_complete` | PM kickoff finished; Gate A scope recorded (optional). |
| `review_passed` | Senior/QA review passed toward Gate C/D (optional). |
| `review_failed` | Review requested changes (optional). |
| `retro_complete` | Retrospective / Gate D wrap-up (optional). |
| `implementation_acknowledged` | Learner called `POST /sessions/:id/implementation-ready` at gate **B**; DB `implementationAcknowledgedAt` set (required before `verify` unless demo skip). |

Unknown `eventType` strings are still accepted; the table is intentionally permissive so experiments are not blocked, but analytics should prefer the vocabulary above.

D 통합 스트림(`IntegrationEventType`)에서 이 테이블로 미러링할 때의 매핑은 [`docs/integration-sandbox/event-vocabulary-map.md`](../integration-sandbox/event-vocabulary-map.md)를 본다.

## Failure policy

The API returns **400** with `{ code, message }` when `eventType` is empty. Database failures bubble as **500**; clients that must not lose events should retry with an idempotency key in `payload` (future enhancement).
