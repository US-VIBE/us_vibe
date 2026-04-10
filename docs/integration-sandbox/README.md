# Integration & Sandbox (역할 D) 문서

이 디렉터리는 팀 역할 **D · 인테그레이션 & 샌드박스** 담당 문서만 모아 둡니다.  
전체 팀 규칙은 [`../team-role-charter.md`](../team-role-charter.md)를 참고하세요.

## 문서 목록

| 문서 | 설명 |
|------|------|
| [`collaboration-interface.md`](collaboration-interface.md) | A/B/C와 맞출 이벤트·엔드포인트·환경변수·공유 타입 |
| [`d-integration-pipeline.md`](d-integration-pipeline.md) | Webhook → 검증 → VFS → 이벤트 파이프라인 설계 |
| [`d-integration-scenarios.md`](d-integration-scenarios.md) | PR 검증, 계약 변경, VFS, 실패 처리 시나리오 |
| [`d-integration-dev-notes.md`](d-integration-dev-notes.md) | 날짜별 구현·결정 로그 (개발자 노트) |

## 관련 코드·스크립트 (레포 기준)

- `apps/api/src/integration/` — NestJS 통합 모듈
- `scripts/validate-api-contract.js`, `code-delta-analyzer.js`, `detect-contract-changes.js`
- `.github/workflows/ci.yml`
