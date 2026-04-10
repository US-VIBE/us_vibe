import * as path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../../../.env") });

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ContractHttpExceptionFilter } from "./http-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useGlobalFilters(new ContractHttpExceptionFilter());
  app.enableCors();
  const port = process.env.API_PORT
    ? parseInt(process.env.API_PORT, 10)
    : 4000;
  await app.listen(port);
}

void bootstrap();
