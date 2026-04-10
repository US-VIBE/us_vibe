"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileCode2,
  GitPullRequest,
  History,
  LayoutGrid,
  MessageSquare,
  Sparkles
} from "lucide-react";
import type { HumanRoleId, StoryTabId } from "@/lib/workspace-types";
import {
  sampleTimeline,
  sprintCheckpoints,
  thinkingLines,
  type TimelineEntry
} from "@/lib/mock-data";

const storyTabs: { id: StoryTabId; label: string; short: string }[] = [
  { id: "s1", label: "스토리1 · 역할·게이트", short: "역할" },
  { id: "s2", label: "스토리2 · Prompt→Spec", short: "명세" },
  { id: "s3", label: "스토리3 · PR 시뮬", short: "PR" },
  { id: "s4", label: "스토리4 · 계약 게이트", short: "계약" },
  { id: "s5", label: "스토리5 · 회고", short: "회고" }
];

const humanRoles: { id: HumanRoleId; label: string; fixed?: boolean }[] = [
  { id: "pm", label: "PM" },
  { id: "fe", label: "FE" },
  { id: "be", label: "BE (학습자)", fixed: true },
  { id: "senior", label: "Senior" },
  { id: "qa", label: "QA" }
];

function formatEventType(t: TimelineEntry["type"]): string {
  return t.replace(/_/g, " ");
}

