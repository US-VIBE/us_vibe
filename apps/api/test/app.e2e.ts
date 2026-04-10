import "reflect-metadata";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dbPath = path.join(os.tmpdir(), `usvibe-e2e-${process.pid}-${Date.now()}.db`);

let app: INestApplication;

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

describe("App (e2e)", () => {
  it("GET /health", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("us-vibe-api");
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
