# 회고 KPI 근거·타임라인 인용 (스토리5)

## 목적

`retro-kpi.util`의 규칙 기반 점수뿐 아니라, **왜 그 점수인지**를 지표별 요약·최근 통합 이벤트 인용(`citations`)으로 보여준다.

## API (JWT)

- `GET /api/sessions/:sessionId/retro/kpi-preview?limit=400` — 저장 없이 KPI·근거·인용 미리보기
- `POST /api/sessions/:sessionId/retro/generate` — 리포트에 `kpiEvidence` 배열 포함 저장

## 코드

- 근거 생성: [`apps/api/src/session/retro-kpi.util.ts`](../../apps/api/src/session/retro-kpi.util.ts)
- 컨트롤러: [`apps/api/src/session/retro.controller.ts`](../../apps/api/src/session/retro.controller.ts)
- 타입·리포트: [`apps/web/lib/retro-types.ts`](../../apps/web/lib/retro-types.ts), [`retro-service.ts`](../../apps/web/lib/retro-service.ts)
- UI: [`workspace-app.tsx`](../../apps/web/components/workspace/workspace-app.tsx) 스토리5 (`<details>` 인용, 미리보기 버튼)

## 테스트

- 단위: [`apps/api/test/unit/retro-kpi.util.spec.ts`](../../apps/api/test/unit/retro-kpi.util.spec.ts)
