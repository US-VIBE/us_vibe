# 기능 단위 문서 (연동 · 회고 · 관측)

P1/P2 후속 보완을 포함한 **워크스페이스 연동·멀티테넌시·타임라인·회고 KPI·Redis 재발행** 구현을 기능별로 정리한다.  
환경 변수·엔드포인트 표는 [collaboration-env-and-endpoints.md](../collaboration-env-and-endpoints.md)와 [integration-sandbox/d-integration-api-extras.md](../integration-sandbox/d-integration-api-extras.md)를 함께 본다.

| 문서 | 범위 |
|------|------|
| [integration-unified-timeline.md](integration-unified-timeline.md) | 통합 타임라인 API·필터·UI |
| [integration-github-webhook-routing.md](integration-github-webhook-routing.md) | 저장소→세션 라우팅·웹훅 감사 힌트 |
| [integration-redis-replay-queue.md](integration-redis-replay-queue.md) | Pub/Sub 실패 시 BullMQ 재발행·큐 관측 |
| [session-retro-kpi-evidence.md](session-retro-kpi-evidence.md) | 회고 KPI 근거·미리보기·UI |

프로덕션 부트스트랩·JWT·CORS·웹훅 강제는 [api/production-environment.md](../api/production-environment.md)를 참고한다.
