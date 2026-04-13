import { CollaborationEventsDataService } from "../../../../src/backend/src/collaboration/collaboration-events-data.service";
import { CollaborationEvent } from "../../../../src/backend/src/entities/collaboration-event.entity";
import { SimulationSession } from "../../../../src/backend/src/entities/simulation-session.entity";
import { SessionsDataService } from "../../../../src/backend/src/sessions/sessions-data.service";
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
