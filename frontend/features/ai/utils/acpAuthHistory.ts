import type { AcpAgentConfig } from '../types/AcpAgentConfig';
import type { AcpLastSuccessfulSignIn } from '../types/AcpLastSuccessfulSignIn';
export type { AcpLastSuccessfulSignIn } from '../types/AcpLastSuccessfulSignIn';

const STORAGE_KEY = 'stage0_acp_auth_history';

type AuthHistory = Record<string, AcpLastSuccessfulSignIn>;

function readHistory(): AuthHistory {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as AuthHistory;
  } catch {
    return {};
  }
}

export function getLastSuccessfulSignIn(agent: AcpAgentConfig): AcpLastSuccessfulSignIn | null {
  if (typeof window === 'undefined') return null;
  const saved = readHistory()[agent.id];
  if (!saved || typeof saved.completedAt !== 'string' || typeof saved.methodLabel !== 'string') return null;
  return saved.agentVersion === agent.version ? saved : null;
}

export function saveLastSuccessfulSignIn(agent: AcpAgentConfig, signIn: AcpLastSuccessfulSignIn): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const history = readHistory();
    history[agent.id] = { ...signIn, agentVersion: agent.version };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return true;
  } catch {
    return false;
  }
}

export function forgetAgentSignIn(agentId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const history = readHistory();
    delete history[agentId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Sign-in history is informational and must not block agent removal.
  }
}