export function WorkspaceApp() {
  const [activeStory, setActiveStory] = useState<StoryTabId>("s1");
  const [myRoles, setMyRoles] = useState<Set<HumanRoleId>>(
    () => new Set(["be"])
  );
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ id: string; role: "user" | "ai"; text: string }[]>(
    () => [{ id: "m0", role: "ai", text: "세션에 오신 것을 환영합니다. 역할을 선택한 뒤 게이트를 진행해 보세요." }]
  );
  const [promptDraft, setPromptDraft] = useState("");
  const [openApiDraft, setOpenApiDraft] = useState("openapi: 3.0.0\ninfo:\n  title: Session API\n");

  const aiFilledRoles = useMemo(() => {
    const need: HumanRoleId[] = ["pm", "fe", "senior", "qa"];
    return need.filter((r) => !myRoles.has(r));
  }, [myRoles]);

  function toggleRole(id: HumanRoleId) {
    if (id === "be") return;
    setMyRoles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sendChat() {
    const t = chatInput.trim();
    if (!t) return;
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", text: t },
      {
        id: `a-${Date.now()}`,
        role: "ai",
        text: "(목업) 메시지를 받았습니다. 백엔드 연동 후 실제 응답이 표시됩니다."
      }
    ]);
    setChatInput("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-slate-600" aria-hidden />
            <div>
              <h1 className="text-base font-semibold tracking-tight text-slate-900">
                US Vibe · 협업 워크스페이스
              </h1>
              <p className="text-xs text-slate-500">Sprint 1 · MVP 셸 (목업 데이터)</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2" aria-label="스프린트 게이트">
            {sprintCheckpoints.map((cp) => (
              <span
                key={cp.id}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700"
              >
                {cp.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                )}
                {cp.label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-0 lg:flex-row">
        {/* Chat */}
        <aside className="flex w-full shrink-0 flex-col border-slate-200 bg-white lg:w-[320px] lg:border-r">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <MessageSquare className="h-4 w-4 text-slate-500" aria-hidden />
            <span className="text-sm font-medium text-slate-800">채팅</span>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
            <ul className="flex max-h-[min(40vh,420px)] flex-col gap-2 overflow-y-auto text-sm lg:max-h-none lg:flex-1">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={
                    m.role === "user"
                      ? "ml-6 rounded-lg bg-slate-900 px-3 py-2 text-slate-50"
                      : "mr-6 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800"
                  }
                >
                  {m.text}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="chat-input">
                메시지
              </label>
              <input
                id="chat-input"
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none ring-slate-400 focus:ring-2"
                placeholder="메시지 입력…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800"
                onClick={sendChat}
              >
                전송
              </button>
            </div>
          </div>
        </aside>

        {/* Center: story tabs */}
        <main className="min-w-0 flex-1 border-slate-200 bg-slate-50/80 lg:border-r">
          <div className="border-b border-slate-200 bg-white px-2 pt-2">
            <div className="flex gap-1 overflow-x-auto pb-2" role="tablist" aria-label="스토리 패널">
              {storyTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeStory === tab.id}
                  className={
                    activeStory === tab.id
                      ? "shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  }
                  onClick={() => setActiveStory(tab.id)}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.short}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {activeStory === "s1" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s1-title">
                <h2 id="s1-title" className="text-sm font-semibold text-slate-900">
                  역할 매핑 · AI 보강
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  내가 맡은 역할을 선택하세요. 선택되지 않은 PM·FE·Senior·QA는 에이전트가 보강합니다.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {humanRoles.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        disabled={r.fixed}
                        onClick={() => toggleRole(r.id)}
                        className={
                          myRoles.has(r.id)
                            ? "rounded-full border border-emerald-600 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
                            : "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-slate-300"
                        }
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <span className="font-medium text-slate-800">AI 보강 역할: </span>
                  {aiFilledRoles.length ? aiFilledRoles.join(", ") : "없음 (모두 인간 담당)"}
                </div>
              </section>
            )}

            {activeStory === "s2" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s2-title">
                <h2 id="s2-title" className="text-sm font-semibold text-slate-900">
                  Prompt → Spec
                </h2>
                <p className="mt-1 text-xs text-slate-500">요구 프롬프트를 입력하고 명세 초안을 생성합니다 (목업).</p>
                <textarea
                  className="mt-3 min-h-[120px] w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="예: 세션 목록 API에 필터와 페이지네이션을 추가한다…"
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800"
                    onClick={() => setPromptDraft((p) => p + "\n\n(목업) 생성된 명세 블록이 여기에 붙습니다.")}
                  >
                    명세 생성 (목업)
                  </button>
                  <button type="button" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                    승인 요청 (목업)
                  </button>
                </div>
              </section>
            )}

            {activeStory === "s3" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s3-title">
                <h2 id="s3-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GitPullRequest className="h-4 w-4" aria-hidden />
                  PR 시뮬 · 코멘트
                </h2>
                <p className="mt-1 text-xs text-slate-500">PR #12 · feature/login (목업)</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <span className="text-xs font-medium text-slate-500">Senior</span>
                    <p className="text-slate-800">에러 응답 스키마를 공통 DTO로 빼면 좋겠습니다.</p>
                  </li>
                  <li className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                    <span className="text-xs font-medium text-slate-500">QA</span>
                    <p className="text-slate-800">401/403 케이스에 대한 계약 테스트를 추가해 주세요.</p>
                  </li>
                </ul>
                <button type="button" className="mt-3 rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800">
                  반영 완료 표시 (목업)
                </button>
              </section>
            )}

            {activeStory === "s4" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s4-title">
                <h2 id="s4-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                  OpenAPI · 계약 게이트
                </h2>
                <p className="mt-1 text-xs text-slate-500">붙여넣기 후 검증·승인 (목업).</p>
                <textarea
                  className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-200 p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400"
                  value={openApiDraft}
                  onChange={(e) => setOpenApiDraft(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                    검증 (목업)
                  </button>
                  <button type="button" className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800">
                    계약 승인 (목업)
                  </button>
                </div>
              </section>
            )}

            {activeStory === "s5" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s5-title">
                <h2 id="s5-title" className="text-sm font-semibold text-slate-900">
                  회고 · KPI
                </h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    { k: "게이트 통과", v: "3/4" },
                    { k: "PR 라운드", v: "2" },
                    { k: "계약 변경", v: "1" }
                  ].map((row) => (
                    <div key={row.k} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
                      <div className="text-xs text-slate-500">{row.k}</div>
                      <div className="text-lg font-semibold text-slate-900">{row.v}</div>
                    </div>
                  ))}
                </div>
                <ul className="mt-4 list-inside list-disc text-sm text-slate-700">
                  <li>다음 스프린트: 계약 diff 알림을 더 일찍 보여주기</li>
                  <li>학습자 피드백: PR 코멘트 우선순위 태그</li>
                </ul>
                <button type="button" className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  리포트 저장 (목업)
                </button>
              </section>
            )}
          </div>
        </main>

        {/* Right: thinking + timeline */}
        <aside className="flex w-full shrink-0 flex-col gap-0 border-slate-200 bg-white lg:w-[300px] lg:border-l">
          <div className="border-b border-slate-100">
            <div className="flex items-center gap-2 px-3 py-2">
              <Sparkles className="h-4 w-4 text-amber-600" aria-hidden />
              <span className="text-sm font-medium text-slate-800">Thinking (R1)</span>
            </div>
            <ul className="max-h-[200px] space-y-1 overflow-y-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-slate-600">
              {thinkingLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100">
            <div className="flex items-center gap-2 px-3 py-2">
              <History className="h-4 w-4 text-slate-500" aria-hidden />
              <span className="text-sm font-medium text-slate-800">DoD 이벤트</span>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto px-3 pb-4 text-xs">
              {sampleTimeline.map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-2"
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] uppercase text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileCode2 className="h-3 w-3" aria-hidden />
                      {formatEventType(ev.type)}
                    </span>
                    <span>{ev.time}</span>
                  </div>
                  <p className="mt-1 text-slate-800">{ev.label}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Bot className="h-4 w-4" aria-hidden />
              에이전트 응답은 백엔드 연동 후 스트리밍됩니다.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
