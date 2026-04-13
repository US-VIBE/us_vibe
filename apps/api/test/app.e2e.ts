import "reflect-metadata";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PG_READY_FLAG } from "./pg-ready-flag";

const dbPath = path.join(os.tmpdir(), `usvibe-e2e-${process.pid}-${Date.now()}.db`);

/** globalSetup이 127.0.0.1:5432 Postgres 도달 가능 여부를 기록한다. 없으면 TypeORM 부팅이 멈춰 훅 타임아웃 난다. */
const pgUp =
  fs.existsSync(PG_READY_FLAG) && fs.readFileSync(PG_READY_FLAG, "utf8").trim() === "1";

if (!pgUp) {
  // eslint-disable-next-line no-console -- 테스트 스킵 시 원인 안내
  console.warn(
    "\n[apps/api e2e] PostgreSQL(127.0.0.1:5432)에 연결할 수 없어 e2e를 건너뜁니다.\n" +
      "  전체 실행: Docker 설치 후 `npm run db:up && npm run db:wait && npm run migrate` 뒤 `npm run test -w api`\n"
  );
}

let app: INestApplication;

describe.skipIf(!pgUp)("App (e2e)", () => {
  beforeAll(async () => {
    process.env.DATABASE_PATH = dbPath;
    process.env.JWT_SECRET = "e2e-test-secret";
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  });
  it("GET /health", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(String(res.body.service)).toMatch(/^us-vibe-api/);
  });

  it("회원가입 후 JWT로 role-gap 조회", async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const password = "password123456";
    const reg = await request(app.getHttpServer())
      .post("/api/auth/register")
      .send({ email, password })
      .expect(201);
    expect(reg.body.ok).toBe(true);
    const token = (reg.body.data as { accessToken: string }).accessToken;
    expect(typeof token).toBe("string");

    const sessionId = "00000000-0000-4000-8000-000000000001";
    const gap = await request(app.getHttpServer())
      .get(`/api/sessions/${sessionId}/role-gap`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(gap.body.ok).toBe(true);
    expect(gap.body.data.injectedAgents?.length).toBeGreaterThan(0);
  });

  it("토큰 없이 세션 API는 401", async () => {
    await request(app.getHttpServer())
      .get("/api/sessions/00000000-0000-4000-8000-000000000002/role-gap")
      .expect(401);
  });
});

