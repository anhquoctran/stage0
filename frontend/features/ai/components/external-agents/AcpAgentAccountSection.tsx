import { isTauri } from '../../../../common/services/ipc/ipcClient';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import type { AcpAgentDetailsProps } from './AcpAgentDetailsProps';

export function AcpAgentAccountSection({
  account: {
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
  },
  agentId,
}: Pick<AcpAgentDetailsProps, 'account'> & { agentId: string }) {
  return (
    <section className="space-y-2 border-t border-surface1 pt-4">
      <h3 className="text-xs font-semibold">Account & sign-in</h3>
      <p className="text-[11px] text-subtext0">
        Stage0 checks the agent automatically when this window opens. Account details come only from
        the agent; Stage0 never reads or stores its credentials.
      </p>
      <div
        role="status"
        aria-live="polite"
        className={`border px-3 py-2 text-xs rounded-sm ${authStatus?.kind === 'none' ? 'border-yellow/40 bg-yellow/5 text-yellow' : authStatus ? 'border-green/40 bg-green/5 text-green' : lastSuccessfulSignIn ? 'border-brand/40 bg-brand/5 text-text' : 'border-surface1 bg-base/40 text-subtext0'}`}
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
                {new Date(lastSuccessfulSignIn.completedAt).toLocaleString()}, but this agent now
                reports that it is signed out.
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
              This is a saved result from this device, not a live account check. The agent does not
              report account identity or current sign-in status over ACP.
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
            disabled={busyId === agentId || !isTauri() || !isProtocolAuthMethod(selectedAuthOption)}
            onClick={() => void signIn()}
            className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busyId === agentId
              ? 'Connecting…'
              : authStatus && authStatus.kind !== 'none'
                ? 'Change account'
                : 'Connect account'}
          </button>
        </div>
      ) : (
        !isCheckingAuth && (
          <p className="text-[11px] text-subtext0">
            This agent did not advertise an ACP sign-in method. If it already has a local session,
            you can still try sending a prompt.
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
            This sign-in method requires a client-specific setup ({selectedAuthOption.type}); Stage0
            cannot complete it automatically.
          </p>
        )}
    </section>
  );
}
