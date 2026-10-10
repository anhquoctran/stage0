import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Key } from '../../../common/components/icons/Key';
import { ShieldCheck } from '../../../common/components/icons/ShieldCheck';
import { Plus } from '../../../common/components/icons/Plus';
import { Trash2 } from '../../../common/components/icons/Trash2';
import { Check } from '../../../common/components/icons/Check';
import { Copy } from '../../../common/components/icons/Copy';
import { RefreshCw } from '../../../common/components/icons/RefreshCw';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Eye } from '../../../common/components/icons/Eye';
import { EyeOff } from '../../../common/components/icons/EyeOff';
import { Server } from '../../../common/components/icons/Server';
import { User } from '../../../common/components/icons/User';
import { Tag } from '../../../common/components/icons/Tag';
import { Globe } from '../../../common/components/icons/Globe';
import { Lock } from '../../../common/components/icons/Lock';
import { X } from '../../../common/components/icons/X';
import { ShieldAlert } from '../../../common/components/icons/ShieldAlert';
import { CustomSelect } from '../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useGitCredentialsStore } from '../store/useGitCredentialsStore';
import { type GitCredentialProvider } from '../types/GitCredentialProvider';
import { type GitCredentialType } from '../types/GitCredentialType';
import { type SaveGitCredentialPayload } from '../types/SaveGitCredentialPayload';

const PROVIDER_PRESETS: {
  id: GitCredentialProvider;
  name: string;
  defaultUrl: string;
  defaultType: GitCredentialType;
}[] = [
  { id: 'github', name: 'GitHub', defaultUrl: 'https://github.com', defaultType: 'pat' },
  { id: 'gitlab', name: 'GitLab', defaultUrl: 'https://gitlab.com', defaultType: 'pat' },
  { id: 'bitbucket', name: 'Bitbucket', defaultUrl: 'https://bitbucket.org', defaultType: 'pat' },
  { id: 'azure_devops', name: 'Azure DevOps', defaultUrl: 'https://dev.azure.com', defaultType: 'pat' },
  { id: 'custom', name: 'Custom Git Host', defaultUrl: 'https://', defaultType: 'pat' },
];

const CREDENTIAL_TYPE_OPTIONS: CustomSelectOption<GitCredentialType>[] = [
  { value: 'pat', label: 'Personal Access Token (PAT)' },
  { value: 'password', label: 'Password / HTTP Basic' },
  { value: 'oauth', label: 'OAuth Token' },
  { value: 'ssh_key', label: 'SSH Key Passphrase' },
];

