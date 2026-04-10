import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  // rawBody 활성화: WebhookController에서 HMAC-SHA256 서명 검증에 필요
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors();
  await app.listen(process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 4000);
}

void bootstrap();
