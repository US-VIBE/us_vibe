import { createDataSourceOptions } from "@us-vibe/backend";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule, type TypeOrmModuleOptions } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { IntegrationModule } from "./integration/integration.module";
import { PersistenceModule } from "./persistence/persistence.module";
import { RedisIntegrationModule } from "./redis/redis.module";
import { ContractGateController } from "./session/contract-gate.controller";
import { PrReviewController } from "./session/pr-review.controller";
import { ProjectStateController } from "./session/project-state.controller";
import { RetroController } from "./session/retro.controller";
import { SessionController } from "./session/session.controller";
import { WorkspaceDodVerifyController } from "./session/workspace-dod-verify.controller";
import { ScenariosController } from "./scenarios/scenarios.controller";
import { SessionsModule } from "./sessions/sessions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(
      createDataSourceOptions() as TypeOrmModuleOptions
    ),
    RedisIntegrationModule,
    AuthModule,
    CollaborationModule,
    SessionsModule,
    IntegrationModule,
    PersistenceModule
  ],
  controllers: [
    AppController,
    ScenariosController,
    SessionController,
    PrReviewController,
    ContractGateController,
    RetroController,
    ProjectStateController,
    WorkspaceDodVerifyController
  ],
  providers: []
})
export class AppModule {}
