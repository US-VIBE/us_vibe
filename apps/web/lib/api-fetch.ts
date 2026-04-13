import { refreshAuthSession } from "./auth-api";
import { getAccessToken } from "./auth-storage";

/** 백엔드 API 호출 시 Bearer 토큰을 붙인다. 401이면 리프레시 쿠키로 1회 재시도한다. */
export async function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  return apiFetchWithOptionalRefresh(input, init, false);
}

async function apiFetchWithOptionalRefresh(
  input: string | URL,
  init: RequestInit | undefined,
  alreadyRefreshed: boolean
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  const res = await fetch(input, { ...init, credentials: "include", headers });
  if (res.status === 401 && !alreadyRefreshed) {
    const next = await refreshAuthSession();
    if (next) {
      return apiFetchWithOptionalRefresh(input, init, true);
    }
  }
  return res;
}
