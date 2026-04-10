import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { IntegrationModule } from "./integration/integration.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { SessionController } from "./session/session.controller";
import { PrReviewController } from "./session/pr-review.controller";
import { ContractGateController } from "./session/contract-gate.controller";
import { RetroController } from "./session/retro.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PersistenceModule,
    AuthModule,
    IntegrationModule,
  ],
  controllers: [
    AppController,
    SessionController,
    PrReviewController,
    ContractGateController,
    RetroController,
  ],
  providers: [],
})
export class AppModule {}
