import { Module } from "@nestjs/common";
import { GeminiService } from "./gemini.service";
import { OrchestratorService } from "./orchestrator.service";
import { PersistenceModule } from "../persistence/persistence.module";

@Module({
  imports: [PersistenceModule],
  providers: [GeminiService, OrchestratorService],
  exports: [GeminiService, OrchestratorService]
})
export class AiModule {}
