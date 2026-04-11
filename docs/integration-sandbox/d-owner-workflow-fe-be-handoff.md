# D 주도 구현 + FE/BE 문서 맞춤 (운영 가이드)

역할 **D · 인테그레이션 & 샌드박스**가 파이프라인을 구현할 때, **문서를 단일 기준(SSOT)** 으로 유지하고 B/C가 같은 기준으로 맞추게 한다.

---

## 역할 정리

- **D**: 웹훅·Redis·검증 파이프라인·이벤트 발행·운영 env를 **구현하고 문서에 먼저(또는 동시에) 반영**한다. 절차 상세는 [design-living-revisions.md](../design-living-revisions.md).
- **B/C**: D가 적어 둔 **엔드포인트·환경 변수·타임아웃·비동기 동작**에 맞춘다. **OpenAPI·`api-contract.md` 변경은 B 주도**이며, PR에 **`[contract-changed]`**·[checklist.md](../checklist.md) 규칙을 따른다.

협의가 필요하면 회의 전에 **문서 diff로 고정**한 뒤, B/C에는 “아래 문서 섹션 기준으로 맞춰 달라”고 전달한다.

---

## FE/BE 전달용 문서 (이미 있는 채널)

| 문서 | 용도 |
|------|------|
| [handoff-fe-be-collaboration-recommendations.md](../handoff-fe-be-collaboration-recommendations.md) | FE/BE 권장 사양·티켓 후보 (F-1 …) |
| [fe-web-integration.md](../fe-web-integration.md) | FE가 붙는 API·SSE·환경 요약 |
| [collaboration-env-and-endpoints.md](../collaboration-env-and-endpoints.md) | 변수명·포트·§3.1 웹훅 sessionId |
| [d-integration-pipeline.md](d-integration-pipeline.md) | Webhook → 검증 → 이벤트·실패 정책 |
| (아래) **BE 협의 메모** | 새 HTTP/바디/에러가 생기면 B에게 넘길 때 한 블록으로 요약 |

---

## D가 구현할 때마다 할 일 (문서 동기 체크리스트)

백로그 **P-1 / P-2 / S-2** 등 파이프라인·웹훅·Redis 동작을 바꿀 때 **같은 PR에서** 가능한 한 함께 갱신한다.

1. **[apps/api/.env.example](../../apps/api/.env.example)** — 새 변수·기본값·주석.
2. **[collaboration-env-and-endpoints.md](../collaboration-env-and-endpoints.md)** — `apps/api`·루트 env 표에 반영.
3. **[d-integration-pipeline.md](d-integration-pipeline.md)** — 실패 처리·타임아웃·큐·Redis 정책 절.
4. **[fe-web-integration.md](../fe-web-integration.md)** — FE가 알아야 할 응답·폴링·SSE·에러 UX가 바뀐 경우만.
5. **[vision-product-backlog.md](../vision-product-backlog.md)** — 해당 P/S/F ID 행에 “문서·코드 반영됨(날짜)” 한 줄 또는 스프린트 말 갱신.

**OpenAPI·스키마가 새로 필요하면** D는 위 문서에 “요청 사항”만 적고, **B가 계약 PR**을 연다 (D가 임의로 계약 파일만 대량 수정하지 않는다 — [team-role-charter.md](../team-role-charter.md)).

---

## BE 협의 메모 (복붙용)

PR 본문이나 티켓에 아래 블록을 붙여 B에게 넘긴다.

```text
[BE 협의 / D → B]
- 기준 문서: docs/integration-sandbox/d-integration-pipeline.md (§ …)
- 코드: apps/api/src/integration/ …
- 요청: (새 경로/쿼리/응답 필드/에러 코드가 있으면 나열)
- 계약: OpenAPI·api-contract.md 반영 필요 시 B 주도 + PR 라벨 [contract-changed]
```

---

## FE/BE에 보낼 때 한 줄 템플릿

슬랙·PR 코멘트용.

```text
기준 문서: docs/… (§ 또는 표 이름). 변경점: … . 계약 필요 시 B가 OpenAPI 반영 후 [contract-changed].
```

예:

```text
기준 문서: docs/integration-sandbox/d-integration-pipeline.md §4. 변경점: Redis 발행 실패 시 N회 재시도·백오프. FE 동작 변화 없음.
```

---

## 주의 ([team-role-charter.md](../team-role-charter.md))

- D는 **제품 우선순위·범위를 임의로 바꾸지 않는다.** 비전·에픽 순서는 A/팀 합의.
- D는 **인테그·파이프라인·문서 SSOT**에 집중한다.
