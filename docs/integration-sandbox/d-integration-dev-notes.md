# D · 인테그레이션 & 샌드박스 — 개발자 노트

> **파일**: `docs/integration-sandbox/d-integration-dev-notes.md`  
> **역할**: D (인테그레이션 & 샌드박스) — 한승준  
> 날짜별 구현 내용과 결정 사항을 기록합니다.  
> 새 작업 완료 시 최신 항목을 **맨 위에** 추가합니다.

---

## 2026-04-10 (3차)

### `docs/integration-sandbox/` 문서 패키지로 정리

- D(인테그레이션 & 샌드박스) 전용 문서를 `docs/integration-sandbox/` 하위로 이동
- [`README.md`](README.md)에 역할·문서 목록·관련 코드 경로 명시
- 코드·스펙 내 문서 경로 참조 일괄 갱신 (`collaboration-interface.md` 등)

---

## 2026-04-10

### 인테그레이션 & 샌드박스 역할(D) 초기 설계 완료

#### 완료된 작업

**1. 협업 인터페이스 문서 작성** — `docs/integration-sandbox/collaboration-interface.md`
- 팀 전체 공유용 이벤트 타입 9종 표준 정의
  - `PR_OPENED`, `PR_UPDATED`, `PR_MERGED`
  - `VALIDATION_PASSED`, `VALIDATION_FAILED`
  - `CODE_DELTA_ANALYZED`, `CONTRACT_CHANGED`
  - `VFS_SNAPSHOT_CREATED`, `VFS_APPROVED`
- D 소유 엔드포인트 5개 확정
  - `POST /webhooks/github` — GitHub Webhook 수신
  - `GET /api/validation/status/:prNumber` — 검증 상태 조회
  - `POST /api/vfs/snapshot` — AI 산출물 VFS 저장
  - `GET /api/vfs/diff/:snapshotId` — Diff 조회
  - `POST /api/vfs/approve/:snapshotId` — 학습자 승인
- 환경변수 소유 명시 (D/B/A 구분)
- A/B/C 팀원 각각과 맞춰야 할 인터페이스 규칙 정리

**2. 파이프라인 설계 문서 작성** — `docs/integration-sandbox/d-integration-pipeline.md`
- GitHub Webhook → 이벤트 라우팅 → 정적 검증 → VFS → Redis 이벤트 발행 전체 흐름 설계
- 7개 컴포넌트 책임 명세
  - Webhook Receiver, Event Router, Static Validation Pipeline, Result Aggregator, VFS Snapshot Creator, Failure Report Generator, Code Delta Analyzer
- 실패 처리 정책 확정 (재시도 횟수, 타임아웃, 루프 가드)
- Mermaid 아키텍처 다이어그램 포함
- MVP / V2 경계 명시

**3. 시나리오 문서 작성** — `docs/integration-sandbox/d-integration-scenarios.md`
- 시나리오 1: PR 제출 → 정적 검증 → Senior 리뷰 트리거 (Sequence Diagram 포함)
- 시나리오 2: OpenAPI 계약 변경 감지 → 영향 범위 리포트
- 시나리오 3: VFS Shadow Branch → 학습자 승인 → 실제 브랜치 반영
- 시나리오 4: 검증 실패 → QA 리포트 → 재작업 요청
- 각 시나리오별 Input / Output / 담당 에이전트 / 루프 가드 조건 명시

**4. CI 워크플로우 강화** — `.github/workflows/ci.yml`
- 기존: 단일 build job만 존재
- 개선: 5개 job으로 분리
  | Job | 역할 | PR merge 블록 여부 |
  |-----|------|:-----------------:|
  | `lint` | ESLint (api + web) | ✅ |
  | `typecheck` | tsc --noEmit (api + web) | ✅ |
  | `contract-validation` | OpenAPI 계약 검증 | ✅ |
  | `build` | 전체 빌드 (위 3개 통과 후) | ✅ |
  | `code-delta` | 코드 변경 분석 (push 전용) | 비블로킹 |
- PR 대상 브랜치: `develop`, `main`

**5. 검증 스크립트 강화**

- `scripts/validate-api-contract.js` — 4단계 검증으로 강화
  - 기존: 파일 존재 여부만 확인
  - 개선: 파일 존재 → YAML 파싱 → api-contract.md 엔드포인트 일치 → 응답 형식 정책 확인
  - 실행 결과: `node scripts/validate-api-contract.js` 통과 확인 ✅

