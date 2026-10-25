import { createRequire } from 'node:module';
import { loadWithMocks } from './componentHarness.mjs';

const { create } = createRequire(import.meta.url)('zustand');

export function deviceStatus(phase = 'idle', extra = {}) {
  return { attemptId: 'attempt-a', phase,
    userCode: phase === 'pending' ? 'ABCD-1234' : null,
    verificationUrl: phase === 'pending' ? 'https://auth.openai.com/codex/device' : null,
    accountEmail: null, planType: null, deadlineAt: null, error: null, ...extra };
}

export function deviceAuthFixture(handler = () => deviceStatus(), native = true) {
  const calls = [];
  const { useChatGptDeviceAuthStore: store } = loadWithMocks(
    new URL('../../frontend/features/ai/store/useChatGptDeviceAuthStore.ts', import.meta.url), {
      zustand: { create },
      '@tauri-apps/api/core': { isTauri: () => native, invoke: async (...args) => {
        calls.push(args); return handler(...args);
      } },
    });
  return { store, calls };
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
