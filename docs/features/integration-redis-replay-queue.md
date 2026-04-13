# Redis Pub/Sub 실패 → BullMQ 재발행 (`integration-redis-replay`)

## 목적

통합 이벤트를 SQLite에 기록한 뒤 **선택적** Redis Pub/Sub(`INTEGRATION_REDIS_PUBLISHER`)로 브로드캐스트한다. 동기 `publish` 재시도까지 실패하면, 설정 시 **BullMQ 큐**로 비동기 재시도한다.

## 환경 변수

- `INTEGRATION_BULLMQ=1`, `REDIS_URL`
- `INTEGRATION_REDIS_REPLAY_QUEUE=1` — 큐 적재·워커 기동
- `BULLMQ_PROCESS_ROLE=worker` + `npm run start:bullmq-worker` — `integration-pr-validate`와 **같은 프로세스**에서 이 큐 Worker도 소비

## 동작 특성 (at-least-once)

직접 `publish` 성공 후 큐 잡이 지연 실행되면 구독자에게 **동일 페이로드가 두 번** 보일 수 있다. SSE·소비 측에서는 `sessionId`+`timestamp`+`type`+`stateVersion` 등으로 **멱등** 처리하는 것을 권장한다.

## 관측

`GET /api/validation/queue-status` 응답에 `redisReplayQueue` 객체(`queueName`, `enqueueEnabled`, `metrics`)가 포함된다.

## 코드

- 큐·워커: [`integration-redis-replay-queue.service.ts`](../../apps/api/src/integration/integration-redis-replay-queue.service.ts)
- Pub/Sub 성공 여부: [`integration-redis-pubsub.service.ts`](../../apps/api/src/integration/integration-redis-pubsub.service.ts) (`publishResolved` → `boolean`)
- 적재: [`event-publisher.sqlite.ts`](../../apps/api/src/integration/event-publisher.sqlite.ts)
- 메트릭 병합: [`validation.controller.ts`](../../apps/api/src/integration/validation.controller.ts)
