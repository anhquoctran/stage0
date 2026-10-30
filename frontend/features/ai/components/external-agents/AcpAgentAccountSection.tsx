import { useApplicationServices } from '../../../../core/services/runtime/useApplicationServices';
import { useTranslation } from 'react-i18next';

import { CustomSelect } from '../../../../common/components/CustomSelect';
import { formatDateTime } from '../../../../common/utils/dateTime';
import type { AcpAgentDetailsProps } from './AcpAgentDetailsProps';

export function AcpAgentAccountSection({
  account: {
    authStatus,
    lastSuccessfulSignIn,
    isCheckingAuth,
    supportsAuthStatus,
    supportsAuthLogout,
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
  const appServices = useApplicationServices();
  const { t } = useTranslation();
  return (
    <section className="space-y-2 border-t border-surface1 pt-4">
      <h3 className="text-xs font-semibold">{t('ai.acpAccount.title')}</h3>
      <p className="text-[11px] text-subtext0">
        {t('ai.acpAccount.description')}
      </p>
      <div
        role="status"
        aria-live="polite"
        className={`border px-3 py-2 text-xs rounded-sm ${authStatus?.kind === 'none' ? 'border-yellow/40 bg-yellow/5 text-yellow' : authStatus ? 'border-green/40 bg-green/5 text-green' : lastSuccessfulSignIn ? 'border-brand/40 bg-brand/5 text-text' : 'border-surface1 bg-base/40 text-subtext0'}`}
      >
        {isCheckingAuth ? (
          t('ai.acpAccount.checking')
        ) : authStatus ? (
          <div className="space-y-0.5">
            <p className="font-medium">
              {authStatus.kind === 'none' ? t('ai.acpAccount.notSignedIn') : authStatus.label}
            </p>
            {authStatus.account?.email && <p>{authStatus.account.email}</p>}
            {authStatus.account?.organization && (
              <p>{t('ai.acpAccount.organization')}: {authStatus.account.organization}</p>
            )}
            {authStatus.account?.plan && <p>{t('ai.acpAccount.plan')}: {authStatus.account.plan}</p>}
            {authStatus.detail && <p>{authStatus.detail}</p>}
            {authStatus.kind === 'none' && lastSuccessfulSignIn && (
              <p>
                {t('ai.acpAccount.previousSignOut', {
                  method: lastSuccessfulSignIn.methodLabel,
                  date: formatDateTime(lastSuccessfulSignIn.completedAt),
                })}
              </p>
            )}
          </div>
        ) : lastSuccessfulSignIn ? (
          <div className="space-y-0.5">
            <p className="font-medium">{t('ai.acpAccount.lastSignIn')}</p>
            <p>
              {lastSuccessfulSignIn.methodLabel} ·{' '}
              {formatDateTime(lastSuccessfulSignIn.completedAt)}
            </p>
            <p>
              {t('ai.acpAccount.savedResult')}
            </p>
          </div>
        ) : supportsAuthStatus ? (
          t('ai.acpAccount.noAccountReported')
        ) : (
          t('ai.acpAccount.statusUnavailable')
        )}
      </div>
      {authMethods.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <CustomSelect
            value={selectedAuthMethod}
            onChange={setSelectedAuthMethod}
            options={authMethods.map((method) => ({
              value: method.id,
              label: `${method.name || method.id}${method.type === 'terminal' ? ` · ${t('ai.acpAccount.interactiveTerminal')}` : ''}`,
              description: method.description,
            }))}
            className="min-w-40"
            buttonClassName="min-w-40"
            dropdownWidth="w-64"
            align="left"
            aria-label={t('ai.acpAccount.signInMethod')}
          />
          <button
            type="button"
            disabled={busyId === agentId || !appServices.platform.capabilities.externalAgents || !isProtocolAuthMethod(selectedAuthOption) || Boolean(authStatus && authStatus.kind !== 'none' && !supportsAuthLogout)}
            onClick={() => void signIn()}
            className="px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busyId === agentId
              ? t('ai.acpAccount.connecting')
              : authStatus && authStatus.kind !== 'none' && supportsAuthLogout
                ? t('ai.acpAccount.changeAccount')
                : authStatus && authStatus.kind !== 'none'
                  ? t('ai.acpAccount.changeUnavailable')
                  : supportsAuthLogout
                    ? t('ai.acpAccount.signInOrChange')
                    : t('ai.acpAccount.connectAccount')}
          </button>
        </div>
      ) : (
        !isCheckingAuth && (
          <p className="text-[11px] text-subtext0">
            {t('ai.acpAccount.noMethod')}
          </p>
        )
      )}
      {authStatus && authStatus.kind !== 'none' && !supportsAuthLogout && (
        <p className="text-[11px] text-subtext0">
          {t('ai.acpAccount.logoutUnsupported')}
        </p>
      )}
      {supportsAuthLogout && (
        <p className="text-[11px] text-subtext0">
          {t('ai.acpAccount.changeAccountNotice')}
        </p>
      )}
      {selectedAuthOption?.type === 'terminal' && (
        <p className="text-[11px] text-yellow">
          {t('ai.acpAccount.terminalUnsupported')}
        </p>
      )}
      {selectedAuthOption?.type &&
        selectedAuthOption.type !== 'agent' &&
        selectedAuthOption.type !== 'terminal' && (
          <p className="text-[11px] text-yellow">
            {t('ai.acpAccount.clientSpecificSetup', { type: selectedAuthOption.type })}
          </p>
        )}
    </section>
  );
}
