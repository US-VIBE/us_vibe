import {
  CollaborationEvent,
  CollaborationEventsDataService,
  SimulationSession,
  SessionsDataService
} from "@us-vibe/backend";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { AiModule } from "../ai/ai.module";
import { ScenarioRunnerService } from "./scenario-runner.service";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([SimulationSession, CollaborationEvent]),
    AiModule
  ],
  controllers: [SessionsController],
  providers: [
    SessionsService,
    ScenarioRunnerService,
    {
      provide: SessionsDataService,
      useFactory: (repo: unknown): SessionsDataService =>
        new SessionsDataService(repo),
      inject: [getRepositoryToken(SimulationSession)]
    },
    {
      provide: CollaborationEventsDataService,
      useFactory: (repo: unknown): CollaborationEventsDataService =>
        new CollaborationEventsDataService(repo),
      inject: [getRepositoryToken(CollaborationEvent)]
    }
  ],
  exports: [SessionsService]
})
export class SessionsModule {}
