"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileCode2,
  GitPullRequest,
  History,
  LayoutGrid,
  Lock,
  LogOut,
  MessageSquare,
  Sparkles,
  Users,
  XCircle
} from "lucide-react";
import type { StoryTabId } from "@/lib/workspace-types";
import type { LearningSession } from "@/lib/session-types";
import { proficiencyLabel } from "@/lib/proficiency-labels";
import { fetchRoleGapSnapshot } from "@/lib/role-gap-service";
import type { RoleGapSnapshot } from "@/lib/role-gap-types";
import { buildDodTimeline, buildSprintCheckpoints, type TimelineEntry } from "@/lib/sprint-progress";
import { buildThinkingR1Lines } from "@/lib/thinking-r1";
import { convertPromptToSpec, approvePromptSpec } from "@/lib/prompt-spec-service";
import type { SpecConversionResult } from "@/lib/prompt-spec-types";
import { clearPersistedSpec, loadPersistedSpec, savePersistedSpec } from "@/lib/spec-persist";
import {
  createIdlePrSnapshot,
  fetchPrReviewSnapshot,
  submitPr,
  patchPrComment,
  requestPrReReview,
  finalApprovePr
} from "@/lib/pr-review-service";
import type { CommentReflectionStatus, PrReviewSnapshot } from "@/lib/pr-review-types";
import { clearPrReview, loadPrReview, savePrReview } from "@/lib/pr-persist";
import {
  approveContractGate,
  ContractGateError,
  isValidationPassing,
  validateOpenApiContract
} from "@/lib/contract-gate-service";
import type { ValidationResult } from "@/lib/contract-gate-service";
import { clearContractGate, loadContractGate, saveContractGate } from "@/lib/contract-persist";
import { fetchRetroReports, generateRetroReport } from "@/lib/retro-service";
import type { RetroReport } from "@/lib/retro-types";
import { clearRetroPersist, loadRetroPersist, saveRetroPersist } from "@/lib/retro-persist";
import { fetchAgentReply } from "@/lib/chat-ai";
import type { ChatMessage } from "@/lib/chat-types";
import { IntegrationEventsPanel } from "@/components/workspace/integration-events-panel";
import { IntegrationToolsPanel } from "@/components/workspace/integration-tools-panel";

export type { ChatMessage };

const DEFAULT_OPENAPI_YAML = "openapi: 3.0.0\ninfo:\n  title: Session API\npaths: {}\n";

const storyTabs: { id: StoryTabId; label: string; short: string }[] = [
  { id: "s1", label: "스토리1 · 역할·게이트", short: "역할" },
  { id: "s2", label: "스토리2 · Prompt→Spec", short: "명세" },
  { id: "s3", label: "스토리3 · PR 시뮬", short: "PR" },
  { id: "s4", label: "스토리4 · 계약 게이트", short: "계약" },
  { id: "s5", label: "스토리5 · 회고", short: "회고" },
  { id: "s6", label: "연동 · CI/이벤트", short: "연동" }
];

const TABS_AFTER_SPEC_APPROVAL: StoryTabId[] = ["s3", "s4", "s5"];

function isStoryLocked(tab: StoryTabId, specApproved: boolean): boolean {
  if (specApproved) return false;
  return TABS_AFTER_SPEC_APPROVAL.includes(tab);
}

function formatEventType(t: TimelineEntry["type"]): string {
  return t.replace(/_/g, " ");
}

function buildInitialChatMessages(session: LearningSession, snap: RoleGapSnapshot): ChatMessage[] {
  const pm = snap.injectedAgents.find((a) => a.role === "PM") ?? snap.injectedAgents[0];
  const names = snap.injectedAgents.map((a) => a.displayName).join(", ");
  const human = snap.humanRoleLabels.length ? snap.humanRoleLabels.join(", ") : "학습자";
  const out: ChatMessage[] = [
    {
      id: "sys-sync",
      kind: "system",
      text: `역할 결손을 서버 스냅샷과 동기화했습니다. (stateVersion ${snap.stateVersion})`
    },
    {
      id: "sys-participants",
      kind: "system",
      text: `채널 참여: ${human} · 에이전트 ${names}`
    }
  ];
  if (pm) {
    out.push({
      id: "agent-kickoff",
      kind: "agent",
      agentId: pm.agentId,
      agentLabel: pm.role,
      displayName: pm.displayName,
      text: `안녕하세요, ${pm.displayName}입니다. 주제「${session.topic}」, 목표「${session.goal}」로 이해했습니다. 스프린트 ${session.sprintDays}일 · ${proficiencyLabel(session.proficiency)} 기준으로 진행할게요.`
    });
  }
  return out;
}

export type WorkspaceAppProps = {
  session: LearningSession;
  onLeaveSession: () => void;
  /** API 연동 시 로그인 사용자 */
  authUser?: { email: string; role: string };
  /** 계정 로그아웃(토큰 삭제) — 세션 스토리지도 함께 비움 */
  onAuthLogout?: () => void;
};

