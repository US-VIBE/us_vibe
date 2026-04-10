import type { SpecConversionResult } from "./prompt-spec-types";

const key = (sessionId: string) => `usvibe_prompt_spec_${sessionId}`;

export type PersistedSpecState = {
  approved: boolean;
  conversion: SpecConversionResult | null;
};

export function loadPersistedSpec(sessionId: string): PersistedSpecState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(sessionId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedSpecState;
    if (typeof p.approved !== "boolean") return null;
    return p;
  } catch {
    return null;
  }
}

export function savePersistedSpec(sessionId: string, state: PersistedSpecState): void {
  sessionStorage.setItem(key(sessionId), JSON.stringify(state));
}

export function clearPersistedSpec(sessionId: string): void {
  sessionStorage.removeItem(key(sessionId));
}
