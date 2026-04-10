"use client";

import { useState, type FormEvent } from "react";
import type { Proficiency } from "@/lib/session-types";
import { createSoloBeSession, saveSession } from "@/lib/session-storage";
import type { LearningSession } from "@/lib/session-types";

type Props = {
  onSessionCreated: (session: LearningSession) => void;
};

export function OnboardingForm({ onSessionCreated }: Props) {
  const [goal, setGoal] = useState("실무 협업 경험");
  const [topic, setTopic] = useState("");
  const [sprintDays, setSprintDays] = useState<1 | 3 | 7>(3);
  const [proficiency, setProficiency] = useState<Proficiency>("intermediate");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const g = goal.trim();
    const t = topic.trim();
    if (!g || !t) {
      setError("학습 목표와 주제를 입력해 주세요.");
      return;
    }
    const session = createSoloBeSession({
      goal: g,
      topic: t,
      sprintDays,
      proficiency
    });
    saveSession(session);
    onSessionCreated(session);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">US Vibe 시작</h1>
        <p className="mt-1 text-sm text-slate-600">
          시스템 컨텍스트를 입력하면 세션이 생성되고, 역할 결손에 따라 AI 역할군이 활성화됩니다.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-medium text-slate-700">학습자 역할</label>
            <p className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
              Backend Developer (고정)
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700" htmlFor="goal">
              학습 목표
            </label>
            <input
              id="goal"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예: 실무 협업 경험"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700" htmlFor="topic">
              주제
            </label>
            <input
              id="topic"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 로그인/회원가입 기능"
              autoComplete="off"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700">스프린트 시간</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {([1, 3, 7] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  className={
                    sprintDays === d
                      ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white"
                      : "rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  }
                  onClick={() => setSprintDays(d)}
                >
                  {d}일
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700">숙련도</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {(
                [
                  ["beginner", "초급"],
                  ["intermediate", "중급"],
                  ["advanced", "고급"]
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    proficiency === id
                      ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white"
                      : "rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  }
                  onClick={() => setProficiency(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            세션 시작 · 워크스페이스로 이동
          </button>
        </form>
      </div>
    </div>
  );
}
