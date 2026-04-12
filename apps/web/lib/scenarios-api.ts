import { getApiBaseUrl } from "./api-base";

export type ScenarioCatalogItem = {
  id: string;
  version: string;
  title: string;
  summary: string;
  matchKeywords: string[];
};

export type ScenarioResolveData = {
  resolvedBy: string;
  scenarioId: string;
  defaults: { learningGoal: string; sprintDuration: string; skillLevel: string };
  checklistMarkdown: string;
};

export async function fetchScenarioCatalog(apiBase?: string): Promise<ScenarioCatalogItem[]> {
  const base = (apiBase ?? getApiBaseUrl()).replace(/\/$/, "");
  const res = await fetch(`${base}/api/scenarios/catalog`);
  if (!res.ok) {
    throw new Error(`catalog ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: ScenarioCatalogItem[] };
  if (!body?.ok || !Array.isArray(body.data)) {
    throw new Error("catalog invalid");
  }
  return body.data;
}

export async function fetchScenarioResolve(
  topic: string,
  scenarioId?: string | null,
  apiBase?: string
): Promise<ScenarioResolveData> {
  const base = (apiBase ?? getApiBaseUrl()).replace(/\/$/, "");
  const q = new URLSearchParams();
  q.set("topic", topic);
  if (scenarioId?.trim()) {
    q.set("scenarioId", scenarioId.trim());
  }
  const res = await fetch(`${base}/api/scenarios/resolve?${q.toString()}`);
  if (!res.ok) {
    throw new Error(`resolve ${res.status}`);
  }
  const body = (await res.json()) as { ok?: boolean; data?: ScenarioResolveData };
  if (!body?.ok || !body.data) {
    throw new Error("resolve invalid");
  }
  return body.data;
}
