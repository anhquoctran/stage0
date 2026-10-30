import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const appServices = useApplicationServices();
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
      setUrlMessage(t('git.clone.selectCredentialToCheck'));
      return;
    }

    const isBasicFormat =
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://') ||
      trimmed.startsWith('git@') ||
      trimmed.startsWith('ssh://');

    if (!isBasicFormat) {
      setUrlStatus('invalid');
      setUrlMessage(t('git.clone.invalidUrlFormat'));
      return;
    }

    setUrlStatus('validating');
    setUrlMessage(t('git.clone.checkingRepository'));

    const timer = setTimeout(async () => {
      try {
        const refs = await appServices.gitRepositories.getCloneRemoteRefs({
          url: trimmed,
          credentialId: useSavedCredential ? selectedCredentialId : null,
        });
        if (disposed) return;
        setRemoteRefs(refs);
        setUrlStatus('valid');
        setUrlMessage(t('git.clone.repositoryReady'));
      } catch (err: unknown) {
        if (disposed) return;
        setUrlStatus('invalid');
        setUrlMessage(
          typeof err === 'string' ? err : t('git.clone.repositoryUnavailable')
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
