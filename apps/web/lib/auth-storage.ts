import type { AuthState, AuthUser } from "./auth-types";

const TOKEN_KEY = "usvibe_access_token";
const USER_KEY = "usvibe_auth_user";

export function loadAuthState(): AuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const raw = sessionStorage.getItem(USER_KEY);
    if (!token || !raw) return null;
    const user = JSON.parse(raw) as AuthUser;
    if (!user?.id || !user?.email) return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function saveAuthState(state: AuthState): void {
  sessionStorage.setItem(TOKEN_KEY, state.token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(state.user));
}

export function clearAuth(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}
