import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import type { RemoteCloneRefs } from '../types/RemoteCloneRefs';
import type { UrlValidationStatus } from '../types/UrlValidationStatus';
import type { CloneRemoteRefsContext } from './CloneRemoteRefsContext';

export function useCloneRemoteRefs({
  setCloneOptions,
  remoteUrl,
  isCloneModalOpen,
  useSavedCredential,
  hasSelectedCredential,
  selectedCredentialId,
}: CloneRemoteRefsContext) {
  const [urlStatus, setUrlStatus] = useState<UrlValidationStatus>('idle');

  const [urlMessage, setUrlMessage] = useState<string | null>(null);

  const [remoteRefs, setRemoteRefs] = useState<RemoteCloneRefs | null>(null);

  useEffect(() => {
    let disposed = false;
    setRemoteRefs(null);
    setCloneOptions((current) => (current.branch ? { ...current, branch: '' } : current));
    const trimmed = remoteUrl.trim();
    if (!isCloneModalOpen || !trimmed) {
      setUrlStatus('idle');
      setUrlMessage(null);
      return;
    }

    if (useSavedCredential && !hasSelectedCredential) {
      setUrlStatus('idle');
      setUrlMessage('Select an HTTPS credential to check access and load branches and tags.');
      return;
    }

    const isBasicFormat =
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('git@') ||
      trimmed.startsWith('ssh://');

    if (!isBasicFormat) {
      setUrlStatus('invalid');
      setUrlMessage('Invalid URL format (must start with https://, git@ or ssh://)');
      return;
    }

    setUrlStatus('validating');
    setUrlMessage('Checking repository and loading branches and tags...');

    const timer = setTimeout(async () => {
      try {
        const refs = await invoke<RemoteCloneRefs>('get_clone_remote_refs', {
          url: trimmed,
          credentialId: useSavedCredential ? selectedCredentialId : null,
        });
        if (disposed) return;
        setRemoteRefs(refs);
        setUrlStatus('valid');
        setUrlMessage('Repository is valid and ready to clone.');
      } catch (err: unknown) {
        if (disposed) return;
        setUrlStatus('invalid');
        setUrlMessage(
          typeof err === 'string' ? err : 'Repository does not exist or is inaccessible.'
        );
      }
    }, 1000);

    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [
    isCloneModalOpen,
    remoteUrl,
    hasSelectedCredential,
    useSavedCredential,
    selectedCredentialId,
  ]);

  return { setRemoteRefs, setUrlStatus, setUrlMessage, urlStatus, urlMessage, remoteRefs };
}
