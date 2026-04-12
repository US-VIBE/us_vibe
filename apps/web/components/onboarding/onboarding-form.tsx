"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getApiBaseUrl } from "@/lib/api-base";
import {
  offlineResolveScenario,
  proficiencyFromSkillLevel,
  sprintDaysFromDuration
} from "@/lib/offline-scenario-resolve";
import { fetchScenarioCatalog, fetchScenarioResolve } from "@/lib/scenarios-api";
import { createSoloBeSession, saveSession } from "@/lib/session-storage";
import type { LearningSession } from "@/lib/session-types";
import { createSimulationSessionForWorkspace } from "@/lib/simulation-session-api";

type Props = {
  onSessionCreated: (session: LearningSession) => void;
};

const PLACEHOLDER_UUID = "00000000-0000-4000-8000-000000000000";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function OnboardingForm({ onSessionCreated }: Props) {
  const [topic, setTopic] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [catalog, setCatalog] = useState<Array<{ id: string; title: string }>>([]);
  const [catalogErr, setCatalogErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await fetchScenarioCatalog();
        if (!cancelled) {
          setCatalog(items.map((i) => ({ id: i.id, title: i.title })));
        }
      } catch (e) {
        if (!cancelled) {
          setCatalogErr(e instanceof Error ? e.message : String(e));
          setCatalog([{ id: "login-mvp", title: "로그인·인증 MVP (오프라인)" }]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const t = topic.trim();
    if (!t) {
      setError("주제를 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const apiBase = getApiBaseUrl();
      let resolvedScenarioId: string;
      let goal: string;
      let sprintDays: 1 | 3 | 7;
      let proficiency: LearningSession["proficiency"];
      let checklistMarkdown: string;
      let offlineProvisionalId: string | null = null;

      try {
        const data = await fetchScenarioResolve(t, scenarioId || null, apiBase);
        resolvedScenarioId = data.scenarioId;
        goal = data.defaults.learningGoal;
        sprintDays = sprintDaysFromDuration(data.defaults.sprintDuration);
        proficiency = proficiencyFromSkillLevel(data.defaults.skillLevel);
        checklistMarkdown = data.checklistMarkdown;
      } catch {
        offlineProvisionalId = crypto.randomUUID();
        const off = offlineResolveScenario(t, scenarioId || null, offlineProvisionalId);
        resolvedScenarioId = off.scenarioId;
        goal = off.defaults.learningGoal;
        sprintDays = sprintDaysFromDuration(off.defaults.sprintDuration);
        proficiency = proficiencyFromSkillLevel(off.defaults.skillLevel);
        checklistMarkdown = off.checklistMarkdown;
      }

      const linked = await createSimulationSessionForWorkspace({
        goal,
        topic: t,
        sprintDays,
        proficiency
      });

      const sessionId =
        linked?.id ?? offlineProvisionalId ?? crypto.randomUUID();

      let checklist = checklistMarkdown;
      if (offlineProvisionalId && offlineProvisionalId !== sessionId) {
        checklist = checklist.replace(
          new RegExp(escapeRegExp(offlineProvisionalId), "g"),
          sessionId
        );
      } else {
        checklist = checklist.replace(new RegExp(PLACEHOLDER_UUID, "g"), sessionId);
      }

      const session = createSoloBeSession({
        sessionId,
        goal,
        topic: t,
        scenarioId: resolvedScenarioId,
        briefingMarkdown: checklist,
        sprintDays,
        proficiency
      });
      saveSession(session);
      onSessionCreated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">US Vibe 시작</h1>
        <p className="mt-1 text-sm text-slate-600">
          <strong>주제</strong>만 정하면 스프린트·숙련도·학습 목표·제출 항목은 시나리오 팩이 자동으로 채웁니다. GitHub
          웹훅과 검사 방식은 브리핑에 안내됩니다.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          API가 연결된 경우 동일 정보로 Postgres 시뮬 세션(
          <code className="rounded bg-slate-100 px-1">POST /sessions</code>)을 만들고 그{" "}
          <code className="rounded bg-slate-100 px-1">id</code>를 학습 세션 UUID로 씁니다. 시뮬·웹훅·통합 타임라인 정렬에
          유리합니다.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(ev) => void handleSubmit(ev)}>
          <div>
            <label className="block text-xs font-medium text-slate-700">학습자 역할</label>
            <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              Backend Developer (고정)
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700" htmlFor="topic">
              주제 (필수)
            </label>
            <input
              id="topic"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 로그인/회원가입 API"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700" htmlFor="scenario">
              시나리오 (선택 — 비우면 주제 키워드로 자동 매칭)
            </label>
            <select
              id="scenario"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
            >
              <option value="">자동</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title} ({c.id})
                </option>
              ))}
            </select>
            {catalogErr && (
              <p className="mt-1 text-xs text-amber-700">
                카탈로그 API를 불러오지 못해 자동 모드만 사용합니다. ({catalogErr})
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? "시나리오 적용 중…" : "세션 시작 · 워크스페이스로 이동"}
          </button>
        </form>
      </div>
    </div>
  );
}
