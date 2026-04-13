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
import { SOLO_BE_ACTIVATED_AI_ROLES, type LearnerRole, type LearningSession } from "@/lib/session-types";
import {
  createSimulationSessionForWorkspace,
  verifySimulationSessionExists
} from "@/lib/simulation-session-api";

type Props = {
  onSessionCreated: (session: LearningSession) => void;
};

const PLACEHOLDER_UUID = "00000000-0000-4000-8000-000000000000";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AI_ROLE_ORDER: string[] = [...SOLO_BE_ACTIVATED_AI_ROLES];

function orderedAiRoles(roles: readonly string[]): string[] {
  return [...roles].sort((a, b) => AI_ROLE_ORDER.indexOf(a) - AI_ROLE_ORDER.indexOf(b));
}

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
  /** F-1: 이미 만든 시뮬 세션·서버 INTEGRATION_WEBHOOK_SESSION_ID와 맞출 때 */
  const [existingSimSessionId, setExistingSimSessionId] = useState("");
  const [learnerRole, setLearnerRole] = useState<LearnerRole>("backend_developer");
  const [activeAiRoles, setActiveAiRoles] = useState<readonly string[]>(() => [...SOLO_BE_ACTIVATED_AI_ROLES]);

  function toggleActiveAiRole(role: string) {
    setActiveAiRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

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
    const activatedAiRoleLabels = orderedAiRoles(activeAiRoles);
    if (activatedAiRoleLabels.length === 0) {
      setError("참여할 AI 역할을 하나 이상 선택해 주세요.");
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

      const pasted = existingSimSessionId.trim();
      let sessionId: string;
      if (pasted) {
        if (!UUID_V4_RE.test(pasted)) {
          setError("시뮬 세션 ID는 UUID v4 형식이어야 합니다. 비우면 새로 생성합니다.");
          setSubmitting(false);
          return;
        }
        const ok = await verifySimulationSessionExists(pasted);
        if (!ok) {
          setError(
            "입력한 UUID에 해당하는 시뮬 세션이 API에서 확인되지 않습니다. 비우면 새 세션이 만들어집니다."
          );
          setSubmitting(false);
          return;
        }
        sessionId = pasted;
      } else {
        const linked = await createSimulationSessionForWorkspace({
          goal,
          topic: t,
          sprintDays,
          proficiency,
          learnerRole,
          activeRoles: activatedAiRoleLabels,
          scenarioId: resolvedScenarioId
        });
        sessionId = linked?.id ?? offlineProvisionalId ?? crypto.randomUUID();
      }

      let checklist = checklistMarkdown;
      if (offlineProvisionalId && offlineProvisionalId !== sessionId) {
        checklist = checklist.replace(new RegExp(escapeRegExp(offlineProvisionalId), "g"), sessionId);
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
        proficiency,
        learnerRole,
        activatedAiRoleLabels
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
          <code className="rounded bg-slate-100 px-1">id</code>를 학습 세션 UUID로 씁니다. 시뮬·웹훅·통합 타임라인
          정렬에 유리합니다.
        </p>

        <form className="mt-6 space-y-4" onSubmit={(ev) => void handleSubmit(ev)}>
          <div>
            <span className="block text-xs font-medium text-slate-700">학습자 역할 (구현 집중축)</span>
            <p className="mt-1 text-xs text-slate-500">
              PM·FE·QA 등 에이전트가 이 축에 맞춰 조언합니다. (예: 백엔드 선택 시 FE는 API 계약 위주로만 짚습니다.)
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="learnerRole"
                  checked={learnerRole === "backend_developer"}
                  onChange={() => setLearnerRole("backend_developer")}
                />
                백엔드 (서버·API)
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="learnerRole"
                  checked={learnerRole === "frontend_developer"}
                  onChange={() => setLearnerRole("frontend_developer")}
                />
                프론트엔드 (UI·연동)
              </label>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700">참여 AI 역할군</span>
            <p className="mt-1 text-xs text-slate-500">
              채팅 순환 참여자와, 시스템 프롬프트에 주입되는 동료 맥락에 사용됩니다.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {SOLO_BE_ACTIVATED_AI_ROLES.map((role) => (
                <label key={role} className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activeAiRoles.includes(role)}
                    onChange={() => toggleActiveAiRole(role)}
                  />
                  {role}
                </label>
              ))}
            </div>
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

          <div>
            <label
              className="block text-xs font-medium text-slate-700"
              htmlFor="existing-sim-id"
            >
              기존 시뮬 세션 ID (선택, UUID)
            </label>
            <input
              id="existing-sim-id"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-slate-400"
              value={existingSimSessionId}
              onChange={(e) => setExistingSimSessionId(e.target.value)}
              placeholder="비우면 POST /sessions 로 새로 생성"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-slate-500">
              서버 <code className="rounded bg-slate-100 px-0.5">INTEGRATION_WEBHOOK_SESSION_ID</code>와
              같게 맞출 때 기존 <code className="rounded bg-slate-100 px-0.5">GET /sessions/:id</code>로
              검증된 UUID를 넣습니다.
            </p>
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
