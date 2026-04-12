import { Controller, Get, Query } from "@nestjs/common";
import {
  buildBriefingPayload,
  listScenarioCatalog,
  resolveScenario
} from "./scenario-registry";

/**
 * 공개 시나리오 카탈로그·해석 (JWT 불필요) — 웹 온보딩·문서 링크용
 */
@Controller("api/scenarios")
export class ScenariosController {
  @Get("catalog")
  catalog() {
    return { ok: true, data: listScenarioCatalog() };
  }

  @Get("resolve")
  resolve(
    @Query("topic") topic?: string,
    @Query("scenarioId") scenarioId?: string
  ) {
    const t = typeof topic === "string" ? topic : "";
    const resolved = resolveScenario(t, scenarioId?.trim() || null);
    const briefing = buildBriefingPayload(
      resolved.pack,
      t.trim() || "(주제 미입력)",
      "00000000-0000-4000-8000-000000000000",
      resolved.resolvedBy
    );
    return {
      ok: true,
      data: {
        resolvedBy: resolved.resolvedBy,
        scenarioId: resolved.pack.id,
        defaults: resolved.pack.defaults,
        phases: resolved.pack.phases,
        deliverables: resolved.pack.deliverables,
        evaluationSummary: resolved.pack.evaluationSummary,
        checklistMarkdown: briefing.checklistMarkdown,
        prValidationFixGuide: resolved.pack.prValidationFixGuide
      }
    };
  }
}
