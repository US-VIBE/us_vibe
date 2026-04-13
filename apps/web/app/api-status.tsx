"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBaseUrl, isPublicApiConfigured } from "../lib/api-base";

type HealthOk = { ok: true; service: string };
type State =
  | { status: "loading" }
  | { status: "ok"; data: HealthOk }
  | { status: "error"; message: string };

const CONFIG_ERROR_MESSAGE =
  "Nest API URL이 없습니다. Netlify(또는 프론트 호스트) 환경 변수에 NEXT_PUBLIC_API_URL(끝 / 없이)을 설정한 뒤 다시 배포하세요.";

type FetchResult =
  | { status: "ok"; data: HealthOk }
  | { status: "error"; message: string };

type FetchState = { base: string } & FetchResult;

export function ApiStatus() {
  const base = getApiBaseUrl();
  const missingConfig = !isPublicApiConfigured() || !base;
  const [fetchState, setFetchState] = useState<FetchState | null>(null);

  const state: State = useMemo(() => {
    if (missingConfig) {
      return { status: "error", message: CONFIG_ERROR_MESSAGE };
    }
    if (!fetchState || fetchState.base !== base) {
      return { status: "loading" };
    }
    return fetchState;
  }, [base, fetchState, missingConfig]);

  useEffect(() => {
    if (missingConfig) {
      return;
    }
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
          setFetchState({
            base,
            status: "error",
            message: `HTTP ${res.status}: ${text.slice(0, 200)}`
          });
          return;
        }
        let json: unknown;
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          setFetchState({
            base,
            status: "error",
            message: "응답이 JSON이 아닙니다."
          });
          return;
        }
        const obj = json as Record<string, unknown>;
        if (obj.ok === true && typeof obj.service === "string") {
          setFetchState({
            base,
            status: "ok",
            data: { ok: true, service: obj.service }
          });
        } else {
          setFetchState({
            base,
            status: "error",
            message: text.slice(0, 200)
          });
        }
      } catch (e) {
        if (!cancelled) {
          setFetchState({
            base,
            status: "error",
            message: e instanceof Error ? e.message : String(e)
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base, missingConfig]);

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
