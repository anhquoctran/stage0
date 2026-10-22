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
  return (
    <div className="border border-surface1 bg-surface0/40 p-3 space-y-2.5">
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
        <span>Use a saved HTTPS credential (optional)</span>
      </label>
      {isSshRemote && (
        <p className="pl-5 text-[10px] text-subtext0">
          SSH cloning uses your existing Git/SSH setup. Stage0 credential selection is HTTPS-only.
        </p>
      )}
      {useSavedCredential && (
        <div className="pl-5 space-y-1.5">
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
              credentialsLoading ? 'Loading saved credentials...' : 'Select a credential'
            }
            aria-label="Saved Git credential"
          />
          <p className="text-[10px] text-subtext0">
            {remoteOrigin
              ? credentialOptions.length > 0
                ? 'Only credentials for this HTTPS host are listed. The secret is used for this clone only.'
                : 'No saved credential matches this HTTPS host. Add one in Preferences or scan a known remote.'
              : isSshRemote
                ? 'SSH cloning uses your existing Git/SSH setup. Stage0 credential selection is HTTPS-only.'
                : 'Saved credentials are available for HTTPS repositories only.'}
          </p>
        </div>
      )}
    </div>
  );
}
