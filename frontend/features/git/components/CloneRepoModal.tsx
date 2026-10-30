import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React from 'react';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';
import { Download } from '../../../common/components/icons/Download';
import { Loader2 } from '../../../common/components/icons/Loader2';
import { Terminal } from '../../../common/components/icons/Terminal';
import { X } from '../../../common/components/icons/X';
import type { CustomSelectOption } from '../../../common/types/CustomSelectOption';
import { useCloneRepository } from '../hooks/useCloneRepository';
import { isSafeCloneRepoName } from '../utils/cloneDestination';
import { previewCloneCommand, validateCloneOptions } from '../utils/cloneOptions';
import { CloneCredentialsSection } from './clone/CloneCredentialsSection';
import { CloneDestinationSection } from './clone/CloneDestinationSection';
import { CloneUrlInputSection } from './clone/CloneUrlInputSection';
import { CloneOptionsForm } from './CloneOptionsForm';

export const CloneRepoModal: React.FC = () => {
  const { t: translateUiText } = useUiTextTranslation();
  const {
    isCloneModalOpen,
    credentialsLoading,
    remoteUrl,
    parentDir,
    repoName,
    setRepoName,
    setRepoNameEdited,
    destinationPath,
    setDestinationPath,
    cloneOptions,
    setCloneOptions,
    isCloning,
    errorMessage,
    setErrorMessage,
    useSavedCredential,
    setUseSavedCredential,
    selectedCredentialId,
    setSelectedCredentialId,
    urlStatus,
    urlMessage,
    remoteRefs,
    remoteOrigin,
    credentialOptions,
    selectedCredential,
    isSshRemote,
    handleUrlChange,
    handleBrowseFolder,
    handleClose,
    handleSubmit,
  } = useCloneRepository();

  if (!isCloneModalOpen) return null;

  const credentialSelectOptions: CustomSelectOption<string>[] = credentialOptions.map(
    (credential) => ({
      value: credential.id,
        label: `${credential.account_name} · ${credential.label || credential.provider}${
          credential.source === 'system_global' ? ` · ${translateUiText('git.clone.system')}` : ''
      }`,
    })
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-x-0 bottom-0 top-8.5 z-50 flex items-center justify-center bg-crust/80 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 rounded-sm"
    >
      <div className="bg-mantle border border-surface1 shadow-2xl w-full max-w-2xl max-h-full overflow-hidden flex flex-col rounded-sm">
        {/* Header */}
        <div
          data-tauri-drag-region
          className="px-5 py-4 border-b border-surface0 flex shrink-0 items-center justify-between bg-base/50 cursor-default rounded-sm"
        >
          <div data-tauri-drag-region className="flex items-center gap-2.5 pointer-events-none">
            <div className="p-2 bg-blue/10 text-blue border border-blue/20 rounded-sm">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text">{translateUiText('git.clone.title')}</h3>
              <p className="text-[11px] text-subtext0">
                {translateUiText('git.clone.description')}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isCloning}
            onClick={handleClose}
            className="p-1.5 hover:bg-surface0 text-subtext0 hover:text-text transition-colors disabled:opacity-40 cursor-pointer rounded-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="min-h-0 flex flex-col">
          <div className="min-h-0 overflow-y-auto p-5 space-y-4">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red/10 border border-red/30 flex items-start gap-2.5 text-red text-xs animate-in fade-in duration-150 rounded-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 break-words font-mono text-[11px] leading-relaxed">
                  {errorMessage}
                </div>
              </div>
            )}

            {/* Remote URL Field */}
            <CloneUrlInputSection
              urlStatus={urlStatus}
              isCloning={isCloning}
              remoteUrl={remoteUrl}
              handleUrlChange={handleUrlChange}
              urlMessage={urlMessage}
            />

            {/* Optional one-time HTTPS credential */}
            <CloneCredentialsSection
              useSavedCredential={useSavedCredential}
              isCloning={isCloning}
              isSshRemote={isSshRemote}
              setUseSavedCredential={setUseSavedCredential}
              setErrorMessage={setErrorMessage}
              selectedCredentialId={selectedCredentialId}
              credentialsLoading={credentialsLoading}
              credentialOptions={credentialOptions}
              credentialSelectOptions={credentialSelectOptions}
              setSelectedCredentialId={setSelectedCredentialId}
              remoteOrigin={remoteOrigin}
            />

            {/* Local Destination Folder */}
            <CloneDestinationSection
              isCloning={isCloning}
              destinationPath={destinationPath}
              parentDir={parentDir}
              handleBrowseFolder={handleBrowseFolder}
            />

            {/* Repository Folder Name */}
            <div>
              <label className="block text-xs font-medium text-text mb-1.5">
                {translateUiText('git.clone.targetFolderName')}
              </label>
              <input
                type="text"
                disabled={isCloning}
                value={repoName}
                onChange={(e) => {
                  if (e.target.value !== repoName) setDestinationPath('');
                  setRepoName(e.target.value);
                  setRepoNameEdited(true);
                }}
                placeholder={translateUiText('git.clone.folderNamePlaceholder')}
                className="w-full px-3 py-2 bg-surface0 border border-surface1 focus:border-blue focus:ring-1 focus:ring-blue text-xs text-text placeholder-subtext0 font-mono outline-hidden transition-all disabled:opacity-60 rounded-sm"
              />
              {repoName && !isSafeCloneRepoName(repoName) && (
                <p role="alert" className="mt-1 text-[11px] text-red">
                  {translateUiText('git.clone.folderNameValidation')}
                </p>
              )}
            </div>

            {/* Resolved Path Preview */}
            {destinationPath && (
              <div className="bg-surface0/60 border border-surface1/60 p-3 text-[11px] rounded-sm">
                <span className="text-subtext0 block mb-0.5">{translateUiText('git.clone.cloningInto')}</span>
                <code className="text-blue font-mono font-medium break-all select-all">
                  {destinationPath}
                </code>
              </div>
            )}

            {/* Command Preview Box */}
            <CloneOptionsForm
              options={cloneOptions}
              onChange={setCloneOptions}
              disabled={isCloning}
              remoteRefs={remoteRefs}
              refsLoading={urlStatus === 'validating'}
            />
            <div className="bg-surface0/40 border border-surface1/40 p-2.5 flex items-center gap-2 text-[11px] text-subtext0 font-mono overflow-x-auto rounded-sm">
              <Terminal className="w-3.5 h-3.5 text-peach shrink-0" />
              <span className="whitespace-pre-wrap break-all select-text">
                {previewCloneCommand(remoteUrl, destinationPath, cloneOptions)}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-3 shrink-0 border-t border-surface0 flex items-center justify-between rounded-sm">
            <div className="text-[11px] text-subtext0">
              {isCloning && (
                <span className="flex items-center gap-1.5 text-blue">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {translateUiText('git.clone.cloningPleaseWait')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={isCloning}
                onClick={handleClose}
                className="px-3.5 py-1.5 bg-surface1 hover:bg-surface2 text-subtext1 hover:text-text text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 rounded-sm"
              >
                {translateUiText('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={
                  isCloning ||
                  urlStatus === 'validating' ||
                  urlStatus === 'invalid' ||
                  (useSavedCredential && (!remoteOrigin || !selectedCredential)) ||
                  !remoteUrl.trim() ||
                  !!validateCloneOptions(cloneOptions) ||
                  !destinationPath.trim()
                }
                className="flex items-center gap-2 px-4 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs shadow-md shadow-brand/20 border border-brand transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:pointer-events-none rounded-sm"
              >
                {isCloning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{translateUiText('git.clone.cloning')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{translateUiText('git.clone.title')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
