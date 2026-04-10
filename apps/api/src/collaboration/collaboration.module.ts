import {
  CollaborationEvent,
  CollaborationEventsDataService
} from "@us-vibe/backend";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationService } from "./collaboration.service";

@Module({
  imports: [TypeOrmModule.forFeature([CollaborationEvent])],
  controllers: [CollaborationController],
  providers: [
    CollaborationService,
    {
      provide: CollaborationEventsDataService,
      useFactory: (repo: unknown): CollaborationEventsDataService =>
        new CollaborationEventsDataService(repo),
      inject: [getRepositoryToken(CollaborationEvent)]
    }
  ]
})
export class CollaborationModule {}
