# 맥에서 Docker로 로컬 DB 쓰기 (US Vibe)

API는 **PostgreSQL**이 떠 있어야 기동합니다. 이 레포는 **`docker-compose.yml`** 로 Postgres(및 선택적으로 Redis)를 올립니다.

---

## 1. Docker Desktop 설치 (맥)

1. [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/) 공식 페이지에서 **Apple Silicon(M1/M2/M3)** 또는 **Intel** 에 맞는 설치 파일을 받습니다.
2. 설치 후 **Docker Desktop 앱을 실행**합니다(메뉴바에 고래 아이콘이 떠 있어야 함).
3. 터미널에서 확인:

```bash
docker --version
docker compose version
```

둘 다 버전이 나오면 준비 완료입니다.

---

## 2. 저장소에서 DB + 앱 기동

프로젝트 **루트**에서:

```bash
npm install
```

루트에 **`.env`** 가 있고 `DATABASE_URL` 이 아래와 같으면 compose 기본값과 맞습니다(수정 없이도 됨).

```text
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/usvibe
```

**Postgres 컨테이너 + 마이그레이션 + API + 웹** 한 번에:

```bash
npm run dev:stack
```

- 브라우저: [http://localhost:3000](http://localhost:3000)  
- API 헬스: [http://localhost:4000/health](http://localhost:4000/health)  

웹에서 API를 부르려면 `apps/web/.env.local` 에 `NEXT_PUBLIC_API_URL=http://localhost:4000` 이 있어야 합니다([`fe-web-integration.md`](./fe-web-integration.md)).

---

## 3. 자주 쓰는 명령

| 명령 | 설명 |
|------|------|
| `npm run db:up` | Postgres 컨테이너만 백그라운드 기동 |
| `npm run db:wait` | 5432 포트 준비될 때까지 대기 |
| `npm run migrate` | TypeORM 마이그레이션 |
| `npm run dev:lite` | DB만 올리고 마이그레이션 생략 후 API+웹 (반복 기동이 조금 빠름) |
| `npm run dev:api:stack` | DB + 마이그레이션 + **API만** |

---

## 4. Redis까지 올리기 (선택)

로그아웃 시 토큰 폐기 등에 **Redis**가 필요하면:

```bash
docker compose up -d redis
```

루트 `.env` 에 예:

```text
REDIS_URL=redis://127.0.0.1:6379
```

(`docker-compose.yml` 기본 포트는 `6379:6379` 입니다.)

---

## 5. 끄기

```bash
docker compose stop
```

데이터 볼륨까지 지우려면 Docker Desktop에서 Volume 삭제 또는 문서화된 `docker compose down -v` (주의: DB 데이터 삭제).

---

## 문제 해결

- **`docker: command not found`** → Docker Desktop이 설치되지 않았거나, 앱을 한 번도 실행하지 않았을 수 있습니다.
- **`port is already allocated`** → 맥에 이미 Postgres가 5432를 쓰는 경우입니다. 기존 Postgres를 끄거나 `docker-compose.yml`의 포트 매핑을 바꿉니다.
- **`ECONNREFUSED 127.0.0.1:5432`** → 컨테이너가 안 떠 있음. `docker compose ps` 로 `postgres` 상태를 확인합니다.
