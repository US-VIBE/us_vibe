"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatMarkdownBody } from "@/components/chat-markdown";
import { getApiBaseUrl } from "../../lib/api-base";
import styles from "./simulate-page.module.css";

type SimulationSession = {
  id: string;
  currentGate: string;
  implementationAcknowledgedAt?: string | null;
  learningGoal?: string;
  topic?: string;
  scenarioId?: string | null;
  briefing?: Record<string, unknown>;
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

type EnvStatus = {
  apiOk: boolean | null;
  dbOk: boolean | null;
  checkedAt: string | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

async function fetchSessionSafe(api: string, id: string): Promise<SimulationSession | null> {
  try {
    const res = await fetch(`${api}/sessions/${id}`);
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as SimulationSession;
  } catch {
    return null;
  }
}

async function waitForGate(
  api: string,
  sessionId: string,
  want: string,
  timeoutMs: number,
  cancel: () => boolean
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (cancel()) {
      return false;
    }
    const s = await fetchSessionSafe(api, sessionId);
    if (s?.currentGate === want) {
      return true;
    }
    await sleep(900);
  }
  return false;
}

function stepRow(
  n: number,
  title: string,
  detail: string,
  active: boolean,
  done: boolean,
  blockedReason: string | null
) {
  const color = done ? "#059669" : active ? "#2563eb" : "#9ca3af";
  const mark = done ? "✓" : active ? "→" : `${n}.`;
  return (
    <li
      style={{
        marginBottom: 10,
        color: blockedReason ? "#6b7280" : "#111827",
        listStyle: "none",
        paddingLeft: 0
      }}
      title={blockedReason ?? undefined}
    >
      <span style={{ color, fontWeight: done || active ? 700 : 400, marginRight: 8 }}>{mark}</span>
      <strong>{title}</strong>
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2, marginLeft: 24 }}>{detail}</div>
      {blockedReason && (
        <div style={{ fontSize: 12, color: "#b45309", marginTop: 4, marginLeft: 24 }}>{blockedReason}</div>
      )}
    </li>
  );
}

function chatBubble(ev: TimelineItem) {
  const time = new Date(ev.createdAt).toLocaleTimeString();
  if (ev.eventType === "user_message") {
    const text = String((ev.payload as { text?: string }).text ?? "");
    return (
      <div key={ev.id} style={{ marginBottom: 12, textAlign: "right" }}>
        <div
          style={{
            display: "inline-block",
            maxWidth: "88%",
            padding: "10px 12px",
            borderRadius: 12,
            background: "#dbeafe",
            color: "#1e3a8a",
            textAlign: "left",
            fontSize: 14
          }}
        >
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>학습자 · {time}</div>
          {text.trim() ? (
            <ChatMarkdownBody
              text={text}
              className="text-sm text-[#1e3a8a] [&_a]:text-blue-700 [&_code]:bg-blue-100/90 [&_pre]:bg-blue-100/50"
            />
          ) : (
            <span style={{ fontSize: 14 }}>(빈 메시지)</span>
          )}
        </div>
      </div>
    );
  }
  if (ev.eventType === "scenario_briefing_published") {
    const md = String((ev.payload as { checklistMarkdown?: string }).checklistMarkdown ?? "");
    return (
      <div key={ev.id} style={{ marginBottom: 12, textAlign: "left" }}>
        <div
          style={{
            display: "inline-block",
            maxWidth: "92%",
            padding: "10px 12px",
            borderRadius: 12,
            background: "#ecfdf5",
            color: "#064e3b",
            fontSize: 13,
            textAlign: "left"
          }}
        >
          <div style={{ fontSize: 11, color: "#047857", marginBottom: 4 }}>시나리오 브리핑 · {time}</div>
          {md.trim() ? (
            <ChatMarkdownBody
              text={md}
              className="text-[13px] text-[#064e3b] [&_a]:text-emerald-800 [&_code]:bg-emerald-100/80 [&_pre]:bg-emerald-100/60"
            />
          ) : (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13 }}>
              {JSON.stringify(ev.payload)}
            </pre>
          )}
        </div>
      </div>
    );
  }
  if (ev.eventType === "agent_reply") {
    const role = String((ev.payload as { role?: string }).role ?? "AI");
    const raw = String((ev.payload as { text?: string }).text ?? JSON.stringify(ev.payload));
    const clipped = raw.length > 12000 ? `${raw.slice(0, 12000)}\n\n…(일부 생략)` : raw;
    return (
      <div key={ev.id} style={{ marginBottom: 12, textAlign: "left" }}>
        <div
          style={{
            display: "inline-block",
            maxWidth: "88%",
            padding: "10px 12px",
            borderRadius: 12,
            background: "#f1f5f9",
            color: "#0f172a",
            fontSize: 14
          }}
        >
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>
            {role} · {time}
          </div>
          <ChatMarkdownBody
            text={clipped}
            className="text-sm text-[#0f172a] [&_a]:text-violet-700 [&_code]:bg-slate-200/90 [&_pre]:bg-slate-200/80"
          />
        </div>
      </div>
    );
  }
  return (
    <div
      key={ev.id}
      style={{
        marginBottom: 8,
        fontSize: 12,
        color: "#64748b",
        textAlign: "center"
      }}
    >
      [{ev.eventType}] {time}
    </div>
  );
}

