import { refreshAuthSession } from "./auth-api";
import { getAccessToken } from "./auth-storage";

/**
 * GET /api/integration/stream — Bearer는 EventSource가 못 쓰므로 fetch + SSE 파싱.
 * `sessionId`는 서버에서 워크스페이스 접근 검사 및 Redis 이벤트 필터에 사용된다.
 */
export function startIntegrationSseStream(
  apiBase: string,
  sessionId: string,
  onData: (rawJsonOrText: string) => void,
  signal: AbortSignal
): Promise<void> {
  const base = apiBase.replace(/\/$/, "");
  const sid = encodeURIComponent(sessionId);
  const url = `${base}/api/integration/stream?sessionId=${sid}`;

  const openStream = async (): Promise<Response> => {
    const token = getAccessToken();
    return fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      credentials: "include",
      signal
    });
  };

  return (async () => {
    let res = await openStream();
    if (res.status === 401) {
      await refreshAuthSession();
      res = await openStream();
    }
    if (!res.ok || !res.body) {
      throw new Error(`SSE ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        if (line.startsWith("data:")) {
          const payload = line.replace(/^data:\s?/, "");
          if (payload.length) {
            onData(payload);
          }
        }
      }
    }
  })();
}
