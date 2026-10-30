import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Key } from '../../../common/components/icons/Key';
import { Plus } from '../../../common/components/icons/Plus';
import { X } from '../../../common/components/icons/X';
import { useGitCredentialsStore } from '../store/useGitCredentialsStore';
import { type GitCredentialProvider } from '../types/GitCredentialProvider';
import { type GitCredentialType } from '../types/GitCredentialType';
import { type SaveGitCredentialPayload } from '../types/SaveGitCredentialPayload';
import { AddGitCredentialModal } from './AddGitCredentialModal';
import { GitCredentialCard } from './GitCredentialCard';
import { GitCredentialsVaultBanner } from './GitCredentialsVaultBanner';

const PROVIDER_PRESETS: {
  id: GitCredentialProvider;
  name: string;
  defaultUrl: string;
  defaultType: GitCredentialType;
}[] = [
  { id: 'github', name: 'GitHub', defaultUrl: 'https://github.com', defaultType: 'pat' },
  { id: 'gitlab', name: 'GitLab', defaultUrl: 'https://gitlab.com', defaultType: 'pat' },
  { id: 'bitbucket', name: 'Bitbucket', defaultUrl: 'https://bitbucket.org', defaultType: 'pat' },
  {
    id: 'azure_devops',
    name: 'Azure DevOps',
    defaultUrl: 'https://dev.azure.com',
    defaultType: 'pat',
  },
  { id: 'custom', name: '', defaultUrl: 'https://', defaultType: 'pat' },
];

export const GitCredentialsTab: React.FC = () => {
  const { t } = useTranslation();
  const appServices = useApplicationServices();
  const {
    credentials,
    osInfo,
    isLoading,
    error,
    fetchCredentials,
    fetchOsInfo,
    saveCredential,
    deleteCredential,
    verifyCredential,
    clearError,
  } = useGitCredentialsStore();

  const [isAdding, setIsAdding] = useState(false);
  const [provider, setProvider] = useState<GitCredentialProvider>('github');
  const [serverUrl, setServerUrl] = useState('https://github.com');
  const [accountName, setAccountName] = useState('');
  const [tokenType, setTokenType] = useState<GitCredentialType>('pat');
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
    fetchOsInfo();
  }, [fetchCredentials, fetchOsInfo]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void appServices.platform.events.subscribe('git-credentials-updated', () => {
      void fetchCredentials();
    })
      .then((stopListening) => {
        if (disposed) {
          stopListening();
        } else {
          unlisten = stopListening;
          void fetchCredentials();
        }
      })
      .catch((error) => {
        console.warn('[GitCredentialsTab] Could not subscribe to credential refresh:', error);
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [fetchCredentials]);

  const keyringName = osInfo?.keyring_name || t('credentials.osCredentialManager');
  const credentialTypeOptions = [
    { value: 'pat' as const, label: t('credentials.types.personalAccessToken') },
    { value: 'password' as const, label: t('credentials.types.passwordHttpBasic') },
    { value: 'oauth' as const, label: t('credentials.types.oauthToken') },
    { value: 'ssh_key' as const, label: t('credentials.types.sshKeyPassphrase') },
  ];

  const handleProviderChange = (newProvider: GitCredentialProvider) => {
    setProvider(newProvider);
    const preset = PROVIDER_PRESETS.find((p) => p.id === newProvider);
    if (preset) {
      setServerUrl(preset.defaultUrl);
      setTokenType(preset.defaultType);
    }
  };

  const handleCopyTokenRef = (tokenRef: string, id: string) => {
    navigator.clipboard.writeText(tokenRef);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    await verifyCredential(id);
    setTimeout(() => setVerifyingId(null), 600);
  };

  const handleConfirmDelete = async (id: string) => {
    await deleteCredential(id);
    setDeletingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!accountName.trim()) {
      setFormError(t('credentials.validation.accountRequired'));
      return;
    }
    if (!secret.trim()) {
      setFormError(t('credentials.validation.secretRequired'));
      return;
    }
    if (!serverUrl.trim()) {
      setFormError(t('credentials.validation.serverRequired'));
      return;
    }

    const payload: SaveGitCredentialPayload = {
      provider,
      server_url: serverUrl.trim(),
      account_name: accountName.trim(),
      token_type: tokenType,
      secret: secret.trim(),
      label: label.trim() || undefined,
    };

    const success = await saveCredential(payload);
    if (success) {
      setIsAdding(false);
      setAccountName('');
      setSecret('');
      setLabel('');
      setShowSecret(false);
      setFormError(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Tab Header & Action */}
      <GitCredentialsVaultBanner
        isAdding={isAdding}
        setIsAdding={setIsAdding}
        clearError={clearError}
        setFormError={setFormError}
      />

      {/* Error Banner */}
      {(error || formError) && (
        <div className="p-3 bg-red/10 border border-red/30 flex items-center justify-between text-xs text-red rounded-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError || error}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              clearError();
              setFormError(null);
            }}
            className="p-1 hover:bg-red/20 rounded-sm cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ADD CREDENTIAL FORM */}
      {isAdding && (
        <AddGitCredentialModal
          handleSave={handleSave}
          setIsAdding={setIsAdding}
          setFormError={setFormError}
          PROVIDER_PRESETS={PROVIDER_PRESETS}
          handleProviderChange={handleProviderChange}
          provider={provider}
          serverUrl={serverUrl}
          setServerUrl={setServerUrl}
          accountName={accountName}
          setAccountName={setAccountName}
          tokenType={tokenType}
          CREDENTIAL_TYPE_OPTIONS={credentialTypeOptions}
          setTokenType={setTokenType}
          label={label}
          setLabel={setLabel}
          keyringName={keyringName}
          showSecret={showSecret}
          secret={secret}
          setSecret={setSecret}
          setShowSecret={setShowSecret}
          isLoading={isLoading}
        />
      )}

      {/* CREDENTIALS LIST */}
      <div className="space-y-3">
        {credentials.length === 0 ? (
          <div className="p-8 border border-dashed border-surface1 text-center space-y-2.5 rounded-sm">
            <div className="w-10 h-10 bg-surface0 flex items-center justify-center mx-auto text-subtext0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text">{t('credentials.noConfigured')}</h4>
              <p className="text-[11px] text-subtext0 max-w-sm mx-auto mt-0.5">
                {t('credentials.discoveredDescription')}
              </p>
            </div>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold rounded-sm transition-colors cursor-pointer border border-brand shadow-xs mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('credentials.addFirstCredential')}</span>
              </button>
            )}
          </div>
        ) : (
          credentials.map((cred) => (
            <GitCredentialCard
              key={cred.id}
              cred={cred}
              handleVerify={handleVerify}
              verifyingId={verifyingId}
              deletingId={deletingId}
              handleConfirmDelete={handleConfirmDelete}
              setDeletingId={setDeletingId}
              handleCopyTokenRef={handleCopyTokenRef}
              copiedId={copiedId}
            />
          ))
        )}
      </div>
    </div>
  );
};