export default function SimulatePage() {
  const api = getApiBaseUrl();
  const [learningGoal, setLearningGoal] = useState("");
  const [topic, setTopic] = useState("로그인/회원가입 API");
  const [scenarioId, setScenarioId] = useState("");
  const [sprintDuration, setSprintDuration] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [session, setSession] = useState<SimulationSession | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [lastRun, setLastRun] = useState<ScenarioRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pollOn, setPollOn] = useState(true);
  const [env, setEnv] = useState<EnvStatus>({ apiOk: null, dbOk: null, checkedAt: null });

  const [notifyDesktop, setNotifyDesktop] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission | "unsupported">("default");
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  /** When this differs from `sessionId.trim()`, timeline is (re)seeded without notifying. */
  const lastNotifySeedKeyRef = useRef("");

  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const autoRunLatchRef = useRef(false);
  const autoCancelRef = useRef(false);

  const [chatDraft, setChatDraft] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const id = sessionId.trim();
    if (!api) {
      setSession(null);
      setTimeline([]);
      return;
    }
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
    let cancelled = false;
    const checkEnv = async () => {
      if (!api) {
        if (!cancelled) {
          setEnv({
            apiOk: false,
            dbOk: false,
            checkedAt: new Date().toLocaleTimeString()
          });
        }
        return;
      }
      try {
        const h = await fetch(`${api}/health`);
        const hJson = (await h.json()) as { ok?: boolean };
        const apiOk = h.ok && hJson.ok === true;
        const d = await fetch(`${api}/health/db`);
        const dJson = (await d.json()) as { database?: string };
        const dbOk = d.ok && dJson.database === "up";
        if (!cancelled) {
          setEnv({ apiOk, dbOk, checkedAt: new Date().toLocaleTimeString() });
        }
      } catch {
        if (!cancelled) {
          setEnv({ apiOk: false, dbOk: false, checkedAt: new Date().toLocaleTimeString() });
        }
      }
    };
    checkEnv();
    const envId = window.setInterval(checkEnv, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(envId);
    };
  }, [api]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyPermission("unsupported");
      return;
    }
    setNotifyPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!notifyDesktop) {
      lastNotifySeedKeyRef.current = "";
    }
  }, [notifyDesktop]);

  useEffect(() => {
    lastNotifySeedKeyRef.current = "";
    seenEventIdsRef.current.clear();
  }, [sessionId]);

  useEffect(() => {
    if (!notifyDesktop || notifyPermission !== "granted" || timeline.length === 0) {
      return;
    }
    const key = sessionId.trim();
    if (!key) {
      return;
    }
    if (lastNotifySeedKeyRef.current !== key) {
      seenEventIdsRef.current = new Set(timeline.map((e) => e.id));
      lastNotifySeedKeyRef.current = key;
      return;
    }
    for (const ev of timeline) {
      if (seenEventIdsRef.current.has(ev.id)) {
        continue;
      }
      seenEventIdsRef.current.add(ev.id);
      const interesting =
        ev.eventType === "agent_reply" ||
        ev.eventType === "implementation_acknowledged" ||
        ev.eventType === "user_message" ||
        ev.eventType === "retro_complete";
      if (interesting) {
        try {
          const title =
            ev.eventType === "agent_reply"
              ? `에이전트 (${String((ev.payload as { role?: string }).role ?? "")})`
              : ev.eventType;
          const body =
            ev.eventType === "agent_reply"
              ? String((ev.payload as { text?: string }).text ?? "").slice(0, 120)
              : ev.eventType;
          new Notification(title, { body, tag: ev.id });
        } catch {
          /* ignore */
        }
      }
    }
  }, [timeline, notifyDesktop, notifyPermission, sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  useEffect(() => {
    if (!pollOn || !sessionId.trim()) {
      return;
    }
    const tick = () => {
      refresh().catch(() => {});
    };
    tick();
    const id = window.setInterval(tick, 2800);
    return () => window.clearInterval(id);
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

  const requestNotifyPermission = async () => {
    if (!("Notification" in window)) {
      setError("이 브라우저는 Notification API를 지원하지 않습니다.");
      return;
    }
    const p = await Notification.requestPermission();
    setNotifyPermission(p);
    if (p !== "granted") {
      setNotifyDesktop(false);
    } else {
      lastNotifySeedKeyRef.current = "";
    }
  };

  const stopAuto = () => {
    autoCancelRef.current = true;
    autoRunLatchRef.current = false;
    setAutoRunning(false);
    setAutoStatus("중지됨");
    setBusy(null);
  };

  const startAuto = async () => {
    if (autoRunLatchRef.current) {
      return;
    }
    if (!(env.apiOk === true && env.dbOk === true)) {
      setError("API/DB 헬스가 통과한 뒤 자동 완주를 시작하세요.");
      return;
    }
    autoCancelRef.current = false;
    autoRunLatchRef.current = true;
    setAutoRunning(true);
    setError(null);
    setAutoStatus("자동 완주 준비…");

    const cancel = () => autoCancelRef.current;

    try {
      let sid = sessionId.trim();
      if (!sid) {
        setBusy("자동: 세션 생성");
        const res = await fetch(`${api}/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim(),
            scenarioId: scenarioId.trim() || undefined,
            ...(learningGoal.trim() && sprintDuration.trim() && skillLevel.trim()
              ? {
                  learningGoal: learningGoal.trim(),
                  sprintDuration: sprintDuration.trim(),
                  skillLevel: skillLevel.trim()
                }
              : {})
          })
        });
        const row = await readJson<SimulationSession>(res);
        sid = row.id;
        setSessionId(sid);
        await sleep(1200);
      }
      if (cancel()) {
        return;
      }

      setAutoStatus("Gate A 대기…");
      const okA = await waitForGate(api, sid, "A", 45000, cancel);
      if (!okA || cancel()) {
        throw new Error("Gate A로 진입하지 못했습니다(세션 확인).");
      }
      await refresh();

      const s0 = await fetchSessionSafe(api, sid);
      if (s0?.currentGate === "A") {
        setBusy("자동: 인트로");
        setAutoStatus("인트로(Gemini)…");
        const res = await fetch(`${api}/sessions/${sid}/run-scenario`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        setLastRun(await readJson<ScenarioRun>(res));
        await sleep(1600);
      }
      if (cancel()) {
        return;
      }

      setAutoStatus("Gate B 대기…");
      const okB = await waitForGate(api, sid, "B", 120000, cancel);
      if (!okB || cancel()) {
        throw new Error("Gate B로 전환되지 않았습니다(인트로 실패 또는 중지).");
      }

      setBusy("자동: 구현 완료 표시");
      setAutoStatus("구현 완료 API…");
      const r1 = await fetch(`${api}/sessions/${sid}/implementation-ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      await readJson(r1);
      await sleep(1200);
      if (cancel()) {
        return;
      }

      setBusy("자동: 검증");
      setAutoStatus("검증…");
      const r2 = await fetch(`${api}/sessions/${sid}/verify`, { method: "POST" });
      await readJson(r2);
      await sleep(1200);
      if (cancel()) {
        return;
      }

      setAutoStatus("Gate C 대기…");
      const okC = await waitForGate(api, sid, "C", 60000, cancel);
      if (!okC || cancel()) {
        throw new Error("Gate C로 전환되지 않았습니다(검증 실패?).");
      }

      setBusy("자동: 마무리 AI");
      setAutoStatus("마무리(Gemini)…");
      const r3 = await fetch(`${api}/sessions/${sid}/run-scenario/finish`, { method: "POST" });
      setLastRun(await readJson<ScenarioRun>(r3));
      await sleep(1200);

      setAutoStatus("완료(DONE 확인 중)…");
      await waitForGate(api, sid, "DONE", 180000, cancel);
      await refresh();
      setAutoStatus("자동 완주 끝 — Gate DONE");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setAutoStatus("자동 완주 오류");
    } finally {
      autoRunLatchRef.current = false;
      setAutoRunning(false);
      setBusy(null);
    }
  };

  const sendUserMessage = () => {
    const id = sessionId.trim();
    const t = chatDraft.trim();
    if (!id || !t) {
      return;
    }
    run("chat", async () => {
      const res = await fetch(`${api}/collaboration/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "user_message",
          payload: { text: t },
          sessionId: id
        })
      });
      await readJson<{ id: string; createdAt: string }>(res);
      setChatDraft("");
    });
  };

  const gate = session?.currentGate;
  const ack = Boolean(session?.implementationAcknowledgedAt);
  const sid = sessionId.trim();

  const envReady = env.apiOk === true && env.dbOk === true;
  const sessionLoaded = Boolean(sid && session && session.id === sid);

  const canCreate = envReady && !busy && !autoRunning;
  const canIntro =
    Boolean(sid) && sessionLoaded && gate === "A" && !busy && envReady && !autoRunning;
  const canImplReady =
    Boolean(sid) && sessionLoaded && gate === "B" && !ack && !busy && envReady && !autoRunning;
  const canVerify =
    Boolean(sid) && sessionLoaded && gate === "B" && ack && !busy && envReady && !autoRunning;
  const canFinish =
    Boolean(sid) && sessionLoaded && gate === "C" && !busy && envReady && !autoRunning;
  const canSkip =
    Boolean(sid) && sessionLoaded && gate === "A" && !busy && envReady && !autoRunning;

  const introBlock =
    sid && !sessionLoaded
      ? "세션 정보를 불러오려면 폴링을 켜거나 「지금 새로고침」을 누르세요."
      : gate !== "A"
        ? `인트로는 Gate A에서만 가능합니다. (현재 ${gate ?? "—"})`
        : !envReady
          ? "API/DB 헬스가 통과해야 합니다."
          : null;

  const implBlock =
    gate !== "B"
      ? `구현 완료 표시는 Gate B에서만 가능합니다. (현재 ${gate ?? "—"})`
      : ack
        ? "이미 구현 완료로 표시되었습니다."
        : !envReady
          ? "API/DB 헬스가 통과해야 합니다."
          : null;

  const verifyBlock =
    gate !== "B"
      ? `검증은 Gate B에서만 가능합니다. (현재 ${gate ?? "—"})`
      : !ack
        ? "먼저 「구현 완료」를 눌러 implementation-ready를 보내세요."
        : !envReady
          ? "API/DB 헬스가 통과해야 합니다."
          : null;

  const finishBlock =
    gate !== "C"
      ? `마무리 AI는 Gate C에서만 가능합니다. (현재 ${gate ?? "—"})`
      : !envReady
        ? "API/DB 헬스가 통과해야 합니다."
        : null;

  const skipBlock =
    gate !== "A"
      ? `원샷 데모는 Gate A에서만 권장합니다. (현재 ${gate ?? "—"})`
      : !envReady
        ? "API/DB 헬스가 통과해야 합니다."
        : null;

  const step1Done = Boolean(sid);
  const step2Done = gate && gate !== "A";
  const step3Done = ack;
  const step4Done = gate === "C" || gate === "D" || gate === "DONE";
  const step5Done = gate === "DONE";

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        margin: "32px auto",
        maxWidth: 1180,
        padding: "0 16px"
      }}
    >
      <p style={{ marginBottom: 8 }}>
        <Link href="/" style={{ color: "#2563eb" }}>
          ← 홈
        </Link>
      </p>
      <h1 style={{ marginTop: 0 }}>시뮬레이션 콘솔</h1>
      <p style={{ color: "#4b5563", lineHeight: 1.5 }}>
        <strong>자동 완주</strong>(버튼 없이 순서 실행), <strong>데스크톱 알림</strong>(새 타임라인),{" "}
        <strong>채팅 뷰</strong>(타임라인 + 학습자 메시지)를 한 화면에서 씁니다. 모바일 푸시·서버 Web Push는 포함하지
        않습니다.
      </p>
      {!api ? (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            background: "#fef2f2",
            borderRadius: 8,
            border: "1px solid #fecaca",
            color: "#7f1d1d",
            fontSize: 14,
            lineHeight: 1.55
          }}
        >
          <strong>Nest API 주소가 설정되지 않았습니다.</strong> Netlify(또는 Next 호스팅)에{" "}
          <code style={{ background: "#fee2e2", padding: "2px 6px", borderRadius: 4 }}>
            NEXT_PUBLIC_API_URL
          </code>{" "}
          (필요 시{" "}
          <code style={{ background: "#fee2e2", padding: "2px 6px", borderRadius: 4 }}>
            NEXT_PUBLIC_API_BASE_URL
          </code>
          )에 Render/Fly 등에 둔 API의 <code>https://…</code> 를 넣고 <strong>다시 배포</strong>하세요. 로컬은{" "}
          <code>apps/web/.env.local</code> 입니다.
        </section>
      ) : null}
      <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.5 }}>
        <strong>시뮬만 쓰기:</strong> 이 화면은 Postgres 시뮬·타임라인 중심입니다.{" "}
        <Link href="/" style={{ color: "#2563eb" }}>
          온보딩·워크스페이스
        </Link>
        에서 동일 <code>sessionId</code>로 시작하면 웹훅 SQLite 이벤트와 통합 타임라인을 맞추기 쉽습니다. 서버{" "}
        <code>INTEGRATION_WEBHOOK_SESSION_ID</code>는 워크스페이스 연동 패널의 BFF 힌트로 복사할 수 있습니다(
        <code>docs/integration-sandbox/session-id-sync.md</code>).
      </p>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          background: "#ecfdf5",
          borderRadius: 8,
          border: "1px solid #6ee7b7"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>무인 · 자동 완주</h2>
        <p style={{ fontSize: 14, color: "#166534", marginTop: 0 }}>
          세션 생성 → 인트로 → 구현 완료 → 검증 → 마무리까지 브라우저에서 순서대로 호출합니다. 중간에「중지」가
          가능합니다. (Gemini·검증 실패 시 여기서 멈춥니다.)
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            style={{ padding: "10px 16px", cursor: envReady && !autoRunning ? "pointer" : "not-allowed" }}
            disabled={!envReady || autoRunning}
            onClick={() => void startAuto()}
          >
            자동 완주 시작
          </button>
          <button type="button" style={{ padding: "10px 16px" }} onClick={stopAuto}>
            자동 완주 중지
          </button>
          {autoStatus && (
            <span style={{ fontSize: 14, color: "#14532d" }}>
              상태: <strong>{autoStatus}</strong>
            </span>
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          background: "#eff6ff",
          borderRadius: 8,
          border: "1px solid #93c5fd"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>푸시 대체: 데스크톱 알림</h2>
        <p style={{ fontSize: 14, color: "#1e3a8a", marginTop: 0 }}>
          OS 알림으로 새 <code>agent_reply</code> 등을 알립니다. (브라우저 탭이 백그라운드여도 동작) 모바일 앱 푸시는
          아닙니다.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {notifyPermission === "unsupported" ? (
            <span style={{ color: "#64748b" }}>이 환경에서는 알림을 쓸 수 없습니다.</span>
          ) : (
            <>
              <button type="button" onClick={() => void requestNotifyPermission()}>
                알림 권한 요청
              </button>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={notifyDesktop}
                  disabled={notifyPermission !== "granted"}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNotifyDesktop(next);
                    if (next) {
                      lastNotifySeedKeyRef.current = "";
                    }
                  }}
                />
                새 타임라인 이벤트 알림 ({notifyPermission})
              </label>
            </>
          )}
        </div>
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          background: "#fffbeb",
          borderRadius: 8,
          border: "1px solid #fcd34d"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>운영 · 환경</h2>
        <ul style={{ margin: "8px 0", paddingLeft: 20, color: "#44403c", fontSize: 14 }}>
          <li>
            루트 <code>.env</code>에 <code>DATABASE_URL</code>, (AI 사용 시) <code>GEMINI_API_KEY</code>
          </li>
          <li>
            터미널: <code>npm run dev:stack</code> 또는 DB 기동 + <code>npm run migrate</code> 후 API
          </li>
          <li>
            이 페이지 API 주소: <code>{api || "(미설정)"}</code> — 로컬은{" "}
            <code>apps/web/.env.local</code>, Netlify는 Site → Environment variables 의{" "}
            <code>NEXT_PUBLIC_API_URL</code>
          </li>
        </ul>
        <p style={{ margin: "8px 0 0", fontSize: 14 }}>
          <strong>/health</strong>:{" "}
          {env.apiOk === null ? "확인 중…" : env.apiOk ? "정상" : "실패"}{" "}
          <strong style={{ marginLeft: 16 }}>/health/db</strong>:{" "}
          {env.dbOk === null ? "확인 중…" : env.dbOk ? "up" : "down"}
          {env.checkedAt && (
            <span style={{ color: "#78716c", marginLeft: 12 }}>마지막 확인 {env.checkedAt}</span>
          )}
        </p>
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
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>권장 순서 (게이트)</h2>
        <ol style={{ paddingLeft: 0, margin: 0 }}>
          {stepRow(
            1,
            "세션 만들기",
            "POST /sessions (주제 필수, 시나리오 팩 기본값) → Gate A",
            !step1Done && !busy,
            step1Done,
            null
          )}
          {stepRow(
            2,
            "인트로 (Gemini)",
            "POST /run-scenario → Gate B, 구현 대기",
            step1Done && !step2Done && gate === "A",
            Boolean(step2Done),
            step1Done && gate === "A" ? null : step1Done ? null : "세션 ID 필요"
          )}
          {stepRow(
            3,
            "구현 완료 표시",
            "POST /implementation-ready (Gate B)",
            gate === "B" && !ack,
            step3Done,
            gate === "B" && !ack ? null : gate === "B" && ack ? "완료됨" : "Gate B에서 진행"
          )}
          {stepRow(
            4,
            "검증",
            "POST /verify → Gate C",
            gate === "B" && ack,
            step4Done,
            null
          )}
          {stepRow(
            5,
            "마무리 AI",
            "POST /run-scenario/finish → DONE",
            gate === "C",
            step5Done,
            null
          )}
        </ol>
        {gate === "DONE" && (
          <p style={{ color: "#059669", fontWeight: 600, marginTop: 12 }}>시나리오 완료 (Gate DONE)</p>
        )}
      </section>

      <div className={styles.layout}>
        <div>
          <section
            style={{
              padding: 16,
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #e5e7eb"
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>1) 세션 만들기</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>
              주제만으로 생성하면 시나리오 팩이 목표·스프린트·숙련도를 채웁니다. 아래 세 칸을{" "}
              <strong>모두</strong> 채우면 수동으로 덮어씁니다.
            </p>
            <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
              <label>
                주제 (필수)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </label>
              <label>
                시나리오 ID (선택, 예: login-mvp)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                  placeholder="비우면 주제 키워드로 자동"
                />
              </label>
              <label>
                학습 목표 (선택·수동 덮어쓰기)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                  value={learningGoal}
                  onChange={(e) => setLearningGoal(e.target.value)}
                  placeholder="비우면 팩 기본값"
                />
              </label>
              <label>
                스프린트 (선택)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                  value={sprintDuration}
                  onChange={(e) => setSprintDuration(e.target.value)}
                  placeholder="예: 3일"
                />
              </label>
              <label>
                숙련도 (선택)
                <input
                  style={{ display: "block", width: "100%", marginTop: 4, padding: 8 }}
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value)}
                  placeholder="예: intermediate"
                />
              </label>
            </div>
            <button
              type="button"
              style={{ marginTop: 12, padding: "10px 16px", cursor: canCreate ? "pointer" : "not-allowed" }}
              disabled={!canCreate}
              title={!envReady ? "API/DB 헬스 통과 후 사용하세요." : undefined}
              onClick={() =>
                run("create", async () => {
                  const res = await fetch(`${api}/sessions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      topic: topic.trim(),
                      scenarioId: scenarioId.trim() || undefined,
                      ...(learningGoal.trim() && sprintDuration.trim() && skillLevel.trim()
                        ? {
                            learningGoal: learningGoal.trim(),
                            sprintDuration: sprintDuration.trim(),
                            skillLevel: skillLevel.trim()
                          }
                        : {})
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
              폴링 켜기 (게이트 판별에 필요)
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
                타임라인 {timeline.length}건
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
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>3) 단계별 API (순서 잠금)</h2>
            <p style={{ marginTop: 0, fontSize: 14, color: "#6b7280" }}>
              Gate: {session?.currentGate ?? "—"} · 구현 확인 시각:{" "}
              {session?.implementationAcknowledgedAt
                ? new Date(String(session.implementationAcknowledgedAt)).toLocaleString()
                : "없음"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                disabled={!canIntro}
                title={introBlock ?? undefined}
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
                disabled={!canImplReady}
                title={implBlock ?? undefined}
                onClick={() =>
                  run("impl-ready", async () => {
                    const res = await fetch(`${api}/sessions/${sessionId.trim()}/implementation-ready`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({})
                    });
                    await readJson(res);
                  })
                }
              >
                구현 완료 (implementation-ready)
              </button>
              <button
                type="button"
                disabled={!canVerify}
                title={verifyBlock ?? undefined}
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
                disabled={!canFinish}
                title={finishBlock ?? undefined}
                onClick={() =>
                  run("finish", async () => {
                    const res = await fetch(`${api}/sessions/${sessionId.trim()}/run-scenario/finish`, {
                      method: "POST"
                    });
                    setLastRun(await readJson<ScenarioRun>(res));
                  })
                }
              >
                마무리 AI (run-scenario/finish)
              </button>
              <button
                type="button"
                disabled={!canSkip}
                title={skipBlock ?? undefined}
                style={{ borderColor: "#f97316", color: "#c2410c" }}
                onClick={() => {
                  if (
                    !window.confirm(
                      "데모: skipImplementationWait 로 한 번에 끝까지 돌립니다. 순서 연습에는 일반 버튼을 쓰세요. 계속할까요?"
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
        </div>

        <section className={styles.chatCol}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>채팅 (타임라인)</h2>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>
            <code>user_message</code> / <code>agent_reply</code> 위주로 표시합니다.
          </p>
          <div
            className={styles.chatScroll}
            style={{
              minHeight: 280,
              padding: "8px 4px",
              background: "#fafafa",
              borderRadius: 8
            }}
          >
            {sortedTimeline.length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 14 }}>이벤트 없음 — 세션을 만들고 인트로를 실행해 보세요.</p>
            )}
            {sortedTimeline.map((ev) => chatBubble(ev))}
            <div ref={chatEndRef} />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <input
              style={{ flex: 1, padding: 8 }}
              placeholder={sessionId.trim() ? "학습자 메시지…" : "먼저 세션 ID를 만드세요"}
              value={chatDraft}
              disabled={!sessionId.trim() || !!busy || autoRunning}
              onChange={(e) => setChatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendUserMessage();
                }
              }}
            />
            <button type="button" disabled={!sessionId.trim() || !!busy || autoRunning} onClick={() => void sendUserMessage()}>
              전송
            </button>
          </div>
        </section>
      </div>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
          border: "1px solid #e5e7eb"
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>타임라인 (원시)</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 240, overflow: "auto" }}>
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
