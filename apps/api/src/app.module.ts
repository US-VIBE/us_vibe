import { createDataSourceOptions } from "@us-vibe/backend";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule, type TypeOrmModuleOptions } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CollaborationModule } from "./collaboration/collaboration.module";
import { IntegrationModule } from "./integration/integration.module";
import { RedisIntegrationModule } from "./redis/redis.module";
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
    IntegrationModule
  ],
  controllers: [AppController],
  providers: []
})
export class AppModule {}
