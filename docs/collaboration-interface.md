# 협업 인터페이스 정의 (D. 인테그레이션 & 샌드박스)

> 이 문서는 D 역할(인테그레이션 & 샌드박스)이 A(오케스트레이터), B(백엔드), C(프론트엔드)와 협업할 때 반드시 맞춰야 하는 이벤트 타입, 엔드포인트, 환경변수, 공유 타입을 정의합니다.
>
> **변경 규칙**: 이 문서의 내용을 변경하려면 `docs/team-role-charter.md`의 Cross-Team Handshake Rules 절차를 따릅니다.

---

## 1. 이벤트 타입 표준

모든 팀원(A/B/C/D)이 동일한 이벤트 타입 문자열을 사용합니다.

```typescript
// 위치: specs/data-model/types.ts 에 함께 정의
type IntegrationEventType =
  | 'PR_OPENED'             // GitHub PR 생성
  | 'PR_UPDATED'            // GitHub PR 커밋 추가/수정
  | 'PR_MERGED'             // GitHub PR 머지 완료
  | 'VALIDATION_PASSED'     // 정적 검증(Lint+TS+Contract) 전체 통과
  | 'VALIDATION_FAILED'     // 정적 검증 1개 이상 실패
  | 'CODE_DELTA_ANALYZED'   // 코드 변경 분석 완료 (SSOT codeDeltaSummary 갱신)
  | 'CONTRACT_CHANGED'      // OpenAPI 스펙 변경 감지
  | 'VFS_SNAPSHOT_CREATED'  // AI 산출물 VFS 스냅샷 저장 완료
  | 'VFS_APPROVED'          // 학습자가 VFS 스냅샷 승인 → 실제 브랜치 반영 준비
```

---

## 2. 이벤트 공통 페이로드 스키마

D가 발행하는 모든 이벤트는 아래 구조를 따릅니다. A(오케스트레이터)가 이 구조를 기준으로 수신합니다.

```typescript
// 위치: specs/data-model/types.ts
type IntegrationEvent = {
  type: IntegrationEventType;
  sessionId: string;          // 현재 학습 세션 ID (A가 생성, D가 참조)
  stateVersion: number;       // 이벤트 발행 시점의 SSOT stateVersion
  triggeredBy: 'github' | 'user' | 'agent';
  payload: IntegrationEventPayload;
  timestamp: string;          // ISO 8601
}

type ValidationResult = {
  passed: boolean;
  checks: {
    lint: { passed: boolean; errors: LintError[] };
    typecheck: { passed: boolean; errors: string[] };
    contract: { passed: boolean; diffs: ContractDiff[] };
  };
  prNumber: number;
  commitSha: string;
}

type ContractDiff = {
  path: string;              // 변경된 엔드포인트 경로 (예: "/auth/login")
  method: string;            // HTTP 메서드
  changeType: 'added' | 'removed' | 'modified';
  affectedFields: string[];  // 변경된 필드명 목록
  impactedConsumers: string[]; // 영향받는 FE 컴포넌트/QA 테스트 목록
}

type LintError = {
  file: string;
  line: number;
  rule: string;
  message: string;
}

type IntegrationEventPayload =
  | { prNumber: number; branch: string; author: string }                     // PR_OPENED / PR_UPDATED / PR_MERGED
  | { validationResult: ValidationResult }                                   // VALIDATION_PASSED / VALIDATION_FAILED
  | { codeDeltaSummary: CodeDeltaSummary }                                   // CODE_DELTA_ANALYZED
  | { contractDiffs: ContractDiff[]; openApiVersion: string }                // CONTRACT_CHANGED
  | { snapshotId: string; vfsBranch: string; diffUrl: string }              // VFS_SNAPSHOT_CREATED
  | { snapshotId: string; targetBranch: string }                             // VFS_APPROVED

type CodeDeltaSummary = {
  newEndpoints: string[];
  modifiedEndpoints: string[];
  removedEndpoints: string[];
  dtoChanges: string[];
  riskItems: string[];       // Senior Agent가 검토해야 할 항목
}
```

---

## 3. D 소유 엔드포인트

아래 엔드포인트는 D가 `apps/api` 내에 구현합니다. B(백엔드 Core)와 경로 충돌이 없도록 `/webhooks`, `/api/vfs`, `/api/validation` 네임스페이스를 D가 소유합니다.

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| `POST` | `/webhooks/github` | GitHub Webhook 수신 (HMAC-SHA256 서명 검증) | `X-Hub-Signature-256` |
| `GET` | `/api/validation/status/:prNumber` | PR 번호 기준 최신 검증 결과 조회 | 세션 토큰 |
| `POST` | `/api/vfs/snapshot` | AI 산출물 VFS 스냅샷 저장 | 세션 토큰 |
| `GET` | `/api/vfs/diff/:snapshotId` | 스냅샷 ID 기준 변경 Diff 조회 | 세션 토큰 |
| `POST` | `/api/vfs/approve/:snapshotId` | 학습자 승인 → 실제 브랜치 반영 준비 | 세션 토큰 |

### 응답 형식 (B의 에러 포맷 규칙과 동일하게 맞춤)

```typescript
// 성공
{ ok: true; data: T }

// 실패
{ ok: false; code: string; message: string }
```

---

## 4. 환경변수 소유 명시

`.env` 파일에서 각 변수의 소유자를 주석으로 명시합니다. 소유자만 값을 설정하고, 다른 팀원은 참조만 합니다.

