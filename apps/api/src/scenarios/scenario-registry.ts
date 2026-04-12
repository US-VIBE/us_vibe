import { LOGIN_MVP_PACK } from "./packs/login-mvp.pack";
import type { ResolvedScenario, ScenarioPack } from "./scenario-pack.types";

const PACKS: ScenarioPack[] = [LOGIN_MVP_PACK];

const byId = new Map(PACKS.map((p) => [p.id, p]));

export function listScenarioCatalog(): Pick<
  ScenarioPack,
  "id" | "version" | "title" | "summary" | "matchKeywords"
>[] {
  return PACKS.map(({ id, version, title, summary, matchKeywords }) => ({
    id,
    version,
    title,
    summary,
    matchKeywords
  }));
}

export function getScenarioPackById(id: string): ScenarioPack | null {
  return byId.get(id.trim()) ?? null;
}

/**
 * 명시적 scenarioId > 키워드 매칭 > 기본 팩(login-mvp)
 */
export function resolveScenario(topic: string, scenarioId?: string | null): ResolvedScenario {
  const t = topic.trim().toLowerCase();
  if (scenarioId) {
    const pack = getScenarioPackById(scenarioId);
    if (pack) {
      return { pack, resolvedBy: "explicit_id" };
    }
  }
  for (const pack of PACKS) {
    if (pack.matchKeywords.some((kw) => t.includes(kw.toLowerCase()))) {
      return { pack, resolvedBy: "keyword" };
    }
  }
  return { pack: LOGIN_MVP_PACK, resolvedBy: "default" };
}

export function renderGithubEnvSnippet(pack: ScenarioPack, sessionId: string): string {
  return pack.githubEnvSnippetTemplate.replace(/\{\{sessionId\}\}/g, sessionId);
}

export function buildBriefingPayload(
  pack: ScenarioPack,
  topic: string,
  sessionId: string,
  resolvedBy: ResolvedScenario["resolvedBy"]
): Record<string, unknown> {
  return {
    scenarioId: pack.id,
    scenarioVersion: pack.version,
    topic,
    sessionId,
    resolvedBy,
    title: pack.title,
    summary: pack.summary,
    phases: pack.phases,
    deliverables: pack.deliverables,
    evaluationSummary: pack.evaluationSummary,
    githubEnvSnippet: renderGithubEnvSnippet(pack, sessionId),
    /** UI·알림용 한 블록 텍스트 */
    checklistMarkdown: buildChecklistMarkdown(pack, topic, sessionId)
  };
}

function buildChecklistMarkdown(pack: ScenarioPack, topic: string, sessionId: string): string {
  const lines = [
    `# ${pack.title}`,
    "",
    `**주제:** ${topic}`,
    "",
    "## 단계",
    ...pack.phases.map((p) => `- **${p.title}** — ${p.description}`),
    "",
    "## 제출·검사",
    ...pack.deliverables.map(
      (d) =>
        `- **${d.title}** (${d.format}) — 검사: ${d.howYouWillBeEvaluated}`
    ),
    "",
    "## 평가 요약",
    pack.evaluationSummary,
    "",
    "## GitHub·웹훅 (선택)",
    "아래 값을 API 실행 환경에 넣으면 이 세션과 통합 타임라인이 맞춰집니다.",
    "",
    "```",
    renderGithubEnvSnippet(pack, sessionId),
    "```"
  ];
  return lines.join("\n");
}
