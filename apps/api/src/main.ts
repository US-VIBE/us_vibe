import * as path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../.env") });

import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ContractHttpExceptionFilter } from "./http-exception.filter";

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

function resolveListenPort(): number {
  const parse = (raw: string | undefined): number | null => {
    if (raw === undefined || raw.trim() === "") {
      return null;
    }
    const n = Number.parseInt(raw.trim(), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return (
    parse(process.env.PORT) ??
    parse(process.env.API_PORT) ??
    (process.env.NODE_ENV === "production" ? 8080 : 4000)
  );
}

async function bootstrap(): Promise<void> {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const trustProxy =
    envFlagTrue(process.env.WEBHOOK_TRUST_PROXY) ||
    Boolean(process.env.RAILWAY_ENVIRONMENT?.trim());
  if (trustProxy) {
    const adapter = app.getHttpAdapter();
    if (adapter.getType() === "express") {
      adapter.getInstance().set("trust proxy", true);
    }
  }
  app.useGlobalFilters(new ContractHttpExceptionFilter());
  app.enableCors({
    origin: true,
    credentials: true
  });
  const listenPort = resolveListenPort();
  await app.listen(listenPort, "0.0.0.0");
  logger.log(`Listening on 0.0.0.0:${listenPort} (NODE_ENV=${process.env.NODE_ENV ?? "undefined"})`);
}

void bootstrap();
