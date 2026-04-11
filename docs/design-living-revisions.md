# 살아 있는 설계 역반영 (Living design)

구현·운영·파일럿에서 나온 **새 제약·엣지케이스·역할 합의 변경**은 코드만 수정하지 않고, **근거 문서를 먼저(또는 동시에)** 갱신한다.

## 언제 문서를 고칠까

- 세션 ID·웹훅·게이트 정의가 바뀌었다.
- 오케스트레이터 턴 순서·에이전트 정책이 바뀌었다.
- API 계약·에러 코드·FE 버튼 조건이 맞춰졌다.
- 통합 파이프라인(타임아웃·큐·Redis) 동작이 바뀌었다.

## 어디를 고칠까 (우선순위)

1. **제품·AI 비전** — [ai_협업_에이전트_설계_10198352.plan.md](ai_협업_에이전트_설계_10198352.plan.md) 해당 절.
2. **연동·FE** — [fe-web-integration.md](fe-web-integration.md), [session-id-sync.md](integration-sandbox/session-id-sync.md).
3. **인테그레이션** — [d-integration-pipeline.md](integration-sandbox/d-integration-pipeline.md), [event-vocabulary-map.md](integration-sandbox/event-vocabulary-map.md).
4. **계약** — `specs/openapi/v1.yaml`, [api-contract.md](../specs/api-contract.md) (변경 시 [checklist.md](checklist.md)·`[contract-changed]`).
5. **백로그 스냅샷** — [vision-product-backlog.md](vision-product-backlog.md)에서 해당 ID 행 갱신 또는 새 ID 추가.

## 주기 제안

- **스프린트 말**: 위 5중 이번 스프린트에 건드린 문서 목록을 PR 설명에 명시.
- **분기**: [vision-product-backlog.md](vision-product-backlog.md) 전체를 비전 문서와 대조해 재우선순위화.

## Gate와의 정렬

문서 변경이 요구사항·계약에 영향을 주면 [checklist.md](checklist.md)의 Gate A/B에 맞춰 체크리스트를 업데이트한다.
