import { Controller, Get, Param, Logger, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import * as fs from "fs";
import * as path from "path";
import type { ValidationResult } from "../../../../specs/data-model/types";

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  code?: string;
  message?: string;
}

interface ValidationStatusRecord {
  prNumber: number;
  result: ValidationResult;
  checkedAt: string;
}

const STORAGE_PATH = path.resolve(
  process.env.VFS_STORAGE_PATH ?? "./vfs-store",
  "validation",
);

@Controller("api/validation")
@UseGuards(JwtAuthGuard)
export class ValidationController {
  private readonly logger = new Logger(ValidationController.name);

  @Get("status/:prNumber")
  async getStatus(
    @Param("prNumber") prNumber: string,
  ): Promise<ApiResponse<ValidationStatusRecord | null>> {
    const filePath = path.join(STORAGE_PATH, `pr-${prNumber}.json`);

    if (!fs.existsSync(filePath)) {
      this.logger.log(`PR #${prNumber} 검증 기록 없음`);
      return { ok: true, data: null };
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    const record = JSON.parse(raw) as ValidationStatusRecord;
    return { ok: true, data: record };
  }

  // ValidationService.runAll() 완료 후 결과를 파일에 저장하기 위한 헬퍼
  static saveResult(prNumber: number, result: ValidationResult): void {
    if (!fs.existsSync(STORAGE_PATH)) {
      fs.mkdirSync(STORAGE_PATH, { recursive: true });
    }
    const record: ValidationStatusRecord = {
      prNumber,
      result,
      checkedAt: new Date().toISOString(),
    };
    const filePath = path.join(STORAGE_PATH, `pr-${prNumber}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf-8");
  }
}
