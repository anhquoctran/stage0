import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useChatGptDeviceAuthStore } from '../store/useChatGptDeviceAuthStore';
import { formatDateTime } from '../../../common/utils/dateTime';

const VERIFICATION_URL = 'https://auth.openai.com/codex/device';
const BUSY_PHASES = ['starting', 'checking', 'pending', 'cancelling', 'signing_out'];

export const ChatGptDeviceCodeCard: React.FC = () => {
  const { status, isActing, error, refresh, start, checkSaved, cancel, logout } = useChatGptDeviceAuthStore();
  const [allowLaunch, setAllowLaunch] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const phase = status?.phase || 'idle';
  const busy = BUSY_PHASES.includes(phase);
  useEffect(() => { void refresh(); }, [refresh]); // Metadata only; never launches a process.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void refresh(), 1000);
    return () => clearInterval(timer);
  }, [busy, refresh]);

  const open = async () => {
    if (phase !== 'pending' || status?.verificationUrl !== VERIFICATION_URL) return;
    setActionError(null);
    try { await invoke('open_external_url', { url: VERIFICATION_URL }); }
    catch { setActionError('Could not open your system browser. Open the displayed official URL manually.'); }
  };
  const copy = async () => {
    if (phase !== 'pending' || !status?.userCode) return;
    setActionError(null);
    try { await navigator.clipboard.writeText(status.userCode); }
    catch { setActionError('Could not copy the code. Select and copy it manually.'); }
  };

  return <section className="border border-surface1 bg-base p-3 space-y-3 text-xs">
    <h3 className="font-semibold">ChatGPT subscription · Device code via Codex</h3>
    <p className="text-subtext0">Uses the installed official Codex authentication service in a separate Stage0 profile. Codex stores tokens in your OS keyring; no token is returned to this UI. Your existing Codex CLI login is not changed.</p>
    <p className="text-subtext0">Authentication only: this is not an API key and does not enable subscription inference or AI review. Device-code login must be allowed in your ChatGPT security settings or by your workspace admin.</p>
    <p role="status" className="text-subtext0">Status: <span className="font-mono">{phase.replaceAll('_', ' ')}</span></p>
    {phase === 'signed_in' && <p className="text-green break-words">Signed in: {status?.accountEmail || 'ChatGPT account'}{status?.planType ? ` · ${status.planType}` : ''}. Model access and usage limits have not been verified.</p>}
    {!busy && <>
      <label className="flex items-start gap-2"><input type="checkbox" checked={allowLaunch} onChange={(event) => setAllowLaunch(event.target.checked)} className="accent-primary mt-0.5" /><span>Allow Stage0 to launch the installed Codex authentication service. No repository source or inference request will be sent.</span></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!allowLaunch || isActing} onClick={() => { setAllowLaunch(false); void start(); }} className="px-3 py-1.5 bg-primary text-on-accent font-semibold disabled:opacity-40">Continue with ChatGPT</button>
        <button type="button" disabled={!allowLaunch || isActing} onClick={() => { setAllowLaunch(false); void checkSaved(); }} className="px-3 py-1.5 border border-surface1 disabled:opacity-40">Check saved sign-in</button>
        {status?.attemptId && <button type="button" disabled={isActing} onClick={() => void logout()} className="px-3 py-1.5 border border-red/40 text-red disabled:opacity-40">Sign out Stage0 Codex profile</button>}
      </div>
    </>}
    {busy && ['starting', 'pending', 'cancelling'].includes(phase) && <button type="button" disabled={isActing || phase === 'cancelling'} onClick={() => void cancel()} className="px-3 py-1.5 border border-surface1 disabled:opacity-40">{phase === 'cancelling' ? 'Cancelling…' : 'Cancel sign-in'}</button>}
    {phase === 'pending' && status?.userCode && <div className="border border-surface1 bg-mantle p-3 space-y-2">
      <p>Open the official page and enter this one-time code:</p>
      <p className="font-mono text-lg select-all tracking-widest">{status.userCode}</p>
      <p className="font-mono text-[11px] break-all select-text">{status.verificationUrl}</p>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void open()} disabled={status.verificationUrl !== VERIFICATION_URL} className="border border-surface1 px-3 py-1.5 disabled:opacity-40">Open sign-in page</button><button type="button" onClick={() => void copy()} className="border border-surface1 px-3 py-1.5">Copy code</button></div>
      <p className="text-subtext0">Do not share this code or paste it into chats. Stage0 waits for completion automatically.</p>
      {status.deadlineAt && <p className="text-subtext0">Local wait deadline: {formatDateTime(status.deadlineAt)}. The provider may expire its code earlier.</p>}
    </div>}
    {(error || status?.error || actionError) && <p role="alert" className="text-red whitespace-pre-wrap break-words">{error || status?.error || actionError}</p>}
  </section>;
};
