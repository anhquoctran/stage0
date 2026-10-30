import { CustomSelect } from '../../../../common/components/CustomSelect';
import type { CloneCredentialsSectionProps } from './CloneCredentialsSectionProps';

export function CloneCredentialsSection({
  useSavedCredential,
  isCloning,
  isSshRemote,
  setUseSavedCredential,
  setErrorMessage,
  selectedCredentialId,
  credentialsLoading,
  credentialOptions,
  credentialSelectOptions,
  setSelectedCredentialId,
  remoteOrigin,
}: CloneCredentialsSectionProps) {
  const { t } = useTranslation();
  return (
    <div className="border border-surface1 bg-surface0/40 p-3 space-y-2.5 rounded-sm">
      <label className="flex items-center gap-2 text-xs font-medium text-text cursor-pointer">
        <input
          type="checkbox"
          checked={useSavedCredential}
          disabled={isCloning || isSshRemote}
          onChange={(event) => {
            setUseSavedCredential(event.target.checked);
            setErrorMessage(null);
          }}
          className="accent-brand"
        />
        <span>{t('git.clone.useSavedCredential')} ({t('common.optional')})</span>
      </label>
      {isSshRemote && (
        <p className="ps-5 text-[10px] text-subtext0">
          {t('git.clone.sshCredentialNote')}
        </p>
      )}
      {useSavedCredential && (
        <div className="ps-5 space-y-1.5">
          <CustomSelect
            value={selectedCredentialId}
            disabled={isCloning || credentialsLoading || credentialOptions.length === 0}
            options={credentialSelectOptions}
            onChange={(credentialId) => {
              setSelectedCredentialId(credentialId);
              setErrorMessage(null);
            }}
            className="w-full"
            buttonClassName="w-full py-2"
            dropdownWidth="w-full"
            align="left"
            placeholder={
              credentialsLoading ? t('git.clone.loadingCredentials') : t('git.clone.selectCredential')
            }
            aria-label={t('git.clone.savedCredential')}
          />
          <p className="text-[10px] text-subtext0">
            {remoteOrigin
              ? credentialOptions.length > 0
                ? t('git.clone.credentialsMatchHost')
                : t('git.clone.noCredentialForHost')
              : isSshRemote
                ? t('git.clone.sshCredentialNote')
                : t('git.clone.httpsCredentialsOnly')}
          </p>
        </div>
      )}
    </div>
  );
}
import { useTranslation } from 'react-i18next';
