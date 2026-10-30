import React, { useEffect, useState } from 'react';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { useAiMcpStore } from '../../ai/store/useAiMcpStore';
import { useHarnessConnectionStore } from '../store/useHarnessConnectionStore';
import { mcpConnectionKey } from '../utils/mcpConnectionKey';
import type { HarnessConnectionsPanelProps } from '../types/HarnessConnectionsPanelProps';
import { useTranslation } from 'react-i18next';

const CLI_OPTIONS = [
  { value: 'claude', label: 'Claude Code' }, { value: 'gh_copilot', label: 'GitHub CLI' },
  { value: 'gcloud', label: 'Google Cloud CLI' }, { value: 'grok', label: 'Grok CLI' },
];

export const HarnessConnectionsPanel: React.FC<HarnessConnectionsPanelProps> = ({ draftServers } = {}) => {
  const { t } = useTranslation();
  const committedServers = useAiMcpStore((state) => state.mcpServers);
  const servers = draftServers || committedServers;
  const { mcp, cli, cliError, isInspectingCli, discover, inspectCli } = useHarnessConnectionStore();
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [cliType, setCliType] = useState('claude');
  const connectionKeys = servers.map(mcpConnectionKey).join('|');
  useEffect(() => { setConsent({}); }, [connectionKeys]);

  return <details className="border border-surface1 bg-base p-3 text-xs">
    <summary className="font-semibold cursor-pointer">{t('review.harnessConnections.title')}</summary>
    <div className="mt-3 space-y-3">
      <p className="text-subtext0">{t('review.harnessConnections.discoveryDisclaimer')}</p>
      <p className="text-subtext0">{t('review.harnessConnections.protocolSupport')}</p>
      {servers.length === 0 && <p>{t('review.harnessConnections.empty')}</p>}
      {servers.map((server) => {
        const saved = committedServers.find((item) => item.id === server.id);
        const pendingCommit = !saved || mcpConnectionKey(saved) !== mcpConnectionKey(server);
        const state = mcp[server.id];
        const current = state?.requestKey === mcpConnectionKey(server) ? state : undefined;
        return <section key={server.id} className="border border-surface0 p-3 space-y-2">
          <p className="font-semibold break-words">{server.name} · {server.type} · {server.enabled ? t('common.enabled') : t('common.disabled')}</p>
          {pendingCommit && <p className="text-subtext0">{t('review.harnessConnections.pendingSave')}</p>}
          {server.type === 'http' && !pendingCommit ? <>
            <p className="font-mono text-[11px] text-subtext0 break-all">{server.url}</p>
            <label className="flex items-start gap-2"><input type="checkbox" disabled={!server.enabled || current?.status === 'discovering'} checked={!!consent[server.id]} onChange={(event) => setConsent((value) => ({ ...value, [server.id]: event.target.checked }))} className="accent-primary mt-0.5" /><span>{t('review.harnessConnections.discoveryConsent')}</span></label>
            <button type="button" disabled={!server.enabled || !consent[server.id] || current?.status === 'discovering'} onClick={() => { setConsent((value) => ({ ...value, [server.id]: false })); void discover(server, true); }} className="border border-surface1 px-3 py-1.5 disabled:opacity-40 rounded-sm">{current?.status === 'discovering' ? t('review.harnessConnections.discovering') : t('review.harnessConnections.discoverTools')}</button>
            {current?.error && <p role="alert" className="text-red whitespace-pre-wrap break-words">{current.error}</p>}
            {current?.report && <div className="space-y-1" role="status">
              <p>{t('review.harnessConnections.toolsDiscovered', { count: current.report.tools.length, server: current.report.serverName, version: current.report.serverVersion })}</p>
              <p className="font-mono text-[10px] text-subtext0 break-all">{t('review.harnessConnections.catalog')} {current.report.catalogFingerprint}</p>
              <ul className="max-h-32 overflow-auto space-y-1">{current.report.tools.map((tool) => <li key={tool.namespacedName} className="break-all"><code>{tool.name}</code> · <span className="text-subtext0">{tool.namespacedName} · {t('review.harnessConnections.readOnlyHint')}: {tool.readOnlyHint === null ? t('review.harnessConnections.unspecified') : String(tool.readOnlyHint)} ({t('review.harnessConnections.untrusted')})</span></li>)}</ul>
            </div>}
          </> : server.type !== 'http' && <p className="text-subtext0">{server.type === 'stdio' ? t('review.harnessConnections.stdioWarning') : t('review.harnessConnections.legacySseWarning')}</p>}
        </section>;
      })}
      <section className="border-t border-surface0 pt-3 space-y-2">
        <p className="font-semibold">{t('review.harnessConnections.cliPreflight')}</p>
        <CustomSelect value={cliType} onChange={setCliType} options={CLI_OPTIONS} aria-label={t('review.harnessConnections.cliAria')} className="w-full" buttonClassName="w-full" dropdownWidth="w-full" align="left" />
        <button type="button" disabled={isInspectingCli} onClick={() => void inspectCli(cliType)} className="border border-surface1 px-3 py-1.5 disabled:opacity-40 rounded-sm">{isInspectingCli ? t('review.harnessConnections.inspectingPath') : t('review.harnessConnections.inspectExecutable')}</button>
        {cliError && <p role="alert" className="text-red">{cliError}</p>}
        {cli?.cliType === cliType && <div role="status" className="space-y-1 text-subtext0"><p>{cli.executableFound ? t('review.harnessConnections.executableFound') : t('review.harnessConnections.executableNotFound')} · {t('review.harnessConnections.notAttached')}</p><p className="font-mono break-all">{cli.executablePath}</p><p>{cli.message}</p><p>{t('review.harnessConnections.wrapperContract')}: <code>{cli.requiredProtocol}</code></p></div>}
      </section>
    </div>
  </details>;
};
