import { Module } from "@nestjs/common";
import { GeminiService } from "./gemini.service";
import { OpenAIArtifactEvalService } from "./openai-artifact-eval.service";

@Module({
  providers: [GeminiService, OpenAIArtifactEvalService],
  exports: [GeminiService, OpenAIArtifactEvalService]
})
export class AiModule {}
