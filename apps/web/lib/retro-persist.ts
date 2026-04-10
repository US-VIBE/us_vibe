import type { RetroReport } from "./retro-types";

const key = (sessionId: string) => `usvibe_retro_${sessionId}`;

export type RetroPersist = {
  reports: RetroReport[];
};

export function loadRetroPersist(sessionId: string): RetroPersist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as RetroPersist;
  } catch {
    return null;
  }
}

export function saveRetroPersist(sessionId: string, state: RetroPersist): void {
  sessionStorage.setItem(key(sessionId), JSON.stringify(state));
}

export function clearRetroPersist(sessionId: string): void {
  sessionStorage.removeItem(key(sessionId));
}
