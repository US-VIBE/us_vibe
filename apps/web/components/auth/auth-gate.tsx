"use client";

import { useState, type FormEvent } from "react";
import { loginRequest, registerRequest } from "@/lib/auth-api";
import type { AuthState } from "@/lib/auth-types";
import { saveAuthState } from "@/lib/auth-storage";

type Props = {
  onAuthed: (state: AuthState) => void;
};

export function AuthGate({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const state =
        mode === "login"
          ? await loginRequest(email.trim(), password)
          : await registerRequest(email.trim(), password);
      saveAuthState(state);
      onAuthed(state);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">US Vibe 계정</h1>
        <p className="mt-1 text-sm text-slate-600">
          API 서버(<code className="rounded bg-slate-100 px-1 text-xs">NEXT_PUBLIC_API_URL</code>)를 쓸 때는
          로그인 후 워크스페이스 API가 보호됩니다.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={
              mode === "login"
                ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white"
                : "rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
            }
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            로그인
          </button>
          <button
            type="button"
            className={
              mode === "register"
                ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs text-white"
                : "rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700"
            }
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            회원가입
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label className="block text-xs font-medium text-slate-700" htmlFor="auth-email">
              이메일
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700" htmlFor="auth-password">
              비밀번호 {mode === "register" && "(8자 이상)"}
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입 후 로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
