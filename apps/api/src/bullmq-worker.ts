import "./bullmq-worker-env";
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

/**
 * P-2: PR 정적 검증 BullMQ 워커 전용 프로세스.
 * API에서는 INTEGRATION_BULLMQ_SEPARATE_WORKER=1 로 인-프로세스 Worker를 끈다.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger("BullmqWorker");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"]
  });
  logger.log(
    "BullMQ worker context ready. INTEGRATION_BULLMQ=1, REDIS_URL required. Services with 'worker' role will now process jobs. Ctrl+C to stop.",
  );
  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