export function WorkspaceApp({
  session,
  onLeaveSession,
  authUser,
  onAuthLogout
}: WorkspaceAppProps) {
  const [activeStory, setActiveStory] = useState<StoryTabId>("s1");
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roleGap, setRoleGap] = useState<RoleGapSnapshot | null>(null);
  const [gapLoading, setGapLoading] = useState(true);
  const [gapError, setGapError] = useState<string | null>(null);
  const agentReplyIndex = useRef(0);
  const [chatSending, setChatSending] = useState(false);
  const [sseThinkingLines, setSseThinkingLines] = useState<string[]>([]);

  const [promptDraft, setPromptDraft] = useState(
    () => `주제: ${session.topic}\n\n이번 스프린트에서 구현할 범위와 완료 조건을 구체화해 주세요.\n`
  );
  const [openApiDraft, setOpenApiDraft] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_OPENAPI_YAML;
    return loadContractGate(session.sessionId)?.openApiYaml ?? DEFAULT_OPENAPI_YAML;
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(() => {
    if (typeof window === "undefined") return null;
    return loadContractGate(session.sessionId)?.validationResult ?? null;
  });
  const [contractApproved, setContractApproved] = useState(() => {
    if (typeof window === "undefined") return false;
    return loadContractGate(session.sessionId)?.contractApproved ?? false;
  });
  const [contractBusy, setContractBusy] = useState<string | null>(null);
  const [contractErr, setContractErr] = useState<string | null>(null);

  const [specConversion, setSpecConversion] = useState<SpecConversionResult | null>(null);
  const [specApproved, setSpecApproved] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [specErr, setSpecErr] = useState<string | null>(null);

  const [prSnap, setPrSnap] = useState<PrReviewSnapshot>(() => {
    if (typeof window === "undefined") return createIdlePrSnapshot(session.sessionId);
    return loadPrReview(session.sessionId) ?? createIdlePrSnapshot(session.sessionId);
  });
  const [prErr, setPrErr] = useState<string | null>(null);
  const [prBusy, setPrBusy] = useState<string | null>(null);

  const [retroReports, setRetroReports] = useState<RetroReport[]>(() => {
    if (typeof window === "undefined") return [];
    return loadRetroPersist(session.sessionId)?.reports ?? [];
  });
  const [selectedRetroId, setSelectedRetroId] = useState<string | null>(null);
  const [retroBusy, setRetroBusy] = useState(false);
  const [retroErr, setRetroErr] = useState<string | null>(null);

  const loadRoleGap = useCallback(async () => {
    setGapLoading(true);
    setGapError(null);
    try {
      const snap = await fetchRoleGapSnapshot(session);
      setRoleGap(snap);
      setMessages(buildInitialChatMessages(session, snap));
    } catch {
      setGapError("역할 결손 정보를 불러오지 못했습니다.");
      setMessages([]);
    } finally {
      setGapLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void loadRoleGap();
  }, [loadRoleGap]);

  useEffect(() => {
    const p = loadPersistedSpec(session.sessionId);
    if (p?.conversion) {
      setSpecConversion(p.conversion);
      setSpecApproved(p.approved);
    }
  }, [session.sessionId]);

  useEffect(() => {
    if (!specApproved && isStoryLocked(activeStory, specApproved)) {
      setActiveStory("s2");
    }
  }, [specApproved, activeStory]);

  useEffect(() => {
    const p = loadPrReview(session.sessionId);
    setPrSnap(p ?? createIdlePrSnapshot(session.sessionId));
    void (async () => {
      const remote = await fetchPrReviewSnapshot(session);
      if (remote) {
        setPrSnap((prev) => {
          if (remote.stateVersion < prev.stateVersion) return prev;
          savePrReview(session.sessionId, remote);
          return remote;
        });
      }
    })();
  }, [session]);

  useEffect(() => {
    const cg = loadContractGate(session.sessionId);
    if (cg) {
      setOpenApiDraft(cg.openApiYaml);
      setValidationResult(cg.validationResult);
      setContractApproved(cg.contractApproved);
    } else {
      setOpenApiDraft(DEFAULT_OPENAPI_YAML);
      setValidationResult(null);
      setContractApproved(false);
    }
  }, [session.sessionId]);

  useEffect(() => {
    const rp = loadRetroPersist(session.sessionId);
    const initial = rp?.reports ?? [];
    setRetroReports(initial);
    setSelectedRetroId(initial[0]?.id ?? null);
    void (async () => {
      const remote = await fetchRetroReports(session);
      if (remote.length > 0) {
        setRetroReports(remote);
        saveRetroPersist(session.sessionId, { reports: remote });
        setSelectedRetroId(remote[0]?.id ?? null);
      }
    })();
  }, [session]);

  const handleConvert = useCallback(async () => {
    setSpecErr(null);
    setConvertLoading(true);
    try {
      const result = await convertPromptToSpec(session, promptDraft);
      setSpecConversion(result);
      setSpecApproved(false);
      savePersistedSpec(session.sessionId, { approved: false, conversion: result });
    } catch {
      setSpecErr("명세 변환에 실패했습니다.");
    } finally {
      setConvertLoading(false);
    }
  }, [session, promptDraft]);

  const handleApprove = useCallback(async () => {
    if (!specConversion) return;
    setSpecErr(null);
    setApproveLoading(true);
    try {
      const res = await approvePromptSpec(session, specConversion.specVersion);
      setSpecApproved(true);
      savePersistedSpec(session.sessionId, { approved: true, conversion: specConversion });
      setMessages((m) => [
        ...m,
        {
          id: `sys-spec-${Date.now()}`,
          kind: "system",
          text: `명세 v${res.specVersion} 승인 완료. 스토리3(PR)·4(계약)·5(회고) 탭이 열렸습니다.`
        }
      ]);
    } catch {
      setSpecErr("명세 승인 요청에 실패했습니다.");
    } finally {
      setApproveLoading(false);
    }
  }, [session, specConversion]);

  const handlePrSubmit = useCallback(async () => {
    setPrErr(null);
    setPrBusy("submit");
    try {
      const next = await submitPr(session, prSnap);
      setPrSnap(next);
      savePrReview(session.sessionId, next);
      if (next.phase === "open" && next.revisionRound === 1) {
        setMessages((m) => [
          ...m,
          {
            id: `sys-pr-open-${Date.now()}`,
            kind: "system",
            text: `PR #${next.prNumber} (${next.branch}) 제출됨. 리뷰 코멘트 반영 상태를 선택한 뒤 재검토를 진행하세요.`
          }
        ]);
      }
    } catch {
      setPrErr("PR 제출에 실패했습니다.");
    } finally {
      setPrBusy(null);
    }
  }, [session, prSnap]);

  const handleCommentStatus = useCallback(
    async (commentId: string, status: CommentReflectionStatus) => {
      setPrErr(null);
      setPrBusy(`patch-${commentId}`);
      try {
        const next = await patchPrComment(session, prSnap, commentId, status);
        setPrSnap(next);
        savePrReview(session.sessionId, next);
      } catch {
        setPrErr("코멘트 상태를 바꾸지 못했습니다.");
      } finally {
        setPrBusy(null);
      }
    },
    [session, prSnap]
  );

  const handlePrReReview = useCallback(async () => {
    setPrErr(null);
    setPrBusy("rereview");
    try {
      const next = await requestPrReReview(session, prSnap);
      if (next.stateVersion === prSnap.stateVersion) {
        setPrErr("재검토 조건: 라운드1에서 모든 코멘트가 pending이 아니어야 합니다.");
        return;
      }
      setPrSnap(next);
      savePrReview(session.sessionId, next);
      setMessages((m) => [
        ...m,
        {
          id: `sys-pr-r2-${Date.now()}`,
          kind: "system",
          text: `재검토 라운드 ${next.revisionRound}가 열렸습니다. 새 코멘트를 반영한 뒤 최종 승인을 요청하세요.`
        }
      ]);
    } catch {
      setPrErr("재검토 요청에 실패했습니다.");
    } finally {
      setPrBusy(null);
    }
  }, [session, prSnap]);

  const handlePrFinalApprove = useCallback(async () => {
    setPrErr(null);
    setPrBusy("final");
    try {
      const next = await finalApprovePr(session, prSnap);
      if (next.stateVersion === prSnap.stateVersion) {
        setPrErr("최종 승인 조건: 재검토(라운드2) 완료 후 모든 코멘트가 pending이 아니어야 합니다.");
        return;
      }
      setPrSnap(next);
      savePrReview(session.sessionId, next);
      setMessages((m) => [
        ...m,
        {
          id: `sys-pr-done-${Date.now()}`,
          kind: "system",
          text: `PR #${next.prNumber} 최종 승인 처리되었습니다.`
        }
      ]);
    } catch {
      setPrErr("최종 승인에 실패했습니다.");
    } finally {
      setPrBusy(null);
    }
  }, [session, prSnap]);

  const handleContractValidate = useCallback(async () => {
    setContractErr(null);
    setContractBusy("validate");
    try {
      const res = await validateOpenApiContract(session, openApiDraft);
      setValidationResult(res);
      setContractApproved(false);
      saveContractGate(session.sessionId, {
        openApiYaml: openApiDraft,
        validationResult: res,
        contractApproved: false
      });
      setMessages((m) => [
        ...m,
        {
          id: `sys-contract-val-${Date.now()}`,
          kind: "system",
          text: res.passed
            ? "OpenAPI 검증 통과 (린트·타입·계약)."
            : "OpenAPI 검증 실패 — 계약 승인은 검증 통과 후에만 가능합니다."
        }
      ]);
    } catch (e) {
      if (e instanceof ContractGateError) {
        setContractErr(`[${e.code}] ${e.message}`);
      } else {
        setContractErr("검증 요청에 실패했습니다.");
      }
    } finally {
      setContractBusy(null);
    }
  }, [session, openApiDraft]);

  const handleContractApprove = useCallback(async () => {
    if (!isValidationPassing(validationResult)) return;
    setContractErr(null);
    setContractBusy("approve");
    try {
      await approveContractGate(session, validationResult);
      setContractApproved(true);
      saveContractGate(session.sessionId, {
        openApiYaml: openApiDraft,
        validationResult,
        contractApproved: true
      });
      setMessages((m) => [
        ...m,
        {
          id: `sys-contract-app-${Date.now()}`,
          kind: "system",
          text: "API 계약이 승인되었습니다 (Gate B)."
        }
      ]);
    } catch (e) {
      if (e instanceof ContractGateError) {
        setContractErr(`[${e.code}] ${e.message}`);
      } else {
        setContractErr(e instanceof Error ? e.message : "승인에 실패했습니다.");
      }
    } finally {
      setContractBusy(null);
    }
  }, [session, openApiDraft, validationResult]);

  const handleRetroGenerate = useCallback(async () => {
    setRetroErr(null);
    setRetroBusy(true);
    try {
      const report = await generateRetroReport(session);
      setRetroReports((prev) => {
        const next = [report, ...prev];
        saveRetroPersist(session.sessionId, { reports: next });
        return next;
      });
      setSelectedRetroId(report.id);
      setMessages((m) => [
        ...m,
        {
          id: `sys-retro-${Date.now()}`,
          kind: "system",
          text: `회고 리포트 생성됨 (${new Date(report.createdAt).toLocaleString("ko-KR")}).`
        }
      ]);
    } catch {
      setRetroErr("회고 리포트 생성에 실패했습니다.");
    } finally {
      setRetroBusy(false);
    }
  }, [session]);

  const sendChat = useCallback(async () => {
    const t = chatInput.trim();
    if (!t || gapLoading || !roleGap?.injectedAgents.length || chatSending) return;
    const agents = roleGap.injectedAgents;
    const i = agentReplyIndex.current % agents.length;
    agentReplyIndex.current += 1;
    const replier = agents[i];
    const uid = `u-${Date.now()}`;
    const aid = `a-${Date.now()}`;
    const prevMessages = messages;
    setChatInput("");
    setChatSending(true);
    setMessages((m) => [...m, { id: uid, kind: "user", text: t }]);
    const result = await fetchAgentReply({
      session,
      agent: replier,
      messages: prevMessages,
      userText: t
    });
    if (result.ok) {
      setMessages((m) => [
        ...m,
        {
          id: aid,
          kind: "agent",
          agentId: replier.agentId,
          agentLabel: replier.role,
          displayName: replier.displayName,
          text: result.text
        }
      ]);
    } else {
      setMessages((m) => [
        ...m,
        {
          id: `sys-chat-err-${Date.now()}`,
          kind: "system",
          text: `채팅 오류: ${result.error}`
        }
      ]);
    }
    setChatSending(false);
  }, [
    chatInput,
    gapLoading,
    roleGap,
    chatSending,
    messages,
    session
  ]);

  const thinkingR1Lines = useMemo(
    () =>
      buildThinkingR1Lines({
        session,
        gapLoading,
        roleGap,
        gapError,
        activeStory,
        specApproved,
        specConversion,
        convertLoading,
        approveLoading,
        prSnap,
        contractApproved,
        validationResult,
        contractBusy,
        retroReportsCount: retroReports.length,
        chatSending,
        messagesLength: messages.length
      }),
    [
      session,
      gapLoading,
      roleGap,
      gapError,
      activeStory,
      specApproved,
      specConversion,
      convertLoading,
      approveLoading,
      prSnap,
      contractApproved,
      validationResult,
      contractBusy,
      retroReports.length,
      chatSending,
      messages.length
    ]
  );

  const combinedThinkingLines = useMemo(
    () => [...thinkingR1Lines, ...sseThinkingLines.map((line) => `[stream] ${line}`)],
    [thinkingR1Lines, sseThinkingLines]
  );

  const sprintCheckpoints = useMemo(
    () =>
      buildSprintCheckpoints({
        specApproved,
        contractApproved,
        prSnap,
        retroReports
      }),
    [specApproved, contractApproved, prSnap, retroReports]
  );

  const dodTimeline = useMemo(
    () =>
      buildDodTimeline({
        session,
        specConversion,
        specApproved,
        prSnap,
        validationResult,
        contractApproved,
        retroReports
      }),
    [session, specConversion, specApproved, prSnap, validationResult, contractApproved, retroReports]
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3 sm:justify-start">
            <div className="flex min-w-0 items-center gap-2">
              <LayoutGrid className="h-5 w-5 shrink-0 text-slate-600" aria-hidden />
              <div className="min-w-0">
                <h1 className="text-base font-semibold tracking-tight text-slate-900">
                  US Vibe · 협업 워크스페이스
                </h1>
                <p className="truncate text-xs text-slate-500">
                  주제: {session.topic} · 세션 {session.sessionId.slice(0, 8)}…
                  {roleGap != null ? ` · v${roleGap.stateVersion}` : null}
                  {authUser ? (
                    <>
                      {" "}
                      · <span className="text-slate-600">{authUser.email}</span>
                      <span className="text-slate-400"> ({authUser.role})</span>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onAuthLogout && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 hover:bg-amber-100"
                  onClick={() => {
                    if (typeof window !== "undefined" && window.confirm("로그아웃하고 로그인 화면으로 갈까요?")) {
                      onAuthLogout();
                    }
                  }}
                >
                  로그아웃
                </button>
              )}
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.confirm("세션을 종료하고 온보딩으로 돌아갈까요?")
                  ) {
                    clearPersistedSpec(session.sessionId);
                    clearPrReview(session.sessionId);
                    clearContractGate(session.sessionId);
                    clearRetroPersist(session.sessionId);
                    onLeaveSession();
                  }
                }}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                새 세션
              </button>
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
        <aside className="flex w-full shrink-0 flex-col border-slate-200 bg-white lg:w-[340px] lg:border-r">
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-500" aria-hidden />
              <span className="text-sm font-medium text-slate-800">채팅</span>
            </div>
            {roleGap && !gapLoading && (
              <div className="mt-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  <Users className="h-3 w-3" aria-hidden />
                  참여 중
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700">
                    학습자
                  </span>
                  {roleGap.injectedAgents.map((a) => (
                    <span
                      key={a.agentId}
                      className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-900"
                      title={a.displayName}
                    >
                      {a.role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
            <ul className="flex max-h-[min(40vh,420px)] flex-col gap-2 overflow-y-auto text-sm lg:max-h-none lg:flex-1">
              {gapLoading && (
                <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                  역할 결손 정보를 불러오는 중…
                </li>
              )}
              {gapError && !gapLoading && (
                <li className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{gapError}</li>
              )}
              {!gapLoading &&
                messages.map((m) => {
                  if (m.kind === "system") {
                    return (
                      <li key={m.id} className="text-center">
                        <span className="inline-block max-w-[95%] whitespace-pre-wrap rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] leading-snug text-slate-600">
                          {m.text}
                        </span>
                      </li>
                    );
                  }
                  if (m.kind === "user") {
                    return (
                      <li
                        key={m.id}
                        className="ml-4 whitespace-pre-wrap rounded-lg bg-slate-900 px-3 py-2 text-slate-50"
                      >
                        {m.text}
                      </li>
                    );
                  }
                  return (
                    <li
                      key={m.id}
                      className="mr-2 rounded-lg border border-violet-100 bg-violet-50/80 px-3 py-2 text-slate-800"
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                          {m.agentLabel}
                          {m.displayName ? ` · ${m.displayName}` : ""}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{m.text}</p>
                    </li>
                  );
                })}
            </ul>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="chat-input">
                메시지
              </label>
              <input
                id="chat-input"
                className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-sm outline-none ring-slate-400 focus:ring-2 disabled:bg-slate-50"
                placeholder={
                  gapLoading ? "불러오는 중…" : chatSending ? "답변 생성 중…" : "메시지 입력…"
                }
                value={chatInput}
                disabled={gapLoading || !roleGap || chatSending}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={() => void sendChat()}
                disabled={gapLoading || !roleGap || chatSending}
              >
                {chatSending ? "전송 중…" : "전송"}
              </button>
            </div>
          </div>
        </aside>

        {/* Center: story tabs */}
        <main className="min-w-0 flex-1 border-slate-200 bg-slate-50/80 lg:border-r">
          <div className="border-b border-slate-200 bg-white px-2 pt-2">
            {!specApproved && (
              <p className="px-2 pb-1 text-[11px] text-amber-800">
                스토리2에서 Prompt→Spec을 <strong>승인</strong>해야 스토리3·4·5로 이동할 수 있습니다.
              </p>
            )}
            <div className="flex gap-1 overflow-x-auto pb-2" role="tablist" aria-label="스토리 패널">
              {storyTabs.map((tab) => {
                const locked = isStoryLocked(tab.id, specApproved);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeStory === tab.id}
                    title={locked ? "스토리2 명세 승인 필요" : undefined}
                    disabled={locked}
                    className={
                      locked
                        ? "inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 opacity-70"
                        : activeStory === tab.id
                          ? "shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                          : "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    }
                    onClick={() => {
                      if (locked) return;
                      setActiveStory(tab.id);
                    }}
                  >
                    {locked && <Lock className="h-3 w-3" aria-hidden />}
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.short}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4">
            {activeStory === "s1" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s1-title">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 id="s1-title" className="text-sm font-semibold text-slate-900">
                    역할 결손 · 서버 스냅샷
                  </h2>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    onClick={() => void loadRoleGap()}
                    disabled={gapLoading}
                  >
                    다시 불러오기
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_API_URL</code>이 있으면{" "}
                  <code className="rounded bg-slate-100 px-1">GET /api/sessions/:sessionId/role-gap</code> 응답을 쓰고,
                  없거나 실패 시 목업 스냅샷과 같은 형태로 표시합니다.
                </p>
                {gapLoading && <p className="mt-3 text-sm text-slate-500">불러오는 중…</p>}
                {!gapLoading && roleGap && (
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">stateVersion</dt>
                      <dd className="font-mono text-slate-900">{roleGap.stateVersion}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">인간 역할</dt>
                      <dd className="mt-1 flex flex-wrap gap-1">
                        {roleGap.humanRoleLabels.map((label) => (
                          <span
                            key={label}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800"
                          >
                            {label}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">주입된 에이전트 (채팅 참여)</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {roleGap.injectedAgents.map((a) => (
                          <span
                            key={a.agentId}
                            className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900"
                            title={a.agentId}
                          >
                            {a.role} — {a.displayName}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">요약</dt>
                      <dd className="text-slate-800">{roleGap.summary}</dd>
                    </div>
                  </dl>
                )}
                {!gapLoading && gapError && (
                  <p className="mt-3 text-sm text-red-700">{gapError}</p>
                )}
              </section>
            )}

            {activeStory === "s2" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s2-title">
                <h2 id="s2-title" className="text-sm font-semibold text-slate-900">
                  Prompt → Spec
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  <code className="rounded bg-slate-100 px-1">POST .../prompt-spec/convert</code> ·{" "}
                  <code className="rounded bg-slate-100 px-1">POST .../prompt-spec/approve</code>
                </p>
                <textarea
                  className="mt-3 min-h-[120px] w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50"
                  placeholder="예: 세션 목록 API에 필터와 페이지네이션을 추가한다…"
                  value={promptDraft}
                  disabled={specApproved}
                  onChange={(e) => setPromptDraft(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
                    onClick={() => void handleConvert()}
                    disabled={convertLoading || specApproved}
                  >
                    {convertLoading ? "변환 중…" : "명세 변환"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-emerald-700 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                    onClick={() => void handleApprove()}
                    disabled={approveLoading || !specConversion || specApproved}
                  >
                    {approveLoading ? "승인 중…" : specApproved ? "승인됨" : "명세 승인"}
                  </button>
                  {specApproved && specConversion && (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setSpecApproved(false);
                        savePersistedSpec(session.sessionId, {
                          approved: false,
                          conversion: specConversion
                        });
                        setMessages((m) => [
                          ...m,
                          {
                            id: `sys-spec-revoke-${Date.now()}`,
                            kind: "system",
                            text: "명세 승인을 해제했습니다. 스토리3·4·5는 잠금되며 명세를 다시 변환·승인할 수 있습니다."
                          }
                        ]);
                      }}
                    >
                      승인 해제 · 다시 작성
                    </button>
                  )}
                </div>
                {specErr && <p className="mt-2 text-sm text-red-600">{specErr}</p>}
                {specApproved && specConversion && (
                  <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    명세 v{specConversion.specVersion} 승인됨 — 다음 스토리 탭을 사용할 수 있습니다.
                  </p>
                )}
                {specConversion && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <h3 className="text-xs font-medium text-slate-700">구조화 결과</h3>
                      <dl className="mt-2 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                        <div>
                          <dt className="text-xs text-slate-500">목표</dt>
                          <dd className="text-slate-900">{specConversion.template.goal}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">범위</dt>
                          <dd className="whitespace-pre-wrap text-slate-900">{specConversion.template.scope}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">제약</dt>
                          <dd className="text-slate-900">{specConversion.template.constraints}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">완료 조건</dt>
                          <dd>
                            <ul className="list-inside list-disc text-slate-900">
                              {specConversion.template.acceptanceCriteria.map((ac) => (
                                <li key={ac}>{ac}</li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">비목표</dt>
                          <dd>
                            <ul className="list-inside list-disc text-slate-900">
                              {specConversion.template.nonGoals.map((ng) => (
                                <li key={ng}>{ng}</li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-slate-700">마크다운 미리보기</h3>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-800">
                        {specConversion.rawMarkdown}
                      </pre>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeStory === "s3" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s3-title">
                <h2 id="s3-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GitPullRequest className="h-4 w-4" aria-hidden />
                  PR 제출 · 리뷰 · 재검토
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  <code className="rounded bg-slate-100 px-1">GET/POST .../pr-review</code> · 반영 상태 후 라운드1→재검토→최종
                  승인
                </p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
                    state v{prSnap.stateVersion}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">
                    라운드 {prSnap.revisionRound}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">단계: {prSnap.phase}</span>
                  {prSnap.prNumber != null && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-900">
                      PR #{prSnap.prNumber} {prSnap.branch ? `· ${prSnap.branch}` : ""}
                    </span>
                  )}
                </div>

                {prSnap.phase === "idle" && (
                  <button
                    type="button"
                    className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={prBusy !== null || !specApproved}
                    title={!specApproved ? "스토리2 명세 승인 필요" : undefined}
                    onClick={() => void handlePrSubmit()}
                  >
                    {prBusy === "submit" ? "제출 중…" : "PR 제출"}
                  </button>
                )}

                {prSnap.phase === "open" && prSnap.comments.length > 0 && (
                  <ul className="mt-4 space-y-3 text-sm">
                    {prSnap.comments.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-600">{c.authorLabel}</span>
                          <select
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                            value={c.status}
                            disabled={prBusy !== null || prSnap.phase === "approved"}
                            onChange={(e) =>
                              void handleCommentStatus(c.id, e.target.value as CommentReflectionStatus)
                            }
                          >
                            <option value="pending">대기</option>
                            <option value="addressed">반영됨</option>
                            <option value="deferred">보류</option>
                            <option value="needs_clarification">추가 설명 필요</option>
                          </select>
                        </div>
                        <p className="mt-2 text-slate-800">{c.body}</p>
                      </li>
                    ))}
                  </ul>
                )}

                {prSnap.phase === "open" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {prSnap.revisionRound === 1 &&
                      prSnap.comments.every((c) => c.status !== "pending") &&
                      prSnap.comments.length > 0 && (
                        <button
                          type="button"
                          className="rounded-md border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                          disabled={prBusy !== null}
                          onClick={() => void handlePrReReview()}
                        >
                          {prBusy === "rereview" ? "처리 중…" : "재검토 요청 (라운드2)"}
                        </button>
                      )}
                    {prSnap.revisionRound >= 2 &&
                      prSnap.comments.every((c) => c.status !== "pending") &&
                      prSnap.comments.length > 0 && (
                        <button
                          type="button"
                          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800 disabled:opacity-50"
                          disabled={prBusy !== null}
                          onClick={() => void handlePrFinalApprove()}
                        >
                          {prBusy === "final" ? "처리 중…" : "최종 승인"}
                        </button>
                      )}
                  </div>
                )}

                {prSnap.phase === "approved" && (
                  <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    PR #{prSnap.prNumber} 최종 승인 완료. 다음 단계(계약 게이트·회고)로 진행할 수 있습니다.
                  </p>
                )}

                {prErr && <p className="mt-3 text-sm text-red-600">{prErr}</p>}
              </section>
            )}

            {activeStory === "s4" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s4-title">
                <h2 id="s4-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ClipboardCheck className="h-4 w-4" aria-hidden />
                  OpenAPI · 계약 게이트
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  <code className="rounded bg-slate-100 px-1">POST .../contract/validate</code> ·{" "}
                  <code className="rounded bg-slate-100 px-1">POST .../contract/approve</code>
                  — 검증 실패 시 승인 버튼 비활성 (AC).
                </p>
                <p className="mt-2 text-[11px] text-slate-500">
                  데모: YAML에 <code className="rounded bg-amber-50 px-1">LINT_FAIL</code>,{" "}
                  <code className="rounded bg-amber-50 px-1">TS_FAIL</code>,{" "}
                  <code className="rounded bg-amber-50 px-1">INVALID_CONTRACT</code> 또는{" "}
                  <code className="rounded bg-amber-50 px-1">paths:</code> 누락 시 해당 검증만 실패합니다.
                </p>
                <textarea
                  className="mt-3 min-h-[140px] w-full rounded-lg border border-slate-200 p-2 font-mono text-xs outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50"
                  value={openApiDraft}
                  disabled={contractApproved}
                  onChange={(e) => {
                    setOpenApiDraft(e.target.value);
                    setContractErr(null);
                  }}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={contractBusy !== null || contractApproved}
                    onClick={() => void handleContractValidate()}
                  >
                    {contractBusy === "validate" ? "검증 중…" : "검증 실행"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      contractBusy !== null ||
                      !isValidationPassing(validationResult) ||
                      contractApproved
                    }
                    title={
                      !isValidationPassing(validationResult)
                        ? "검증 통과 후에만 승인할 수 있습니다"
                        : contractApproved
                          ? "이미 승인됨"
                          : undefined
                    }
                    onClick={() => void handleContractApprove()}
                  >
                    {contractBusy === "approve" ? "처리 중…" : contractApproved ? "계약 승인됨" : "계약 승인"}
                  </button>
                </div>

                {validationResult && (
                  <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-600">종합</span>
                      {validationResult.passed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          통과
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                          <XCircle className="h-3.5 w-3.5" aria-hidden />
                          실패
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      {(
                        [
                          ["린트", validationResult.checks.lint] as const,
                          ["타입체크", validationResult.checks.typecheck] as const,
                          ["계약", validationResult.checks.contract] as const
                        ] as const
                      ).map(([label, check]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 font-medium text-slate-800">
                            {label}
                            {check.passed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" aria-hidden />
                            )}
                          </div>
                          {"errors" in check && check.errors.length > 0 && (
                            <ul className="mt-2 list-inside list-disc text-red-800">
                              {check.errors.map((err, i) => (
                                <li key={i}>{typeof err === "string" ? err : `${err.file}:${err.line} ${err.message}`}</li>
                              ))}
                            </ul>
                          )}
                          {"diffs" in check && check.diffs.length > 0 && (
                            <ul className="mt-2 space-y-1 text-slate-800">
                              {check.diffs.map((d, i) => (
                                <li key={i}>
                                  {d.method} {d.path} ({d.changeType}) — {d.affectedFields.join(", ")}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {contractApproved && (
                  <div className="mt-4 space-y-2">
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      Gate B(API 계약) 승인 완료.
                    </p>
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setContractApproved(false);
                        saveContractGate(session.sessionId, {
                          openApiYaml: openApiDraft,
                          validationResult,
                          contractApproved: false
                        });
                        setMessages((m) => [
                          ...m,
                          {
                            id: `sys-contract-revoke-${Date.now()}`,
                            kind: "system",
                            text: "계약 승인을 해제했습니다. 필요 시 YAML을 수정한 뒤 다시 검증하세요."
                          }
                        ]);
                      }}
                    >
                      승인 취소
                    </button>
                  </div>
                )}
                {contractErr && <p className="mt-3 text-sm text-red-600">{contractErr}</p>}
              </section>
            )}

            {activeStory === "s5" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s5-title">
                <h2 id="s5-title" className="text-sm font-semibold text-slate-900">
                  회고 · KPI · 다음 액션
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  <code className="rounded bg-slate-100 px-1">POST .../retro/generate</code> ·{" "}
                  <code className="rounded bg-slate-100 px-1">GET .../retro/reports</code>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-800 disabled:opacity-50"
                    disabled={retroBusy}
                    onClick={() => void handleRetroGenerate()}
                  >
                    {retroBusy ? "생성 중…" : "회고 리포트 생성"}
                  </button>
                </div>
                {retroErr && <p className="mt-2 text-sm text-red-600">{retroErr}</p>}

                {retroReports.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-medium text-slate-600">과거 리포트</h3>
                    <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                      {retroReports.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={
                            selectedRetroId === r.id || (!selectedRetroId && r.id === retroReports[0]?.id)
                              ? "rounded-full border border-indigo-600 bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-900"
                              : "rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                          }
                          onClick={() => setSelectedRetroId(r.id)}
                        >
                          {new Date(r.createdAt).toLocaleString("ko-KR", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(() => {
                  const sel =
                    retroReports.find((r) => r.id === selectedRetroId) ??
                    retroReports[0] ??
                    null;
                  if (!sel) {
                    return (
                      <p className="mt-6 text-sm text-slate-500">
                        리포트가 없습니다. 위 버튼으로 생성하면 KPI 4종과 다음 액션 3개가 채워집니다.
                      </p>
                    );
                  }
                  const k = sel.kpis;
                  return (
                    <div className="mt-4 space-y-4">
                      <p className="text-[11px] text-slate-400">
                        ID <span className="font-mono">{sel.id.slice(0, 8)}…</span>
                      </p>
                      <p className="text-xs leading-relaxed text-slate-600">
                        <span className="font-medium text-slate-700">KPI 근거: </span>
                        {sel.kpiBasis ??
                          "(구 리포트) 통합 이벤트 기반 한 줄 근거가 없습니다. 새로 생성하면 표시됩니다."}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {(
                          [
                            ["역할 균형", k.roleBalanceScore, "/100"],
                            ["재작업률", k.reworkRatePercent, "%"],
                            ["리뷰 반영률", k.reviewReflectionPercent, "%"],
                            ["커뮤니케이션", k.communicationScore, "/100"]
                          ] as const
                        ).map(([label, val, unit]) => (
                          <div
                            key={label}
                            className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center"
                          >
                            <div className="text-xs text-slate-500">{label}</div>
                            <div className="text-lg font-semibold text-slate-900">
                              {val}
                              <span className="text-sm font-normal text-slate-500">{unit}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <h3 className="text-xs font-medium text-slate-600">다음 스프린트 행동 3개</h3>
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-800">
                          {sel.nextActions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {activeStory === "s6" && (
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby="s6-title">
                <h2 id="s6-title" className="text-sm font-semibold text-slate-900">
                  연동 · 통합 이벤트 스트림
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  GitHub 웹훅·검증 이벤트는 서버 SQLite에 쌓입니다. 웹훅 <code className="rounded bg-slate-100 px-1">sessionId</code>를 이
                  학습 세션 UUID와 맞추면 여기서 동일 키로 조회됩니다.
                </p>
                <div className="mt-4">
                  {(() => {
                    const base = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ?? "";
                    if (!base) {
                      return (
                        <p className="text-sm text-slate-600">
                          <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_API_URL</code>을 설정하고 다시 빌드하면 폴링이
                          활성화됩니다.
                        </p>
                      );
                    }
                    if (!authUser) {
                      return <p className="text-sm text-amber-800">로그인 후 Bearer 토큰으로 이벤트를 불러옵니다.</p>;
                    }
                    return (
                      <>
                        <IntegrationEventsPanel apiBaseUrl={base} sessionId={session.sessionId} pollMs={5000} />
                        <IntegrationToolsPanel
                          apiBaseUrl={base}
                          session={session}
                          storyPrNumber={prSnap.prNumber}
                          onIntegrationSseLine={(line) =>
                            setSseThinkingLines((prev) => [...prev.slice(-14), line])
                          }
                        />
                      </>
                    );
                  })()}
                </div>
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
              {combinedThinkingLines.map((line, i) => (
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
              {dodTimeline.length === 0 ? (
                <li className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-[11px] text-slate-500">
                  아직 기록된 마일스톤이 없습니다. 스토리2에서 명세 변환부터 진행해 보세요.
                </li>
              ) : (
                dodTimeline.map((ev) => (
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
                ))
              )}
            </ul>
          </div>
          <div className="border-t border-slate-100 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Bot className="h-4 w-4" aria-hidden />
              R1 요약은 현재 세션 상태(역할·명세·PR·계약·회고·채팅)에 맞춰 갱신됩니다.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
