import type { ValidationResult } from "@specs/data-model/types";

const key = (sessionId: string) => `usvibe_contract_gate_${sessionId}`;

export type ContractGatePersist = {
  openApiYaml: string;
  validationResult: ValidationResult | null;
  contractApproved: boolean;
};

export function loadContractGate(sessionId: string): ContractGatePersist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as ContractGatePersist;
  } catch {
    return null;
  }
}

export function saveContractGate(sessionId: string, state: ContractGatePersist): void {
  sessionStorage.setItem(key(sessionId), JSON.stringify(state));
}

export function clearContractGate(sessionId: string): void {
  sessionStorage.removeItem(key(sessionId));
}
