"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "../lib/api-base";

type HealthOk = { ok: true; service: string };
type State =
  | { status: "loading" }
  | { status: "ok"; data: HealthOk }
  | { status: "error"; message: string };

export function ApiStatus() {
  const [state, setState] = useState<State>({ status: "loading" });
  const base = getApiBaseUrl();

  useEffect(() => {
    let cancelled = false;
    const url = `${base}/health`;

    void (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setState({
            status: "error",
            message: `HTTP ${res.status}: ${text.slice(0, 200)}`
          });
          return;
        }
        let json: unknown;
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          setState({ status: "error", message: "응답이 JSON이 아닙니다." });
          return;
        }
        const obj = json as Record<string, unknown>;
        if (obj.ok === true && typeof obj.service === "string") {
          setState({
            status: "ok",
            data: { ok: true, service: obj.service }
          });
        } else {
          setState({ status: "error", message: text.slice(0, 200) });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            status: "error",
            message: e instanceof Error ? e.message : String(e)
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base]);

  return (
    <section
      style={{
        marginTop: 24,
        padding: 16,
        borderRadius: 8,
        background: "#fff",
        border: "1px solid #e5e7eb"
      }}
    >
      <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>API 연결</h2>
      <p style={{ margin: "0 0 12px", color: "#6b7280", fontSize: 14 }}>
        베이스 URL: <code>{base}</code> → <code>GET /health</code>
      </p>
      {state.status === "loading" && <p style={{ margin: 0 }}>확인 중…</p>}
      {state.status === "ok" && (
        <p style={{ margin: 0, color: "#059669" }}>
          연결됨 — <code>{state.data.service}</code>
        </p>
      )}
      {state.status === "error" && (
        <p style={{ margin: 0, color: "#dc2626" }}>실패 — {state.message}</p>
      )}
    </section>
  );
}
