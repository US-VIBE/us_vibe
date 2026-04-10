# US Vibe Monorepo

AI 멀티 에이전트 기반 협업 학습 시뮬레이터 MVP를 위한 모노레포입니다.

## Stack
- Frontend: Next.js (`apps/web`)
- Backend: NestJS (`apps/api`)
- Workspace: npm workspaces (single repository)

## Quick Start
```bash
npm install
npm run dev:web
npm run dev:api
```

### 로컬 개발 모드 요약

| 명령 | 용도 |
|------|------|
| `npm run dev` | Postgres가 이미 떠 있을 때 API+웹만 동시 기동 |
| `npm run dev:lite` | DB 컨테이너 기동·포트 대기 후 API+웹 (마이그레이션 생략, 반복 기동이 조금 더 빠름) |
| `npm run dev:stack` | 첫 클론·마이그레이션 추가 직후 등, DB 기동 + `migrate` + API+웹 |

웹(`apps/web`)은 동기화 폴더(OneDrive 등)에서 **무한 재컴파일**이 나오기 쉬워 기본이 `next dev --webpack`이며, 로컬 디스크에서만 Turbopack을 쓰려면 `npm run dev:turbo -w web`을 사용합니다.

### 시뮬레이션 풀 스택 (DB + 마이그레이션 + API + 웹)

Docker Desktop(또는 Docker Engine)이 떠 있는 상태에서, 저장소 루트에서:

1. **환경 변수** — 루트에 `.env`를 두고 [`.env.example`](./.env.example)을 참고해 `DATABASE_URL`을 맞춥니다(기본값은 `docker-compose.yml`의 Postgres와 동일). 자동 시나리오(Gemini)까지 쓰려면 `GEMINI_API_KEY`를 **서버 전용**으로 넣습니다(`NEXT_PUBLIC_` 접두사 없음).
2. **한 번에 기동** — `npm run dev:stack`  
   - Postgres 컨테이너 기동 → 포트 5432 준비 대기(`scripts/wait-for-tcp.mjs`) → TypeORM 마이그레이션 → API·웹 동시 개발 서버(`concurrently`).
3. **브라우저** — [http://localhost:3000/simulate](http://localhost:3000/simulate) 에서 세션 생성 후 단계별 버튼으로 호출합니다. 웹이 다른 호스트의 API를 쓰면 `apps/web/.env.local`에 `NEXT_PUBLIC_API_BASE_URL`을 설정합니다([`apps/web/.env.example`](./apps/web/.env.example)).

API만 DB까지 포함해 띄우려면 기존처럼 `npm run dev:api:stack` 을 쓰면 됩니다(웹 제외).

## Ports
- Web: `http://localhost:3000`
- API: `http://localhost:4000/health`

## Documents
- Product/Sprint plan: `docs/plan.md`
- **협업용 통합 참고(환경 변수·엔드포인트·이름 규칙):** `docs/collaboration-env-and-endpoints.md`
- FE ↔ API 연동: `docs/fe-web-integration.md`
- Backend solo user scenario (MVP flow): `docs/user-scenario-backend-solo-mvp.md`
- Full architecture plan: `docs/ai_협업_에이전트_설계_10198352.plan.md`
- Collaboration/auth API & env reference: `docs/api/collaboration-endpoints-and-env.md`
- Same content, Notion-friendly copy: `docs/api/collaboration-endpoints-notion.md`