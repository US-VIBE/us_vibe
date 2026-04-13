import type { AuthState, AuthUser } from "./auth-types";
import { apiFetch } from "./api-fetch";

function apiBase(): string | null {
  const b = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  return b || null;
}

export async function loginRequest(email: string, password: string): Promise<AuthState> {
  const base = apiBase();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL이 설정되지 않았습니다.");
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password })
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractErrorMessage(json));
  }
  const data = unwrapAuth(json);
  if (!data) throw new Error("응답 형식 오류");
  return data;
}

export async function registerRequest(email: string, password: string): Promise<AuthState> {
  const base = apiBase();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL이 설정되지 않았습니다.");
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password })
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(extractErrorMessage(json));
  }
  const data = unwrapAuth(json);
  if (!data) throw new Error("응답 형식 오류");
  return data;
}

function extractErrorMessage(json: unknown): string {
  if (!json || typeof json !== "object") return "요청 실패";
  const o = json as Record<string, unknown>;
  const m = o.message;
  if (typeof m === "string") return m;
  if (Array.isArray(m)) return m.map(String).join(", ");
  return "요청 실패";
}

function unwrapAuth(json: unknown): AuthState | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const data = (o.data as Record<string, unknown> | undefined) ?? o;
  const token = typeof data.accessToken === "string" ? data.accessToken : null;
  const userRaw = data.user;
  if (!token || !userRaw || typeof userRaw !== "object") return null;
  const u = userRaw as Record<string, unknown>;
  if (typeof u.id !== "string" || typeof u.email !== "string" || typeof u.role !== "string") {
    return null;
  }
  return {
    token,
    user: { id: u.id, email: u.email, role: u.role }
  };
}

/** 리프레시 쿠키로 액세스 토큰 재발급(회전). 실패 시 null. */
export async function refreshAuthSession(): Promise<AuthState | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await fetch(`${base}/api/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok || !json) return null;
  return unwrapAuth(json);
}

/** 토큰 유효성 확인 (API 연동 모드) */
export async function fetchAuthMe(): Promise<AuthUser | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await apiFetch(`${base}/api/auth/me`);
  if (!res.ok) return null;
  const json: unknown = await res.json().catch(() => null);
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const data = (o.data as Record<string, unknown> | undefined)?.user ?? o.user;
  if (!data || typeof data !== "object") return null;
  const u = data as Record<string, unknown>;
  if (typeof u.id !== "string" || typeof u.email !== "string" || typeof u.role !== "string") {
    return null;
  }
  return { id: u.id, email: u.email, role: u.role };
}
