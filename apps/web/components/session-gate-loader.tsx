"use client";

import dynamic from "next/dynamic";

const SessionGate = dynamic(
  () => import("@/components/session-gate").then((mod) => ({ default: mod.SessionGate })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        불러오는 중…
      </div>
    )
  }
);

export function SessionGateLoader() {
  return <SessionGate />;
}
