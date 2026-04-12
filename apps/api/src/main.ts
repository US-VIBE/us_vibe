import * as path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../.env") });

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ContractHttpExceptionFilter } from "./http-exception.filter";

function envFlagTrue(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  if (envFlagTrue(process.env.WEBHOOK_TRUST_PROXY)) {
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
  const rawPort = process.env.PORT ?? process.env.API_PORT ?? "4000";
  const port = Number.parseInt(rawPort, 10);
  await app.listen(Number.isFinite(port) ? port : 4000);
}

void bootstrap();
