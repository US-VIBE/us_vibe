"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPrValidationStatus } from "@/lib/validation-api";
import {
  approveVfsSnapshot,
  createVfsSnapshot,
  fetchVfsDiff,
  resolveVfsDiffUrl,
  type VfsDiffPayload
} from "@/lib/vfs-api";
import {
  buildMergedTimelineRows,
  fetchUnifiedTimeline,
  type UnifiedTimelineData
} from "@/lib/unified-timeline-api";
import { startIntegrationSseStream } from "@/lib/integration-sse";
import {
  fetchInAppNotifications,
  fetchIntegrationHints,
  fetchProjectState,
  fetchWorkspaceGates,
  patchProjectState,
  patchSessionHumanRoles,
  runSimulationSessionVerify,
  runWorkspaceDodVerify,
  uploadWorkspaceArtifact,
  type IntegrationHints,
  type ProjectStatePayload,
  type WorkspaceGates
} from "@/lib/workspace-collab-api";
import type { LearningSession } from "@/lib/session-types";

const ROLE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "be", label: "BE (학습자)" },
  { id: "pm", label: "PM" },
  { id: "fe", label: "FE" },
  { id: "qa", label: "QA" },
  { id: "senior", label: "Senior" },
  { id: "design", label: "Design" },
  { id: "coach", label: "Coach" },
  { id: "supervisor", label: "Supervisor" }
];

type Props = {
  apiBaseUrl: string;
  session: LearningSession;
  /** 스토리3 PR 스냅샷 번호 — 설정 시 PR 검증 입력란 기본값·동기화 */
  storyPrNumber?: number | null;
  /** Thought Stream(aside)에 한 줄 요약 전달 */
  onIntegrationSseLine?: (line: string) => void;
};

function prNumberToInput(n: number | null | undefined): string {
  return n != null && Number.isFinite(n) ? String(n) : "";
}

