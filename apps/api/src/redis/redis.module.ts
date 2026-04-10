import { RevokedTokenStore } from "@us-vibe/backend";
import { Global, Module } from "@nestjs/common";

@Global()
@Module({
  providers: [
    {
      provide: RevokedTokenStore,
      useFactory: (): RevokedTokenStore =>
        new RevokedTokenStore(process.env.REDIS_URL)
    }
  ],
  exports: [RevokedTokenStore]
})
export class RedisIntegrationModule {}
