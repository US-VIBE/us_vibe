"use client";

import { useEffect, useState } from "react";
import { fetchIntegrationEvents, type IntegrationEventWire } from "@/lib/integration-events-api";

type Props = {
  apiBaseUrl: string;
  sessionId: string;
  pollMs?: number;
};

export function IntegrationEventsPanel({ apiBaseUrl, sessionId, pollMs = 5000 }: Props) {
  const [events, setEvents] = useState<IntegrationEventWire[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      fetchIntegrationEvents(apiBaseUrl, sessionId, 40)
        .then((list) => {
          if (!cancelled) {
            setEvents(list);
            setErr(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) {
            setErr(e instanceof Error ? e.message : String(e));
          }
        });
    };
    tick();
    const id = window.setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [apiBaseUrl, sessionId, pollMs]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <h3 className="mb-2 font-semibold text-slate-800">통합 이벤트 (GitHub·검증)</h3>
      <p className="mb-3 text-xs text-slate-500">
        <code className="rounded bg-slate-100 px-1">GET /api/integration/events</code> · sessionId:{" "}
        <code className="rounded bg-slate-100 px-1">{sessionId || "(전체)"}</code>
      </p>
      {err ? (
        <p className="text-red-600" role="alert">
          {err}
        </p>
      ) : events.length === 0 ? (
        <p className="text-slate-500">아직 이벤트가 없습니다.</p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
          {events.map((ev, i) => (
            <li
              key={`${ev.timestamp}-${ev.type}-${ev.stateVersion}-${i}`}
              className="rounded border border-slate-100 bg-slate-50/80 px-2 py-1.5"
            >
              <div className="flex flex-wrap gap-2 font-medium text-slate-700">
                <span>{ev.type}</span>
                <span className="font-normal text-slate-500">v{ev.stateVersion}</span>
                <span className="font-normal text-slate-400">{ev.triggeredBy}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400">{ev.timestamp}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
