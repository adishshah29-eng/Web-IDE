import type { Content } from "@google/genai";
import type { AgentLogEntry } from "./useAgent";

export interface PersistedAgentState {
  log: AgentLogEntry[];
  history: Content[];
}

const PREFIX = "ide.agent.";

export function loadAgentState(key: string): PersistedAgentState | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.log) || !Array.isArray(parsed?.history)) return null;
    return parsed as PersistedAgentState;
  } catch {
    return null;
  }
}

export function saveAgentState(key: string, state: PersistedAgentState): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(state));
  } catch {
    // localStorage full/unavailable (private mode, quota) — persistence is a nicety, not required
  }
}

export function clearAgentState(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
