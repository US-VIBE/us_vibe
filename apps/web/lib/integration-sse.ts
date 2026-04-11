import { getAccessToken } from "./auth-storage";

/**
 * GET /api/integration/stream — Bearer는 EventSource가 못 쓰므로 fetch + SSE 파싱.
 */
export function startIntegrationSseStream(
  apiBase: string,
  onData: (rawJsonOrText: string) => void,
  signal: AbortSignal
): Promise<void> {
  const base = apiBase.replace(/\/$/, "");
  const url = `${base}/api/integration/stream`;
  const token = getAccessToken();

  return (async () => {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      credentials: "include",
      signal
    });
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
