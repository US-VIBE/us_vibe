"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/auth-gate";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { WorkspaceApp } from "@/components/workspace/workspace-app";
import { fetchAuthMe } from "@/lib/auth-api";
import type { AuthState } from "@/lib/auth-types";
import { clearAuth, loadAuthState, saveAuthState } from "@/lib/auth-storage";
import { clearSession, loadSession } from "@/lib/session-storage";
import type { LearningSession } from "@/lib/session-types";

function apiUrlConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
}

/** `page.tsx`에서 `dynamic(..., { ssr: false })`로만 로드 — 클라이언트에서만 마운트 */
export function SessionGate() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuthState());
  const [session, setSession] = useState<LearningSession | null>(() => loadSession());
  const [authChecked, setAuthChecked] = useState(() => !apiUrlConfigured());

  useEffect(() => {
    if (!apiUrlConfigured()) return;
    const existing = loadAuthState();
    if (!existing?.token) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const user = await fetchAuthMe();
      if (cancelled) return;
      if (user) {
        const next = { token: existing.token, user };
        setAuth(next);
        saveAuthState(next);
      } else {
        clearAuth();
        setAuth(null);
      }
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (apiUrlConfigured() && !authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500">
        인증 확인 중…
      </div>
    );
  }

  if (apiUrlConfigured() && !auth) {
    return <AuthGate onAuthed={setAuth} />;
  }

  if (!session) {
    return <OnboardingForm onSessionCreated={setSession} />;
  }

  return (
    <WorkspaceApp
      session={session}
      authUser={apiUrlConfigured() && auth ? auth.user : undefined}
      onAuthLogout={
        apiUrlConfigured()
          ? () => {
              clearAuth();
              clearSession();
              setAuth(null);
              setSession(null);
            }
          : undefined
      }
      onLeaveSession={() => {
        clearSession();
        setSession(null);
      }}
    />
  );
}