export function IntegrationToolsPanel({
  apiBaseUrl,
  session,
  storyPrNumber,
  onIntegrationSseLine
}: Props) {
  const sid = session.sessionId;
  const [prInput, setPrInput] = useState(() => prNumberToInput(storyPrNumber));
  const [valLoading, setValLoading] = useState(false);
  const [valErr, setValErr] = useState<string | null>(null);
  const [valData, setValData] = useState<Awaited<ReturnType<typeof fetchPrValidationStatus>>>(null);

  const [vfsBusy, setVfsBusy] = useState(false);
  const [vfsErr, setVfsErr] = useState<string | null>(null);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [diff, setDiff] = useState<VfsDiffPayload | null>(null);

  const [uniLoading, setUniLoading] = useState(false);
  const [uniErr, setUniErr] = useState<string | null>(null);
  const [uniSummary, setUniSummary] = useState<string | null>(null);
  const [uniData, setUniData] = useState<UnifiedTimelineData | null>(null);
  const [uniTab, setUniTab] = useState<"merged" | "sqlite" | "postgres">("merged");

  const [sseOn, setSseOn] = useState(false);
  const [sseErr, setSseErr] = useState<string | null>(null);
  const [sseLog, setSseLog] = useState<string[]>([]);

  const [gates, setGates] = useState<WorkspaceGates | null>(null);
  const [gatesErr, setGatesErr] = useState<string | null>(null);

  const [rolesSelected, setRolesSelected] = useState<Set<string>>(new Set(["be"]));
  const [roleSaveMsg, setRoleSaveMsg] = useState<string | null>(null);

  const [ps, setPs] = useState<ProjectStatePayload | null>(null);
  const [psErr, setPsErr] = useState<string | null>(null);
  const [psGoalDraft, setPsGoalDraft] = useState("");
  const [psSaveBusy, setPsSaveBusy] = useState(false);
  const [psSaveMsg, setPsSaveMsg] = useState<string | null>(null);

  const [dodLoading, setDodLoading] = useState(false);
  const [dodResult, setDodResult] = useState<string | null>(null);
  const [simVerifyLoading, setSimVerifyLoading] = useState(false);
  const [simVerifyResult, setSimVerifyResult] = useState<string | null>(null);

  const [hints, setHints] = useState<IntegrationHints | null>(null);
  const [hintsErr, setHintsErr] = useState<string | null>(null);
  const [artifactBusy, setArtifactBusy] = useState(false);
  const [artifactMsg, setArtifactMsg] = useState<string | null>(null);
  const [notifs, setNotifs] = useState<
    Array<{ id: string; title: string; body: string; kind: string; createdAt: string }>
  >([]);

  const refreshGates = useCallback(() => {
    setGatesErr(null);
    fetchWorkspaceGates(apiBaseUrl, sid)
      .then(setGates)
      .catch((e: unknown) => setGatesErr(e instanceof Error ? e.message : String(e)));
  }, [apiBaseUrl, sid]);

  const refreshProjectState = useCallback(() => {
    setPsErr(null);
    fetchProjectState(apiBaseUrl, sid)
      .then((p) => {
        setPs(p);
        setPsGoalDraft(p.activeSprintGoal ?? "");
      })
      .catch((e: unknown) => setPsErr(e instanceof Error ? e.message : String(e)));
  }, [apiBaseUrl, sid]);

  useEffect(() => {
    refreshGates();
    refreshProjectState();
  }, [refreshGates, refreshProjectState]);

  useEffect(() => {
    setHintsErr(null);
    setArtifactMsg(null);
    void fetchIntegrationHints(apiBaseUrl, sid)
      .then((h) => {
        setHints(h);
      })
      .catch((e: unknown) => {
        setHints(null);
        setHintsErr(e instanceof Error ? e.message : String(e));
      });
    void fetchInAppNotifications(apiBaseUrl, sid)
      .then(setNotifs)
      .catch(() => setNotifs([]));
  }, [apiBaseUrl, sid]);

  useEffect(() => {
    setPrInput(prNumberToInput(storyPrNumber));
  }, [storyPrNumber]);

  useEffect(() => {
    if (!sseOn) {
      return;
    }
    const ac = new AbortController();
    setSseErr(null);
    startIntegrationSseStream(apiBaseUrl, (raw) => {
      let line = raw.slice(0, 200);
      try {
        const j = JSON.parse(raw) as { type?: string };
        if (j.type === "heartbeat") {
          line = "[heartbeat]";
        } else if (j.type) {
          line = j.type;
        }
      } catch {
        /* keep truncated raw */
      }
      setSseLog((prev) => [...prev.slice(-12), line]);
      onIntegrationSseLine?.(line);
    }, ac.signal).catch((e: unknown) => {
      if (!ac.signal.aborted) {
        setSseErr(e instanceof Error ? e.message : String(e));
      }
    });
    return () => ac.abort();
  }, [apiBaseUrl, sseOn, onIntegrationSseLine]);

  const loadValidation = () => {
    const n = parseInt(prInput, 10);
    if (Number.isNaN(n)) {
      setValErr("PR 번호를 입력하세요.");
      return;
    }
    setValLoading(true);
    setValErr(null);
    fetchPrValidationStatus(apiBaseUrl, n)
      .then(setValData)
      .catch((e: unknown) => setValErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setValLoading(false));
  };

  const demoVfs = async () => {
    setVfsBusy(true);
    setVfsErr(null);
    setDiff(null);
    try {
      const created = await createVfsSnapshot(apiBaseUrl, sid, "fe-agent", [
        { filePath: "demo/readme.md", content: `# Demo\nsession ${sid}\n` }
      ]);
      setSnapshotId(created.snapshotId);
      const d = await fetchVfsDiff(apiBaseUrl, created.snapshotId);
      setDiff(d);
    } catch (e: unknown) {
      setVfsErr(e instanceof Error ? e.message : String(e));
    } finally {
      setVfsBusy(false);
    }
  };

  const approveVfs = async () => {
    if (!snapshotId) return;
    setVfsBusy(true);
    setVfsErr(null);
    try {
      await approveVfsSnapshot(apiBaseUrl, snapshotId);
      setVfsErr(null);
      const d = await fetchVfsDiff(apiBaseUrl, snapshotId);
      setDiff(d);
    } catch (e: unknown) {
      setVfsErr(e instanceof Error ? e.message : String(e));
    } finally {
      setVfsBusy(false);
    }
  };

  const loadUnified = () => {
    setUniLoading(true);
    setUniErr(null);
    fetchUnifiedTimeline(apiBaseUrl, sid, 40)
      .then((d) => {
        setUniData(d);
        setUniSummary(
          `SQLite ${d.integrationEvents.length}건 · Postgres ${d.postgresTimeline.length}건` +
            (d.postgresNote ? ` — ${d.postgresNote}` : "")
        );
      })
      .catch((e: unknown) => setUniErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setUniLoading(false));
  };

  const saveProjectStateGoal = () => {
    if (!ps) return;
    setPsSaveBusy(true);
    setPsSaveMsg(null);
    patchProjectState(apiBaseUrl, sid, {
      expectedVersion: ps.stateVersion,
      activeSprintGoal: psGoalDraft.trim() || null
    })
      .then((next) => {
        setPs(next);
        setPsGoalDraft(next.activeSprintGoal ?? "");
        setPsSaveMsg(`저장됨 (stateVersion ${next.stateVersion})`);
      })
      .catch((e: unknown) => setPsSaveMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setPsSaveBusy(false));
  };

  const saveRoles = async () => {
    setRoleSaveMsg(null);
    const ids = [...rolesSelected];
    try {
      await patchSessionHumanRoles(apiBaseUrl, sid, ids);
      setRoleSaveMsg("저장됨. 스토리1 역할 탭을 다시 열거나 워크스페이스를 새로고침하세요.");
    } catch (e: unknown) {
      setRoleSaveMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const runDod = () => {
    setDodLoading(true);
    setDodResult(null);
    runWorkspaceDodVerify(apiBaseUrl, sid)
      .then((r) => {
        setDodResult(
          r.passed
            ? "DoD 검증 통과"
            : `실패: ${r.checks.filter((c) => !c.passed).map((c) => c.id).join(", ")}`
        );
      })
      .catch((e: unknown) => setDodResult(e instanceof Error ? e.message : String(e)))
      .finally(() => setDodLoading(false));
  };

  const runSimVerify = () => {
    setSimVerifyLoading(true);
    setSimVerifyResult(null);
    runSimulationSessionVerify(apiBaseUrl, sid)
      .then((r) => {
        setSimVerifyResult(
          r.ok ? `시뮬 검증 완료: ${r.summary}` : `시뮬 검증 실패: ${r.message}`
        );
      })
      .catch((e: unknown) =>
        setSimVerifyResult(e instanceof Error ? e.message : String(e))
      )
      .finally(() => setSimVerifyLoading(false));
  };

  const toggleRole = (id: string) => {
    setRolesSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        next.add("be");
      }
      return next;
    });
  };

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 text-sm">
        <h3 className="font-semibold text-indigo-950">GitHub 웹훅 · 세션 ID · 산출물 업로드</h3>
        <p className="mt-1 text-xs text-indigo-900/80">
          API 환경에 아래 스니펫을 넣고 GitHub 웹훅을 연결하면 PR 검증 이벤트가 이 워크스페이스 세션과 같은{" "}
          <code className="rounded bg-white px-1">sessionId</code>로 기록됩니다.
        </p>
        {hintsErr ? <p className="mt-2 text-xs text-red-600">{hintsErr}</p> : null}
        {hints ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-indigo-900">
              <strong>INTEGRATION_WEBHOOK_SESSION_ID</strong> ={" "}
              <code className="rounded bg-white px-1">{hints.integrationWebhookSessionId}</code>
            </p>
            <textarea
              readOnly
              className="h-28 w-full resize-y rounded border border-indigo-200 bg-white p-2 font-mono text-[11px] text-slate-800"
              value={hints.envSnippet}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-indigo-800 px-3 py-1 text-xs text-white"
                onClick={() => {
                  void navigator.clipboard.writeText(hints.envSnippet);
                  setArtifactMsg("환경 스니펫을 클립보드에 복사했습니다.");
                }}
              >
                스니펫 복사
              </button>
              <span className="text-xs text-indigo-800">{hints.note}</span>
            </div>
            <div className="mt-3 border-t border-indigo-200 pt-3">
              <p className="text-xs font-medium text-indigo-950">ERD·스케치 (PNG/JPEG/WebP/PDF, 최대 5MB)</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                className="mt-1 block text-xs"
                disabled={artifactBusy}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (!f) return;
                  setArtifactBusy(true);
                  setArtifactMsg(null);
                  void uploadWorkspaceArtifact(apiBaseUrl, sid, f, "erd")
                    .then(async () => {
                      setArtifactMsg(`업로드 완료: ${f.name}`);
                      const next = await fetchInAppNotifications(apiBaseUrl, sid);
                      setNotifs(next);
                    })
                    .catch((e: unknown) => {
                      setArtifactMsg(e instanceof Error ? e.message : String(e));
                    })
                    .finally(() => {
                      setArtifactBusy(false);
                      ev.target.value = "";
                    });
                }}
              />
            </div>
          </div>
        ) : null}
        {artifactMsg ? <p className="mt-2 text-xs text-slate-700">{artifactMsg}</p> : null}
        {notifs.length > 0 ? (
          <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto border-t border-indigo-100 pt-2 text-xs text-slate-800">
            {notifs.map((n) => (
              <li key={n.id} className="rounded bg-white/80 px-2 py-1">
                <strong>{n.title}</strong> — {n.body}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm">
        <h3 className="font-semibold text-slate-800">PR 검증 캐시 · 루프 가드</h3>
        <p className="mt-1 text-xs text-slate-500">
          <code className="rounded bg-white px-1">GET /api/validation/status/{"{pr}"}</code> —{" "}
          <code className="rounded bg-white px-1">validation</code>은 SQLite 캐시,
          <code className="rounded bg-white px-1">consecutiveFailures</code>는 연속 실패 streak입니다. 스토리3에서 PR을
          제출하면 아래 번호가 스냅샷과 맞춰집니다.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">
            PR #
            <input
              className="ml-1 w-16 rounded border border-slate-200 px-2 py-1"
              value={prInput}
              onChange={(e) => setPrInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded bg-slate-800 px-3 py-1 text-xs text-white"
            onClick={loadValidation}
            disabled={valLoading}
          >
            조회
          </button>
        </div>
        {valErr ? <p className="mt-2 text-xs text-red-600">{valErr}</p> : null}
        {valData ? (
          <ul className="mt-2 space-y-1 text-xs text-slate-700">
            <li>
              연속 실패: <strong>{valData.consecutiveFailures}</strong>
            </li>
            <li>
              캐시:{" "}
              {valData.validation
                ? valData.validation.result.passed
                  ? "마지막 결과 통과"
                  : "마지막 결과 실패"
                : "없음"}
            </li>
            {valData.validation ? (
              <li className="text-slate-500">checkedAt: {valData.validation.checkedAt}</li>
            ) : null}
          </ul>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm">
        <h3 className="font-semibold text-slate-800">VFS 스냅샷 · Diff · 승인</h3>
        <p className="mt-1 text-xs text-slate-500">
          Diff URL은 API 기준 상대경로입니다. 전체 URL:{" "}
          <code className="rounded bg-white px-1">
            {resolveVfsDiffUrl(apiBaseUrl, "/api/vfs/diff/&lt;id&gt;")}
          </code>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-slate-300 bg-white px-3 py-1 text-xs"
            onClick={() => void demoVfs()}
            disabled={vfsBusy}
          >
            데모 스냅샷 생성
          </button>
          <button
            type="button"
            className="rounded border border-emerald-600 bg-emerald-50 px-3 py-1 text-xs text-emerald-900"
            onClick={() => void approveVfs()}
            disabled={vfsBusy || !snapshotId}
          >
            스냅샷 승인
          </button>
        </div>
        {vfsErr ? <p className="mt-2 text-xs text-red-600">{vfsErr}</p> : null}
        {snapshotId ? <p className="mt-2 text-xs text-slate-600">snapshotId: {snapshotId}</p> : null}
        {diff ? (
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs">
            {diff.files.map((f) => (
              <li key={f.filePath} className="border-b border-slate-100 py-1 font-mono">
                {f.filePath} ({f.lineCount} lines)
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm"
        aria-labelledby="unified-timeline-heading"
      >
        <h3 id="unified-timeline-heading" className="font-semibold text-slate-800">
          통합 타임라인 (SQLite + Postgres)
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          <code className="rounded bg-white px-1">GET /api/integration/unified-timeline</code> ·{" "}
          <strong className="font-medium text-slate-600">병합</strong> 탭은 SQLite{" "}
          <code className="rounded bg-white px-1">timestamp</code>와 Postgres{" "}
          <code className="rounded bg-white px-1">createdAt</code>을 합쳐 최신순으로 정렬합니다. 동기화는{" "}
          <code className="rounded bg-white px-1">docs/integration-sandbox/session-id-sync.md</code>
        </p>
        <button
          type="button"
          className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs"
          onClick={loadUnified}
          disabled={uniLoading}
        >
          이 세션으로 병합 조회
        </button>
        {uniErr ? <p className="mt-2 text-xs text-red-600">{uniErr}</p> : null}
        {uniSummary ? <p className="mt-2 text-xs text-slate-700">{uniSummary}</p> : null}
        {uniData ? (
          <div className="mt-3">
            <div
              className="flex flex-wrap gap-1 border-b border-slate-200 text-xs"
              role="tablist"
              aria-label="타임라인 소스 보기"
            >
              <button
                type="button"
                role="tab"
                id="uni-tab-merged"
                aria-selected={uniTab === "merged"}
                aria-controls="uni-panel-timeline"
                tabIndex={0}
                className={`px-2 py-1 ${uniTab === "merged" ? "border-b-2 border-slate-800 font-medium" : "text-slate-500"}`}
                onClick={() => setUniTab("merged")}
              >
                병합 ({uniData.integrationEvents.length + uniData.postgresTimeline.length})
              </button>
              <button
                type="button"
                role="tab"
                id="uni-tab-sqlite"
                aria-selected={uniTab === "sqlite"}
                aria-controls="uni-panel-timeline"
                tabIndex={0}
                className={`px-2 py-1 ${uniTab === "sqlite" ? "border-b-2 border-slate-800 font-medium" : "text-slate-500"}`}
                onClick={() => setUniTab("sqlite")}
              >
                SQLite ({uniData.integrationEvents.length})
              </button>
              <button
                type="button"
                role="tab"
                id="uni-tab-postgres"
                aria-selected={uniTab === "postgres"}
                aria-controls="uni-panel-timeline"
                tabIndex={0}
                className={`px-2 py-1 ${uniTab === "postgres" ? "border-b-2 border-slate-800 font-medium" : "text-slate-500"}`}
                onClick={() => setUniTab("postgres")}
              >
                Postgres ({uniData.postgresTimeline.length})
              </button>
            </div>
            <ul
              id="uni-panel-timeline"
              role="tabpanel"
              aria-labelledby={
                uniTab === "merged"
                  ? "uni-tab-merged"
                  : uniTab === "sqlite"
                    ? "uni-tab-sqlite"
                    : "uni-tab-postgres"
              }
              className="mt-2 max-h-48 list-none space-y-1 overflow-y-auto text-[11px] text-slate-700"
            >
              {uniTab === "merged"
                ? buildMergedTimelineRows(uniData).map((row) => (
                    <li key={row.stableKey} className="rounded border border-slate-100 bg-white px-2 py-1">
                      <span className="sr-only">{row.source === "sqlite" ? "SQLite 출처" : "Postgres 출처"}</span>
                      <span
                        className={
                          row.source === "sqlite"
                            ? "mr-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-900"
                            : "mr-1 rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-900"
                        }
                        aria-hidden
                        title={row.source === "sqlite" ? "SQLite integration_events" : "Postgres collaboration_events"}
                      >
                        {row.source === "sqlite" ? "SQLite" : "PG"}
                      </span>
                      <span className="font-medium">{row.title}</span>
                      <div className="text-slate-500">
                        {row.isoTime ? (
                          <time dateTime={row.isoTime}>{row.detail}</time>
                        ) : (
                          row.detail
                        )}
                      </div>
                    </li>
                  ))
                : uniTab === "sqlite"
                  ? uniData.integrationEvents.map((ev, i) => (
                      <li
                        key={`${ev.timestamp}-${ev.type}-${ev.stateVersion}-${i}`}
                        className="rounded border border-slate-100 bg-white px-2 py-1"
                      >
                        <span className="font-medium">{ev.type}</span>{" "}
                        <span className="text-slate-400">v{ev.stateVersion}</span>
                        <div className="text-slate-500">
                          {(() => {
                            const iso = Date.parse(ev.timestamp);
                            return Number.isFinite(iso) ? (
                              <time dateTime={new Date(iso).toISOString()}>{ev.timestamp}</time>
                            ) : (
                              ev.timestamp
                            );
                          })()}
                        </div>
                      </li>
                    ))
                  : uniData.postgresTimeline.map((row) => (
                      <li key={row.id} className="rounded border border-slate-100 bg-white px-2 py-1">
                        <span className="font-medium">{row.eventType}</span>
                        <div className="text-slate-500">
                          {(() => {
                            const iso = Date.parse(row.createdAt);
                            return Number.isFinite(iso) ? (
                              <time dateTime={new Date(iso).toISOString()}>{row.createdAt}</time>
                            ) : (
                              row.createdAt
                            );
                          })()}
                        </div>
                      </li>
                    ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm">
        <h3 className="font-semibold text-slate-800">Thought Stream (SSE)</h3>
        <p className="mt-1 text-xs text-slate-500">
          <code className="rounded bg-white px-1">GET /api/integration/stream</code> · Redis 없으면
          heartbeat만 옵니다.
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={sseOn} onChange={(e) => setSseOn(e.target.checked)} />
          스트림 구독
        </label>
        {sseErr ? <p className="mt-2 text-xs text-red-600">{sseErr}</p> : null}
        <ul className="mt-2 max-h-28 overflow-y-auto font-mono text-[10px] text-slate-600">
          {sseLog.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm">
        <h3 className="font-semibold text-slate-800">Sprint1 게이트 · 역할 프로필</h3>
        <button
          type="button"
          className="mb-2 text-xs text-sky-700 underline"
          onClick={refreshGates}
        >
          게이트 새로고침
        </button>
        {gatesErr ? <p className="text-xs text-red-600">{gatesErr}</p> : null}
        {gates ? (
          <ul className="space-y-1 text-xs text-slate-700">
            <li>Prompt-to-Spec 승인: {gates.promptSpecApproved ? "예" : "아니오"}</li>
            <li>계약 검증 통과: {gates.contractValidatedPass ? "예" : "아니오"}</li>
            <li>계약 승인: {gates.contractApproved ? "예" : "아니오"}</li>
            <li>
              PR: {gates.prPhase} · round {gates.prRevisionRound}
            </li>
          </ul>
        ) : null}
        <p className="mt-3 text-xs font-medium text-slate-600">사람 역할 (PATCH session-profile)</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((r) => (
            <label key={r.id} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={rolesSelected.has(r.id)}
                onChange={() => toggleRole(r.id)}
              />
              {r.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          className="mt-2 rounded bg-slate-800 px-3 py-1 text-xs text-white"
          onClick={() => void saveRoles()}
        >
          역할 저장
        </button>
        {roleSaveMsg ? <p className="mt-2 text-xs text-slate-600">{roleSaveMsg}</p> : null}

        <div className="mt-4 space-y-4 border-t border-slate-200 pt-3">
          <div>
            <p className="text-xs font-medium text-slate-600">1) DoD 자동 검증 (워크스페이스 SQLite)</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              <code className="rounded bg-white px-0.5">POST /api/sessions/{"{id}"}/workspace-dod-verify</code> — 브리핑
              체크리스트·스크립트 기준 워크스페이스만 검사합니다.
            </p>
            <button
              type="button"
              className="mt-2 rounded border border-slate-300 bg-white px-3 py-1 text-xs"
              onClick={runDod}
              disabled={dodLoading}
            >
              실행 (workspace-dod-verify)
            </button>
            {dodResult ? <p className="mt-2 text-xs text-slate-700">{dodResult}</p> : null}
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-600">2) 시뮬 게이트 C (Postgres 세션)</p>
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              <code className="rounded bg-white px-0.5">POST /sessions/{"{id}"}/verify</code> — 시뮬 문서의 B→C 공식
              경로입니다. 위 DoD와 결과가 다를 수 있습니다.
            </p>
            <button
              type="button"
              className="mt-2 rounded border border-sky-600 bg-sky-50 px-3 py-1 text-xs text-sky-950"
              onClick={() => void runSimVerify()}
              disabled={simVerifyLoading}
            >
              실행 (시뮬 verify)
            </button>
            {simVerifyResult ? (
              <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-all text-xs text-slate-700">
                {simVerifyResult}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-sm">
        <h3 className="font-semibold text-slate-800">ProjectState (SSOT)</h3>
        <p className="mt-1 text-xs text-slate-500">
          <code className="rounded bg-white px-1">PATCH .../project-state</code> ·{" "}
          <code className="rounded bg-white px-1">expectedVersion</code>로 낙관적 잠금. 충돌 시 메시지 후 새로고침.
        </p>
        <button type="button" className="mb-2 text-xs text-sky-700 underline" onClick={refreshProjectState}>
          새로고침
        </button>
        {psErr ? <p className="text-xs text-red-600">{psErr}</p> : null}
        {ps ? (
          <>
            <label className="mt-2 block text-xs font-medium text-slate-600">
              activeSprintGoal
              <textarea
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-[11px]"
                rows={2}
                value={psGoalDraft}
                onChange={(e) => setPsGoalDraft(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="mt-2 rounded bg-slate-800 px-3 py-1 text-xs text-white disabled:opacity-50"
              disabled={psSaveBusy}
              onClick={() => void saveProjectStateGoal()}
            >
              목표 저장 (PATCH)
            </button>
            {psSaveMsg ? <p className="mt-2 text-xs text-slate-600">{psSaveMsg}</p> : null}
            <pre className="mt-3 max-h-40 overflow-auto rounded bg-white p-2 text-[10px] text-slate-700">
              {JSON.stringify(ps, null, 2)}
            </pre>
          </>
        ) : null}
      </section>
    </div>
  );
}
