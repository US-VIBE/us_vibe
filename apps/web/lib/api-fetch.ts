import { getAccessToken } from "./auth-storage";

/** 백엔드 API 호출 시 Bearer 토큰을 붙인다. */
export function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(input, { ...init, credentials: "include", headers });
}