- `scripts/code-delta-analyzer.js` — 신규 작성
  - git diff 기반 신규/수정/삭제 엔드포인트, DTO 변경, 위험 항목 추출
  - `.ai/code-delta-summary.json` 저장 → A(오케스트레이터)가 SSOT 갱신에 활용
  - 실행 결과: 정상 동작 확인 ✅

- `scripts/detect-contract-changes.js` — 신규 작성
  - PR 기준 `specs/openapi/` 변경 감지
  - `BASE_SHA..HEAD_SHA` diff로 ContractDiff 분석
  - GitHub Actions Step Summary에 영향 리포트 출력
  - `.ai/contract-change-report.json` 저장

**6. 공유 타입 추가** — `specs/data-model/types.ts`
- 기존 `User` 타입에 D 역할 인터페이스 타입 추가
  - `IntegrationEventType`, `IntegrationEvent`
  - `ValidationResult`, `LintError`, `ContractDiff`
  - `CodeDeltaSummary`, `IntegrationEventPayload`

**7. 기타 업데이트**
- `.ai/project-state.md` — `codeDeltaSummary`, `integrationGateStatus` 필드 추가
- `.github/PULL_REQUEST_TEMPLATE.md` — Role Scope Check 항목 및 Gate 체크리스트 추가
- `.gitignore` — 런타임 분석 결과 파일 및 `vfs-store/` 추가
- `docs/team-role-charter.md` — 팀 배정 수정: B(박준용), D(한승준)

#### 결정 사항

| 결정 | 이유 |
|------|------|
| VFS 승인 없이 자동 브랜치 반영 금지 | 학습자 코드 보호 최우선 (plan.md 32-4항) |
| 동적 E2E(Playwright) V2 이관 | MVP 8~10주 범위 내 과도한 복잡도 (plan.md R5) |
| 이벤트 발행 채널을 Redis `integration:events`로 통일 | A(오케스트레이터)와 단일 채널 계약 유지 |
| 검증 실패 시 PR merge 블록 + GitHub 코멘트 병행 | 학습자가 실패 원인을 PR에서 즉시 확인 가능 |
| `code-delta` job은 비블로킹 | 분석 실패가 배포 흐름을 막으면 안 됨 |

#### 다음 작업 (예정)

- [ ] `apps/api/src/integration/` — Webhook Controller, Validation Service, VFS Service 구현
- [ ] `apps/api/src/integration/report.service.ts` — GitHub PR 코멘트 자동 생성 구현
- [ ] Redis Pub/Sub 이벤트 발행 모듈 구현
- [ ] A(오케스트레이터, 김성원)와 Redis 채널 연동 테스트
- [ ] B(박준용)와 OpenAPI 경로 규칙 실 파일 기준 검증

---

## 2026-04-10 (2차)

### Integration 모듈 MVP 구현 — 단독 구현 가능 범위 완료

#### 완료된 작업

**1. 디렉토리 구조 생성** — `apps/api/src/integration/`

```
apps/api/src/integration/
├── integration.module.ts       NestJS 모듈 묶음
├── webhook.controller.ts       POST /webhooks/github
├── validation.service.ts       정적 검증 (ESLint + TS + Contract)
├── validation.controller.ts    GET /api/validation/status/:prNumber
├── vfs.service.ts              파일 기반 스냅샷 저장/조회/승인
├── vfs.controller.ts           POST|GET /api/vfs/*
├── report.service.ts           GitHub PR 코멘트 자동 생성
├── event-publisher.interface.ts IEventPublisher 인터페이스
└── event-publisher.stub.ts     Redis 연동 전용 콘솔 출력 stub
```

**2. EventPublisher 인터페이스 + Stub** — `event-publisher.interface.ts`, `event-publisher.stub.ts`
- `IEventPublisher.publish(event)` 인터페이스 확정
- Redis 연동 전까지 콘솔 로그 출력으로 대체
- 교체 방법: `integration.module.ts`에서 `useClass: EventPublisherStub` → `useClass: RedisEventPublisher` 한 줄 수정으로 완료

