import { Controller, Get, Param, Logger, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { PrValidationStatusRecord } from "../persistence/workspace-persistence.service";
import { WorkspacePersistenceService } from "../persistence/workspace-persistence.service";

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  code?: string;
  message?: string;
}

@Controller("api/validation")
@UseGuards(JwtAuthGuard)
export class ValidationController {
  private readonly logger = new Logger(ValidationController.name);

  constructor(private readonly workspace: WorkspacePersistenceService) {}

  @Get("status/:prNumber")
  async getStatus(
    @Param("prNumber") prNumber: string,
  ): Promise<ApiResponse<PrValidationStatusRecord | null>> {
    const n = parseInt(prNumber, 10);
    if (Number.isNaN(n)) {
      return { ok: true, data: null };
    }
    const record = this.workspace.getPrValidationResult(n);
    if (!record) {
      this.logger.log(`PR #${prNumber} 검증 기록 없음`);
    }
    return { ok: true, data: record };
  }
}
