# US Vibe MVP Plan

## Product Goal
- 백엔드 1인 학습자가 PM/FE/Senior/QA 역할과 실제 협업 루프를 경험하도록 지원한다.
- 자동 코드 생성보다 역할 분담, 리뷰, 재작업, 의사결정 훈련을 우선한다.

## MVP Scope
- 채팅 기반 협업 플로우
- 역할 결손 탐지(PM/FE/Senior 주입)
- Prompt-to-Spec(자연어 -> 수용기준)
- API 계약(OpenAPI) 기반 검증
- PR 리뷰 시뮬레이션과 회고 리포트

## Out of Scope (V2)
- 음성 회의
- 완전 자동 로컬 파일 동기화
- 동적 E2E 브라우저 테스트

## Sprint 1 Deliverables
- 모노레포 구조: `apps/web` + `apps/api`
- `docs/` 운영 문서 세트
- 최소 상태 모델(SSOT)과 체크포인트 정책

## Success Criteria
- 백엔드 학습자 1인이 요구사항 -> 계약 -> 구현 -> 리뷰 -> 회고 루프를 1회 완료
- 핵심 이벤트 로그 누락 0건
