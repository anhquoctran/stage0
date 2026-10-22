import { isTauri } from '@tauri-apps/api/core';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { ExternalLink } from '../../../../common/components/icons/ExternalLink';
import { Trash2 } from '../../../../common/components/icons/Trash2';
import { ExternalAgentsModal as Modal } from '../ExternalAgentsModal';
import type { AcpAgentDetailsProps } from './AcpAgentDetailsProps';

export function AcpAgentDetails({
  detailAgent,
  setDetailAgent,
  setDetailRegistryEntry,
  error,
  notice,
  setRemovePending,
  detailRegistryEntry,
  projectLicenseUrl,
  registryDistribution,
  reportedAgentInfo,
  projectWebsiteUrl,
  projectRepositoryUrl,
  removePending,
  removeAgent,
  authStatus,
  lastSuccessfulSignIn,
  isCheckingAuth,
  supportsAuthStatus,
  authMethods,
  selectedAuthMethod,
  setSelectedAuthMethod,
  busyId,
  isProtocolAuthMethod,
  selectedAuthOption,
  signIn,
  currentRepoPath,
  prompt,
  setPrompt,
  isSendingPrompt,
  sendPrompt,
  response,
}: AcpAgentDetailsProps) {
  return (
    <Modal
      title={detailAgent.name}
      onClose={() => {
        setDetailAgent(null);
        setDetailRegistryEntry(null);
      }}
    >
      <div className="space-y-4">
        {error && (
          <p
            role="status"
            className="border border-yellow/40 bg-yellow/5 px-3 py-2 text-xs text-yellow"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="border border-green/40 bg-green/5 px-3 py-2 text-xs text-green"
          >
            {notice}
          </p>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {detailAgent.name}
              {detailAgent.version ? ` · ${detailAgent.version}` : ''}
            </p>
            <p className="mt-1 text-xs text-subtext0">
              {detailAgent.description || 'Custom ACP agent'} ·{' '}
              {detailAgent.launchMode === 'binary'
                ? `Native binary · ${detailAgent.command}`
                : `${detailAgent.command} ${detailAgent.args.join(' ')}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRemovePending(true)}
            className="flex items-center gap-1.5 border border-red/40 px-2.5 py-1.5 text-xs text-red hover:bg-red/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Uninstall
          </button>
        </div>
        {detailRegistryEntry ? (
          <section className="space-y-3 border border-surface1 bg-base/40 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold">ACP Registry project information</h3>
              <span className="text-[10px] text-subtext0">
                Registry metadata · {detailRegistryEntry.version}
              </span>
            </div>
            <div className="grid gap-x-4 gap-y-2 text-[11px] sm:grid-cols-[110px_minmax(0,1fr)]">
              <span className="text-subtext0">Project ID</span>
              <code className="break-all">{detailRegistryEntry.id}</code>
              <span className="text-subtext0">License</span>
              <span>
                {detailRegistryEntry.license || 'Not provided'}
                {projectLicenseUrl && (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={projectLicenseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline"
                    >
                      License details <ExternalLink className="inline h-3 w-3" />
                    </a>
                  </>
                )}
              </span>
              <span className="text-subtext0">Distribution</span>
              <code className="break-all">{registryDistribution(detailRegistryEntry)}</code>
              <span className="text-subtext0">Installed launch</span>
              <code className="break-all">
                {detailAgent.command} {detailAgent.args.join(' ')}
              </code>
              {reportedAgentInfo && (
                <>
                  <span className="text-subtext0">Agent-reported runtime</span>
                  <span>
                    {[reportedAgentInfo.title || reportedAgentInfo.name, reportedAgentInfo.version]
                      .filter(Boolean)
                      .join(' · ') || 'Name/version not provided'}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              {detailRegistryEntry.website &&
                (projectWebsiteUrl ? (
                  <a
                    href={projectWebsiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    Project website <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="break-all text-subtext0">
                    Website listed: {detailRegistryEntry.website}
                  </span>
                ))}
              {detailRegistryEntry.repository &&
                (projectRepositoryUrl ? (
                  <a
                    href={projectRepositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand hover:underline"
                  >
                    Source repository <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="break-all text-subtext0">
                    Repository listed: {detailRegistryEntry.repository}
                  </span>
                ))}
              {!detailRegistryEntry.website && !detailRegistryEntry.repository && (
                <span className="text-subtext0">
                  No website or source repository was published in this Registry entry.
                </span>
              )}
            </div>
            <p className="text-[10px] text-subtext0">
              This is the project information and launch configuration Stage0 received from the ACP
              Registry; it is not an independent security or publisher verification.
            </p>
          </section>
        ) : (
          <section className="space-y-2 border border-surface1 bg-base/40 p-3">
            <h3 className="text-xs font-semibold">Custom agent configuration</h3>
            <p className="break-all text-[11px] text-subtext0">
              Launch command:{' '}
              <code>
                {detailAgent.command} {detailAgent.args.join(' ')}
              </code>
            </p>
            {reportedAgentInfo && (
              <p className="text-[11px] text-subtext0">
                Agent-reported runtime:{' '}
                {[reportedAgentInfo.title || reportedAgentInfo.name, reportedAgentInfo.version]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </section>
        )}
        {removePending && (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-red/40 bg-red/5 p-3 text-xs">
            <span>
              Uninstall this launch config from Stage0? Its package cache may remain on this
              computer.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRemovePending(false)}
                className="border border-surface2 px-2.5 py-1.5"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={removeAgent}
                className="border border-red/50 px-2.5 py-1.5 text-red"
              >
                Uninstall
              </button>
            </div>
          </div>
        )}
        <section className="space-y-2 border-t border-surface1 pt-4">
          <h3 className="text-xs font-semibold">Account & sign-in</h3>
          <p className="text-[11px] text-subtext0">
            Stage0 checks the agent automatically when this window opens. Account details come only
            from the agent; Stage0 never reads or stores its credentials.
          </p>
          <div
            role="status"
            aria-live="polite"
            className={`border px-3 py-2 text-xs ${authStatus?.kind === 'none' ? 'border-yellow/40 bg-yellow/5 text-yellow' : authStatus ? 'border-green/40 bg-green/5 text-green' : lastSuccessfulSignIn ? 'border-brand/40 bg-brand/5 text-text' : 'border-surface1 bg-base/40 text-subtext0'}`}
          >
            {isCheckingAuth ? (
              'Checking account and sign-in methods…'
            ) : authStatus ? (
              <div className="space-y-0.5">
                <p className="font-medium">
                  {authStatus.kind === 'none' ? 'Not signed in' : authStatus.label}
                </p>
                {authStatus.account?.email && <p>{authStatus.account.email}</p>}
                {authStatus.account?.organization && (
                  <p>Organization: {authStatus.account.organization}</p>
                )}
                {authStatus.account?.plan && <p>Plan: {authStatus.account.plan}</p>}
                {authStatus.detail && <p>{authStatus.detail}</p>}
                {authStatus.kind === 'none' && lastSuccessfulSignIn && (
                  <p>
                    A previous sign-in completed via {lastSuccessfulSignIn.methodLabel} on{' '}
                    {new Date(lastSuccessfulSignIn.completedAt).toLocaleString()}, but this agent
                    now reports that it is signed out.
                  </p>
                )}
              </div>
            ) : lastSuccessfulSignIn ? (
              <div className="space-y-0.5">
                <p className="font-medium">Last sign-in completed</p>
                <p>
                  {lastSuccessfulSignIn.methodLabel} ·{' '}
                  {new Date(lastSuccessfulSignIn.completedAt).toLocaleString()}
                </p>
                <p>
                  This is a saved result from this device, not a live account check. The agent does
                  not report account identity or current sign-in status over ACP.
                </p>
              </div>
            ) : supportsAuthStatus ? (
              'This agent supports account status reporting but has not reported an account yet.'
            ) : (
              'Account status is not reported by this agent over ACP; Stage0 cannot determine whether it is signed in.'
            )}
          </div>
          {authMethods.length ? (
            <div className="flex flex-wrap items-center gap-2">
              <CustomSelect
                value={selectedAuthMethod}
                onChange={setSelectedAuthMethod}
                options={authMethods.map((method) => ({
                  value: method.id,
                  label: `${method.name || method.id}${method.type === 'terminal' ? ' · Interactive terminal' : ''}`,
                  description: method.description,
                }))}
                className="min-w-40"
                buttonClassName="min-w-40"
                dropdownWidth="w-64"
                align="left"
                aria-label="ACP sign-in method"
              />
              <button
                type="button"
                disabled={
                  busyId === detailAgent.id ||
                  !isTauri() ||
                  !isProtocolAuthMethod(selectedAuthOption)
                }
                onClick={() => void signIn()}
                className="border border-brand/50 bg-brand/10 px-3 py-1.5 text-xs text-brand disabled:opacity-50"
              >
                {busyId === detailAgent.id
                  ? 'Connecting…'
                  : authStatus && authStatus.kind !== 'none'
                    ? 'Change account'
                    : 'Connect account'}
              </button>
            </div>
          ) : (
            !isCheckingAuth && (
              <p className="text-[11px] text-subtext0">
                This agent did not advertise an ACP sign-in method. If it already has a local
                session, you can still try sending a prompt.
              </p>
            )
          )}
          {selectedAuthOption?.type === 'terminal' && (
            <p className="text-[11px] text-yellow">
              This agent requires interactive terminal sign-in, which Stage0 does not support yet.
            </p>
          )}
          {selectedAuthOption?.type &&
            selectedAuthOption.type !== 'agent' &&
            selectedAuthOption.type !== 'terminal' && (
              <p className="text-[11px] text-yellow">
                This sign-in method requires a client-specific setup ({selectedAuthOption.type});
                Stage0 cannot complete it automatically.
              </p>
            )}
        </section>
        <p className="border border-surface1 px-3 py-2 text-[11px] text-subtext0">
          When a repository is open, the agent starts there. Stage0 does not yet provide ACP file
          operations or interactive terminals, so the agent needs its own tools to work with project
          files.
        </p>
        <section className="space-y-2 border-t border-surface1 pt-4">
          <h3 className="text-xs font-semibold">Send a prompt</h3>
          <p className="break-all text-[11px] text-subtext0">
            Working directory:{' '}
            {currentRepoPath || 'No repository open; using Stage0’s working directory.'}
          </p>
          <textarea
            rows={3}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="w-full resize-y border border-surface1 bg-base px-2.5 py-2 text-xs outline-none focus:border-surface2"
          />
          <button
            type="button"
            disabled={isSendingPrompt || !prompt.trim() || !isTauri()}
            onClick={() => void sendPrompt()}
            className="border border-surface2 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {isSendingPrompt ? 'Waiting for agent…' : 'Send prompt'}
          </button>
          {response && (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap border border-surface1 bg-base p-3 text-xs">
              {response}
            </pre>
          )}
        </section>
      </div>
    </Modal>
  );
}
