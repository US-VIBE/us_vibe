import { Module } from "@nestjs/common";
import { GeminiService } from "./gemini.service";
import { OpenAIArtifactEvalService } from "./openai-artifact-eval.service";
import { OrchestratorService } from "./orchestrator.service";
import { PersistenceModule } from "../persistence/persistence.module";


@Module({
  imports: [PersistenceModule],
  providers: [GeminiService, OpenAIArtifactEvalService, OrchestratorService],
  exports: [GeminiService, OpenAIArtifactEvalService, OrchestratorService]
})
export class AiModule {}
