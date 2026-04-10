"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getApiBaseUrl } from "../../lib/api-base";

type SimulationSession = {
  id: string;
  currentGate: string;
  implementationAcknowledgedAt?: string | null;
  learningGoal?: string;
  topic?: string;
  [key: string]: unknown;
};

type TimelineItem = {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type ScenarioRun = {
  session: SimulationSession;
  steps: string[];
  pausedForImplementation?: boolean;
};

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { code?: string; message?: string };
  if (!res.ok) {
    const msg =
      typeof data.message === "string"
        ? data.message
        : res.statusText || `HTTP ${res.status}`;
    throw new Error(`${res.status}: ${msg}`);
  }
  return data as T;
}

export default function SimulatePage() {
  const api = getApiBaseUrl();
  const [learningGoal, setLearningGoal] = useState("실무 협업 경험");
  const [topic, setTopic] = useState("로그인/회원가입 API");
  const [sprintDuration, setSprintDuration] = useState("1일");
  const [skillLevel, setSkillLevel] = useState("중급");
  const [sessionId, setSessionId] = useState("");
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [lastRun, setLastRun] = useState<ScenarioRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pollOn, setPollOn] = useState(true);

  const refresh = useCallback(async () => {
    const id = sessionId.trim();
    if (!id) {
      setSession(null);
      setTimeline([]);
      return;
    }
    const [sRes, tRes] = await Promise.all([
      fetch(`${api}/sessions/${id}`),
      fetch(`${api}/sessions/${id}/timeline`)
    ]);
    const s = await readJson<SimulationSession>(sRes);
    const t = await readJson<TimelineItem[]>(tRes);
    setSession(s);
    setTimeline(t);
  }, [api, sessionId]);

  useEffect(() => {
    if (!pollOn || !sessionId.trim()) {
      return;
    }
    let cancelled = false;
    const tick = () => {
      refresh().catch(() => {
        /* polling errors shown only on explicit actions */
      });
    };
    tick();
    const id = window.setInterval(tick, 2800);
    return () => {
      cancelled = true;
      void cancelled;
      window.clearInterval(id);
    };
  }, [pollOn, sessionId, refresh]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setError(null);
    setBusy(label);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", margin: "32px auto", maxWidth: 920, padding: "0 16px" }}>
      <p style={{ marginBottom: 8 }}>
        <Link href="/" style={{ color: "#2563eb" }}>
          ← 홈
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>시뮬레이션 콘솔</h1>
      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
        채팅·푸시 대신 <strong>폴링</strong>(약 2.8초)으로 세션과 타임라인을 갱신합니다. 흐름은{" "}
        <strong>인트로 → 구현 완료 표시 → 검증 → 마무리 AI</strong> 순입니다.
      </p>

      <section
        style={{
          marginTop: 20,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>1) 세션 만들기</h2>
        <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
          <label>
            학습 목표
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
            />
          </label>
          <label>
            주제
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </label>
          <label>
            스프린트
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
              value={sprintDuration}
              onChange={(e) => setSprintDuration(e.target.value)}
            />
          </label>
          <label>
            숙련도
            <input
              style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
              value={skillLevel}
              onChange={(e) => setSkillLevel(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          style={{ marginTop: 12, padding: "10px 16px", cursor: "pointer" }}
          disabled={!!busy}
          onClick={() =>
            run("create", async () => {
              const res = await fetch(`${api}/sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  learningGoal: learningGoal.trim(),
                  topic: topic.trim(),
                  sprintDuration: sprintDuration.trim(),
                  skillLevel: skillLevel.trim()
                })
              });
              const row = await readJson<SimulationSession>(res);
              setSessionId(row.id);
              setLastRun(null);
            })
          }
        >
          POST /sessions
        </button>
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>2) 세션 ID · 폴링</h2>
        <label>
          session id (UUID)
          <input
            style={{ display: "block", width: "100%", maxWidth: 480, marginTop: 4, padding: 8 }}
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            placeholder="생성 후 자동 입력됩니다"
          />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={pollOn} onChange={(e) => setPollOn(e.target.checked)} />
          폴링 켜기
        </label>
        <button
          type="button"
          style={{ marginLeft: 12, padding: "8px 14px", cursor: "pointer" }}
          disabled={!!busy || !sessionId.trim()}
          onClick={() => run("refresh", refresh)}
        >
          지금 새로고침
        </button>
        {timeline.length > 0 && (
          <span style={{ marginLeft: 12, color: "#6b7280", fontSize: 14 }}>
            타임라인 {timeline.length}건 (폴링으로 갱신)
          </span>
        )}
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>3) 단계별 API</h2>
        <p style={{ marginTop: 0, fontSize: 14, color: "#6b7280" }}>
          Gate: {session?.currentGate ?? "—"} · 구현 확인 시각:{" "}
          {session?.implementationAcknowledgedAt
            ? new Date(String(session.implementationAcknowledgedAt)).toLocaleString()
            : "없음"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            disabled={!!busy || !sessionId.trim()}
            onClick={() =>
              run("intro", async () => {
                const res = await fetch(`${api}/sessions/${sessionId.trim()}/run-scenario`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" }
                });
                setLastRun(await readJson<ScenarioRun>(res));
              })
            }
          >
            인트로 (run-scenario)
          </button>
          <button
            type="button"
            disabled={!!busy || !sessionId.trim()}
            onClick={() =>
              run("impl-ready", async () => {
                const res = await fetch(
                  `${api}/sessions/${sessionId.trim()}/implementation-ready`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({})
                  }
                );
                await readJson(res);
              })
            }
          >
            구현 완료 (implementation-ready)
          </button>
          <button
            type="button"
            disabled={!!busy || !sessionId.trim()}
            onClick={() =>
              run("verify", async () => {
                const res = await fetch(`${api}/sessions/${sessionId.trim()}/verify`, {
                  method: "POST"
                });
                await readJson(res);
              })
            }
          >
            검증 (verify)
          </button>
          <button
            type="button"
            disabled={!!busy || !sessionId.trim()}
            onClick={() =>
              run("finish", async () => {
                const res = await fetch(
                  `${api}/sessions/${sessionId.trim()}/run-scenario/finish`,
                  { method: "POST" }
                );
                setLastRun(await readJson<ScenarioRun>(res));
              })
            }
          >
            마무리 AI (run-scenario/finish)
          </button>
          <button
            type="button"
            disabled={!!busy || !sessionId.trim()}
            style={{ borderColor: "#f97316", color: "#c2410c" }}
            onClick={() => {
              if (
                !window.confirm(
                  "데모: skipImplementationWait 로 한 번에 끝까지 돌립니다. 계속할까요?"
                )
              ) {
                return;
              }
              run("skip-demo", async () => {
                const res = await fetch(`${api}/sessions/${sessionId.trim()}/run-scenario`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ skipImplementationWait: true })
                });
                setLastRun(await readJson<ScenarioRun>(res));
              });
            }}
          >
            원샷 데모 (skip)
          </button>
        </div>
        {lastRun && (
          <pre
            style={{
              marginTop: 12,
              padding: 12,
              background: "#f9fafb",
              fontSize: 12,
              overflow: "auto",
              maxHeight: 200,
              borderRadius: 6
            }}
          >
            {JSON.stringify(
              {
                steps: lastRun.steps,
                pausedForImplementation: lastRun.pausedForImplementation,
                gate: lastRun.session?.currentGate
              },
              null,
              2
            )}
          </pre>
        )}
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>타임라인 (알림 대체)</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 320, overflow: "auto" }}>
          {timeline.length === 0 && <li style={{ color: "#9ca3af" }}>이벤트 없음</li>}
          {[...timeline].reverse().map((ev) => (
            <li
              key={ev.id}
              style={{
                borderBottom: "1px solid #f3f4f6",
                padding: "8px 0",
                fontSize: 13
              }}
            >
              <strong>{ev.eventType}</strong>
              <span style={{ color: "#9ca3af", marginLeft: 8 }}>
                {new Date(ev.createdAt).toLocaleTimeString()}
              </span>
              <div style={{ color: "#4b5563", marginTop: 4, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(ev.payload).slice(0, 280)}
                {JSON.stringify(ev.payload).length > 280 ? "…" : ""}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {busy && <p style={{ color: "#2563eb" }}>진행 중: {busy}…</p>}
      {error && (
        <p style={{ color: "#b91c1c", whiteSpace: "pre-wrap" }} role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
