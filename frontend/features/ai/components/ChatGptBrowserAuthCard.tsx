import React, { useEffect, useState } from 'react';
import { useAiMcpStore } from '../store/useAiMcpStore';
import { CustomSelect } from '../../../common/components/CustomSelect';

export const ChatGptBrowserAuthCard: React.FC = () => {
  const { chatgptAuthStatus: status, isConnectingSubscription: acting, startChatGptOAuth, checkChatGptAuthStatus, loadSavedChatGptAuth, cancelChatGptOAuth, disconnectChatGptOAuth, refreshChatGptSession } = useAiMcpStore();
  const [selected, setSelected] = useState('');
  const [selectionReady, setSelectionReady] = useState(false);
  const pending = status?.phase === 'pending';
  const profiles = status?.profiles || [];
  useEffect(() => {
    if (status && (status.credentials_loaded || status.profiles?.length) && !selectionReady) { setSelected(status.active_profile_id || ''); setSelectionReady(true); }
  }, [status, selectionReady]);
  useEffect(() => { void checkChatGptAuthStatus(); }, [checkChatGptAuthStatus]);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void checkChatGptAuthStatus(), 1000);
    return () => clearInterval(timer);
  }, [pending, checkChatGptAuthStatus]);
  useEffect(() => {
    if (selected && !profiles.some((profile) => profile.id === selected)) setSelected('');
  }, [profiles, selected]);
  const chosen = profiles.find((profile) => profile.id === selected);
  const active = profiles.find((profile) => profile.id === status?.active_profile_id);
  return <section className="border border-surface1 bg-base p-3 space-y-3 text-xs">
    <h3 className="font-semibold">ChatGPT subscription · Browser sign-in</h3>
    <p className="text-subtext0">Sign in and authorize Stage0 in your system browser. No Codex CLI, API key or client secret is required. Credentials stay in your OS keyring.</p>
    <p className="text-subtext0">Sign-in does not send repository source or run a model. Subscription inference is not yet connected to the review harness.</p>
    {!status?.credentials_loaded && !status?.profiles?.length && !pending && <p className="text-subtext0">Saved sign-ins are not read automatically. Check saved sign-in to unlock your OS keyring when ready.</p>}
    {!status?.credentials_loaded && !status?.profiles?.length && !pending && <p className="text-subtext0">If an older sign-in cannot be imported, choose Add a ChatGPT account or workspace and reconnect. Older keyring items are retained; Stage0 will not request access to every old credential chunk.</p>}
    {status?.connected && <p role="status" className="text-green break-words">Saved sign-in: {active?.label || 'ChatGPT connection'} · {status.account_email || 'ChatGPT account'}. {status.plan_usage_enabled ? 'ChatGPT plan usage permission granted.' : 'ChatGPT plan usage permission is not enabled.'} Model access and quota have not been tested.</p>}
    {pending ? <div className="space-y-2">
      <p role="status">Waiting for browser authorization… Return here after signing in. Closing Preferences does not cancel sign-in.</p>
      <button type="button" disabled={acting} onClick={() => void cancelChatGptOAuth()} className="border border-surface1 px-3 py-1.5 disabled:opacity-40">Cancel sign-in</button>
    </div> : <>
      <CustomSelect value={selected} onChange={setSelected} disabled={acting} aria-label="ChatGPT account registration" options={[
        { value: '', label: 'Add a ChatGPT account or workspace' },
        ...profiles.map((profile) => ({ value: profile.id, label: `${profile.label}${profile.email ? ` · ${profile.email}` : ' · Registration pending sign-in'}` })),
      ]} />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={acting} onClick={() => void loadSavedChatGptAuth()} className="border border-surface1 px-3 py-1.5 disabled:opacity-40" title="Explicitly read saved sign-ins. Your OS may request keyring access.">Check saved sign-in</button>
        <button type="button" disabled={acting} onClick={() => void startChatGptOAuth(selected || undefined)} className="px-3 py-1.5 bg-primary text-on-accent font-semibold disabled:opacity-40">{acting ? 'Working…' : 'Continue with ChatGPT'}</button>
        {chosen?.signed_in && <>
          <button type="button" disabled={acting} onClick={() => void refreshChatGptSession(chosen.id)} className="border border-surface1 px-3 py-1.5 disabled:opacity-40">Refresh saved session</button>
          <button type="button" disabled={acting} onClick={() => void disconnectChatGptOAuth(chosen.id)} className="border border-red/40 text-red px-3 py-1.5 disabled:opacity-40">Sign out selected connection</button>
        </>}
      </div>
    </>}
    {status?.error && <p role="alert" className="text-red whitespace-pre-wrap break-words">{status.error}</p>}
    {status?.phase === 'cancelled' && <p role="status" className="text-subtext0">Sign-in cancelled locally. You may close the browser tab. This does not undo permissions already approved in ChatGPT.</p>}
    <p className="text-subtext0">Saved connections remain separate, even if their email addresses match. Reauthorize a saved connection to make it active. Manage permissions in ChatGPT Settings.</p>
  </section>;
};