export const GitCredentialsTab: React.FC = () => {
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
    void listen('git-credentials-updated', () => {
      void fetchCredentials();
    }).then((stopListening) => {
      if (disposed) {
        stopListening();
      } else {
        unlisten = stopListening;
        void fetchCredentials();
      }
    }).catch((error) => {
      console.warn('[GitCredentialsTab] Could not subscribe to credential refresh:', error);
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [fetchCredentials]);

  const keyringName = osInfo?.keyring_name || 'OS Credential Manager';

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
      setFormError('Account name or username is required');
      return;
    }
    if (!secret.trim()) {
      setFormError('Token or secret password is required');
      return;
    }
    if (!serverUrl.trim()) {
      setFormError('Server URL is required');
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
      <div className="flex items-center justify-between gap-4 pb-3 border-b border-surface0">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Key className="w-4 h-4 text-subtext0" />
            Git Credentials Manager
          </h3>
          <p className="text-[11px] text-subtext0 mt-0.5">
            Stage0 credentials stay in your OS keychain. You can select one for a single HTTPS clone; it is not embedded in the URL or written to the repository/global Git config. System/global helpers are mapped from known remotes.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => {
              setIsAdding(true);
              clearError();
              setFormError(null);
            }}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold rounded-none transition-colors cursor-pointer shadow-xs border border-brand"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Credential</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {(error || formError) && (
        <div className="p-3 bg-red/10 border border-red/30 flex items-center justify-between text-xs text-red">
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
            className="p-1 hover:bg-red/20 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ADD CREDENTIAL FORM */}
      {isAdding && (
        <form
          onSubmit={handleSave}
          className="p-4 bg-surface0/60 border border-surface1 space-y-4 animate-in fade-in zoom-in-98 duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-surface1/60">
            <span className="text-xs font-bold text-text flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-subtext0" />
              New Git Credential
            </span>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setFormError(null);
              }}
              className="p-1 text-subtext0 hover:text-text rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Provider Selection */}
          <div>
            <label className="block text-[11px] font-medium text-subtext0 mb-1.5">
              Git Provider
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderChange(p.id)}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                    provider === p.id
                      ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                      : 'bg-surface0/40 border-surface0/80 text-subtext0 hover:bg-surface0 hover:text-text'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Host / Server URL */}
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                Server / Host URL
              </label>
              <div className="relative flex items-center">
                <Globe className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://github.com"
                  className="w-full pl-8 pr-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />
              </div>
            </div>

            {/* Account / Username */}
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                Account / Username <span className="text-red">*</span>
              </label>
              <div className="relative flex items-center">
                <User className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. octocat, john.doe"
                  required
                  className="w-full pl-8 pr-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Token Type */}
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                Credential Type
              </label>
              <CustomSelect
                value={tokenType}
                options={CREDENTIAL_TYPE_OPTIONS}
                onChange={setTokenType}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label="Credential Type"
              />
            </div>

            {/* Label (Optional) */}
            <div>
              <label className="block text-[11px] font-medium text-subtext0 mb-1">
                Label <span className="text-subtext0/60 font-normal">(Optional)</span>
              </label>
              <div className="relative flex items-center">
                <Tag className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Work PAT, Personal GitHub"
                  className="w-full pl-8 pr-3 py-1.5 bg-base border border-surface1 text-xs text-text placeholder:text-subtext0 focus:outline-none focus:border-surface2"
                />
              </div>
            </div>
          </div>

          {/* Secret / Token Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-subtext0">
                Secret Token / Password <span className="text-red">*</span>
              </label>
              <span className="text-[10px] text-subtext0/70 font-mono">
                Secured in {keyringName}
              </span>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-3.5 h-3.5 text-subtext0 absolute left-2.5" />
              <input
                type={showSecret ? 'text' : 'password'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="ghp_..., glpat-..., or account password"
                required
                className="w-full pl-8 pr-9 py-1.5 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 p-1 text-subtext0 hover:text-text cursor-pointer"
                title={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface1/60">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setFormError(null);
              }}
              className="px-3 py-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-md shadow-brand/20 border border-brand flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-on-accent" />
                  <span>Saving to {keyringName}...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-on-accent" />
                  <span>Save to {keyringName}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* CREDENTIALS LIST */}
      <div className="space-y-3">
        {credentials.length === 0 ? (
          <div className="p-8 border border-dashed border-surface1 text-center space-y-2.5">
            <div className="w-10 h-10 bg-surface0 flex items-center justify-center mx-auto text-subtext0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-text">No Git Credentials Configured</h4>
              <p className="text-[11px] text-subtext0 max-w-sm mx-auto mt-0.5">
                Stage0 will show credentials discovered through Git helpers for known remotes, alongside credentials added here.
              </p>
            </div>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 bg-brand hover:bg-brand/90 text-on-accent text-xs font-semibold rounded-none transition-colors cursor-pointer border border-brand shadow-xs mt-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Credential</span>
              </button>
            )}
          </div>
        ) : (
          credentials.map((cred) => (
            <div
              key={cred.id}
              className="p-3.5 bg-surface0/30 border border-surface0 hover:border-surface1 transition-all space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-surface1 border border-surface2 flex items-center justify-center text-text shadow-xs">
                    <Server className="w-4 h-4 text-subtext0" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text">
                        {cred.label || cred.account_name}
                      </span>
                      <span className="text-[10px] px-2 py-0.2 bg-surface1 text-subtext0 border border-surface2 font-mono uppercase">
                        {cred.provider}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-surface0 text-subtext1 border border-surface1 font-mono uppercase">
                        {cred.token_type}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-surface0 text-subtext1 border border-surface1 font-mono uppercase">
                        {cred.source === 'system_global' ? 'System / Global' : 'Stage0'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-subtext0 mt-0.5">
                      <span>{cred.account_name}</span>
                      <span>•</span>
                      <span className="truncate max-w-[200px]">{cred.server_url}</span>
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-1.5">
                  {/* Keyring status pill */}
                  <div
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium border bg-surface1 text-subtext0 border-surface2"
                    title={
                      cred.source === 'system_global'
                        ? `Found through ${cred.helper_name || 'a system/global Git credential helper'}`
                        : cred.is_in_keyring
                          ? 'Verified in OS Credential Manager'
                          : 'Secret not found in OS Credential Manager'
                    }
                  >
                    {cred.source === 'system_global' ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-text" />
                        <span className="text-text">Git helper</span>
                      </>
                    ) : cred.is_in_keyring ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-text" />
                        <span className="text-text">In OS Keyring</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3 text-subtext0" />
                        <span>Keyring Missing</span>
                      </>
                    )}
                  </div>

                  {/* Verify button */}
                  {cred.source === 'stage0' && (
                    <button
                      type="button"
                      onClick={() => handleVerify(cred.id)}
                      disabled={verifyingId === cred.id}
                      className="p-1.5 rounded-lg border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text transition-colors cursor-pointer"
                      title="Verify Secret in OS Keyring"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${
                          verifyingId === cred.id ? 'animate-spin text-text' : ''
                        }`}
                      />
                    </button>
                  )}

                  {/* Delete button */}
                  {cred.source === 'stage0' && deletingId === cred.id ? (
                    <div className="flex items-center gap-1 bg-surface1 p-0.5 border border-red/40">
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(cred.id)}
                        className="px-2 py-0.5 bg-red/20 hover:bg-red/30 text-red text-[11px] font-medium rounded transition-colors cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-1.5 py-0.5 text-subtext0 hover:text-text text-[11px] rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : cred.source === 'stage0' ? (
                    <button
                      type="button"
                      onClick={() => setDeletingId(cred.id)}
                      className="p-1.5 rounded-lg border border-surface1 hover:bg-red/10 text-subtext0 hover:text-red transition-colors cursor-pointer"
                      title="Delete Stage0 credential and OS Keyring entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Tokenized Reference Mapping Info */}
              <div className="p-2 bg-base/50 border border-surface0 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 text-subtext0 font-mono">
                  <Lock className="w-3 h-3 text-subtext0" />
                  <span>Tokenized Ref:</span>
                  <span className="text-text font-bold select-all">{cred.token_ref}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyTokenRef(cred.token_ref, cred.id)}
                  className="flex items-center gap-1 text-[10px] text-subtext0 hover:text-text px-1.5 py-0.5 rounded hover:bg-surface1 transition-colors cursor-pointer"
                  title="Copy tokenized reference key"
                >
                  {copiedId === cred.id ? (
                    <>
                      <Check className="w-3 h-3 text-text" />
                      <span className="text-text">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Ref</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
