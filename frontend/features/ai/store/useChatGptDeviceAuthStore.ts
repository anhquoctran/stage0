import { getApplicationServices } from '../../../core/services/runtime/applicationRuntime';
import { create } from 'zustand';

import type { ChatGptDeviceAuthState } from '../types/ChatGptDeviceAuthState';
import type { ChatGptDeviceAuthStatus } from '../types/ChatGptDeviceAuthStatus';

let epoch = 0;
let pollSequence = 0;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const phases = ['idle', 'starting', 'pending', 'checking', 'signed_in', 'signed_out', 'cancelling', 'cancelled', 'signing_out', 'failed'];
function publicStatus(value: ChatGptDeviceAuthStatus): ChatGptDeviceAuthStatus {
  if (!value || !phases.includes(value.phase) || typeof value.attemptId !== 'string') throw new Error('Invalid ChatGPT device authentication state.');
  if (value.phase === 'pending' && (value.verificationUrl !== 'https://auth.openai.com/codex/device' || !value.userCode || !/^[A-Za-z0-9-]{4,64}$/.test(value.userCode))) throw new Error('Refusing invalid ChatGPT device-code instructions.');
  return {
    attemptId: value.attemptId, phase: value.phase,
    userCode: value.phase === 'pending' ? value.userCode : null,
    verificationUrl: value.phase === 'pending' ? value.verificationUrl : null,
    deadlineAt: value.phase === 'pending' ? value.deadlineAt : null,
    accountEmail: value.phase === 'signed_in' ? value.accountEmail : null,
    planType: value.phase === 'signed_in' ? value.planType : null,
    error: value.error,
  };
}

// No persistence: user codes are sensitive, temporary sign-in instructions.
export const useChatGptDeviceAuthStore = create<ChatGptDeviceAuthState>((set, get) => {
  const act = async (operation: () => Promise<ChatGptDeviceAuthStatus>, recoverMetadata = false) => {
    if (get().isActing) return;
    const version = ++epoch;
    set({ isActing: true, error: null });
    try {
      if (!getApplicationServices().platform.capabilities.keychain) throw new Error('ChatGPT device-code sign-in requires the native Stage0 app and the official Codex CLI.');
      const status = publicStatus(await operation());
      if (version === epoch) set({ status });
    } catch (error) {
      if (version === epoch) {
        // The native operation may have changed its session before failing.
        // Drop stale connected state and recover through metadata only.
        set({ status: null, error: message(error) });
        if (getApplicationServices().platform.capabilities.keychain && recoverMetadata) {
          try {
            const status = publicStatus(await getApplicationServices().deviceAuth.chatgptDeviceAuthStatus());
            if (version === epoch) set({ status });
          } catch { /* Keep the original action error and the cleared status. */ }
        }
      }
    }
    finally { if (version === epoch) set({ isActing: false }); }
  };
  return {
    status: null, isActing: false, error: null,
    refresh: async () => {
      if (get().isActing) return;
      const version = epoch; const sequence = ++pollSequence;
      if (!getApplicationServices().platform.capabilities.keychain) return;
      try {
        const status = publicStatus(await getApplicationServices().deviceAuth.chatgptDeviceAuthStatus());
        if (version === epoch && sequence === pollSequence && !get().isActing) set({ status, error: null });
      } catch (error) { if (version === epoch && sequence === pollSequence) set({ error: message(error) }); }
    },
    start: () => act(() => getApplicationServices().deviceAuth.chatgptDeviceAuthStart()),
    checkSaved: () => act(() => getApplicationServices().deviceAuth.chatgptDeviceAuthCheck(), true),
    cancel: async () => { const id = get().status?.attemptId; if (id) await act(() => getApplicationServices().deviceAuth.chatgptDeviceAuthCancel({ attemptId: id }), true); },
    logout: async () => { const id = get().status?.attemptId; if (id) await act(() => getApplicationServices().deviceAuth.chatgptDeviceAuthLogout({ attemptId: id }), true); },
  };
});