**3. ValidationService** — `validation.service.ts`
- `runAll(prNumber, commitSha)` — ESLint/TS/Contract 병렬 실행 후 `ValidationResult` 반환
- `runLint()` — `execSync('npm run lint -w api')` 실행 + 오류 파싱
- `runTypecheck()` — `tsc --noEmit` 실행
- `validateContract()` — OpenAPI YAML 파싱 + api-contract.md 엔드포인트 일치 검사

**4. WebhookController** — `webhook.controller.ts`
- `POST /webhooks/github` — HMAC-SHA256 서명 검증 (`timingSafeEqual` 사용)
- `GITHUB_WEBHOOK_SECRET` 없으면 경고 로그 + 검증 스킵 (개발 환경 배려)
- PR_OPENED / PR_UPDATED → 정적 검증 실행 → VALIDATION_PASSED/FAILED 이벤트 발행
- push → CODE_DELTA_ANALYZED 이벤트 발행

**5. VfsService + VfsController** — `vfs.service.ts`, `vfs.controller.ts`
- `POST /api/vfs/snapshot` — AI 산출물 스냅샷 저장, `snapshotId` 발급
- `GET /api/vfs/diff/:snapshotId` — 파일별 변경 내용 + 라인 수 반환
- `POST /api/vfs/approve/:snapshotId` — 학습자 승인 → `VFS_APPROVED` 이벤트 발행
- 스토리지: `VFS_STORAGE_PATH` 환경변수 경로의 로컬 JSON 파일

**6. ReportService** — `report.service.ts`
- `postPrComment()` — Node 내장 `fetch` 사용, 3회 재시도 (지수 백오프)
- `buildValidationFailReport()` — 실패 항목 마크다운 테이블 + 파일:라인 상세 목록 생성
- `buildContractChangeReport()` — 계약 변경 영향 범위 마크다운 생성
- `GITHUB_TOKEN` 없으면 경고 로그 + 코멘트 스킵

**7. 모듈 조립 및 앱 등록**
- `integration.module.ts` — 컨트롤러/서비스 묶음, `EVENT_PUBLISHER` DI 토큰 주입
- `app.module.ts` — `ConfigModule.forRoot()` + `IntegrationModule` 추가
- `main.ts` — `rawBody: true` 활성화 (Webhook HMAC 서명 검증 필수), `API_PORT` 환경변수 지원

**8. 패키지 추가**
- `@nestjs/config` — 환경변수 주입
- `@types/express` — rawBody 타입 지원
- `apps/api/eslint.config.js` — ESLint v9 flat config 마이그레이션 (`.eslintrc.cjs` 대체)

**9. 환경변수 예시 파일** — `.env.example`
- D/B/A 소유 변수 주석으로 구분
- `GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN`, `VFS_STORAGE_PATH` 등

#### 빌드/린트 결과

| 검사 | 결과 |
|------|------|
| `npm run build -w api` | ✅ 통과 |
| `npm run lint -w api` | ✅ 통과 |

#### 결정 사항

| 결정 | 이유 |
|------|------|
| VfsService는 파일 기반으로 구현 | DB 없이 독립 실행 가능, B와 연동 후 내부만 교체 |
| EventPublisher를 DI 인터페이스로 분리 | Redis stub → 실제 구현 교체 시 모듈 한 줄 변경으로 완료 |
| `rawBody: true` 활성화 | GitHub HMAC 서명 검증에 원본 바이트 필요 |
| ESLint v9 flat config 마이그레이션 | `.eslintrc.cjs`는 v9에서 자동 인식 안 됨 |
| `fetch` 사용 (외부 패키지 없음) | Node 18+에서 내장 지원, 의존성 최소화 |

#### 다음 작업 (TODO stub — 협업 후 처리)

- [ ] `EventPublisherStub` → `RedisEventPublisher` 교체 (A·김성원과 Redis 채널 연동 후)
- [ ] `VfsService` 파일 저장 → DB 저장 교체 (`DATABASE_URL` 확정 후 B·박준용과 협의)
- [ ] `sessionId`, `stateVersion` 실제 값 주입 (A의 `GET /api/session/:sessionId/state-version` 연동 후)
- [ ] VFS 승인 후 실 Git 브랜치 반영 (Shadow Branch → feature 브랜치 PR 생성)
- [ ] B·박준용과 OpenAPI 경로 규칙 실 파일 기준 검증

---

<!-- 새 항목은 이 구분선 위에 추가 -->