```dotenv
# ── D 소유 (인테그레이션 & 샌드박스) ──────────────────────
GITHUB_WEBHOOK_SECRET=           # GitHub Webhook 서명 검증 시크릿
GITHUB_TOKEN=                    # GitHub API 호출용 PAT (repo 권한)
VFS_STORAGE_PATH=./vfs-store     # VFS 스냅샷 저장 경로 (로컬 개발용)

# ── B 소유 (백엔드 & 데이터) — D가 읽기 참조 ─────────────
DATABASE_URL=                    # PostgreSQL 연결 문자열
API_PORT=3001                    # NestJS 서버 포트
API_BASE_URL=http://localhost:3001

# ── A 소유 (AI 오케스트레이터) — D가 이벤트 발행 시 사용 ──
REDIS_URL=redis://localhost:6379  # Redis Pub/Sub (integration:events 채널)

# ── 공통 (전체 팀) ─────────────────────────────────────────
NODE_ENV=development
```

---

## 5. 팀원별 협업 인터페이스

### 5-A. A(오케스트레이터, 김성원)와 인터페이스

| 항목 | 규칙 |
|------|------|
| 이벤트 발행 채널 | Redis Pub/Sub `integration:events` |
| 이벤트 발행 시점 | 정적 검증 완료, VFS 스냅샷 생성, 학습자 VFS 승인 시 |
| Gate B 트리거 | `VALIDATION_PASSED` 이벤트 수신 시 A가 Gate B(API 계약 승인) 상태 전환 |
| SSOT 갱신 요청 | D는 직접 SSOT를 수정하지 않음. `CODE_DELTA_ANALYZED` 이벤트에 `codeDeltaSummary`를 담아 발행하면 A가 SSOT의 `codeDeltaSummary` 필드 갱신 |
| `stateVersion` | 이벤트 발행 전 A의 `GET /api/session/:sessionId/state-version`을 호출해 현재 버전 조회 후 페이로드에 포함 |

**A가 D에게 제공해야 하는 것:**
- `GET /api/session/:sessionId/state-version` 엔드포인트 (A 소유)
- `sessionId` 값 (세션 시작 시 A가 생성, D에게 공유)
- Redis 채널명 변경 시 사전 공지

---

### 5-B. B(백엔드 & 데이터, 박준용)와 인터페이스

| 항목 | 규칙 |
|------|------|
| OpenAPI 파일 경로 | `specs/openapi/v{major}.yaml` (B 소유, D가 읽기) |
| 계약 변경 감지 | D의 CI에서 `specs/openapi/` 파일 변경을 감지해 `CONTRACT_CHANGED` 이벤트 발행 |
| 검증 실패 알림 | `VALIDATION_FAILED` 이벤트 + PR 코멘트 자동 생성 (D가 `GITHUB_TOKEN`으로 작성) |
| 공유 타입 위치 | `specs/data-model/types.ts` — B가 도메인 타입 소유, D가 `ValidationResult`, `ContractDiff` 추가 |
| API 버전 규칙 | `v{major}` 정수만 사용 (예: `v1`, `v2`). 마이너 변경은 `v1.1.yaml` → `v1` 파일 내 `info.version` 필드로 구분 |

**B가 D에게 제공해야 하는 것:**
- OpenAPI 파일 업데이트 시 PR에 `[contract-changed]` 라벨 추가 (D CI가 감지용)
- 에러 응답 형식: `{ code: string; message: string }` — D가 검증 실패 메시지 작성 시 동일 형식 사용

---

### 5-C. C(프론트엔드 & UX, 유소민)와 인터페이스

| 항목 | 규칙 |
|------|------|
| 빌드 결과물 경로 | `apps/web/.next/` (CI에서 빌드 성공 여부 확인) |
| ESLint 공통 규칙 | 루트 `.eslintrc.js` (D가 관리, C와 합의 후 수정) |
| TypeScript 설정 | `apps/web/tsconfig.json`, `apps/api/tsconfig.json` 각자 소유 / 루트 `tsconfig.base.json`은 D가 관리 |
| 검증 실패 시 | PR merge 블록 (GitHub Branch Protection) + PR 코멘트에 실패 항목 목록 명시 |
| VFS Diff 조회 | C의 프론트 코드가 `GET /api/vfs/diff/:snapshotId`를 호출해 Diff UI 렌더링 |

**C가 D에게 제공해야 하는 것:**
- `apps/web` 빌드 명령어 변경 시 사전 공지 (현재: `npm run build -w web`)
- 새 lint 규칙 예외가 필요한 경우 PR 코멘트로 D에게 요청

---

## 6. CI 게이트 요약

```
PR 생성/업데이트
  └─ [CI: lint]        ─ 실패 시 merge 블록
  └─ [CI: typecheck]   ─ 실패 시 merge 블록
  └─ [CI: contract]    ─ 실패 시 merge 블록 + CONTRACT_CHANGED 감지 시 이벤트 발행
  └─ [CI: build]       ─ 실패 시 merge 블록

모두 통과
  └─ VALIDATION_PASSED 이벤트 → Redis integration:events
  └─ A가 Gate B 상태 전환 가능 상태로 업데이트
```

---

## 7. 변경 이력

| 날짜 | 변경 내용 | 담당자 |
|------|-----------|--------|
| 2026-04-10 | 초안 작성 | D (한승준) |
