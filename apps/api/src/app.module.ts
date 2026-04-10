import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { IntegrationModule } from "./integration/integration.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    IntegrationModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
