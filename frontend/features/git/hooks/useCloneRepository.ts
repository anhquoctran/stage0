import { listen } from '@tauri-apps/api/event';
import React, { useEffect, useMemo, useState } from 'react';
import { useGitCredentialsStore } from '../../credentials/store/useGitCredentialsStore';
import { useGitStore } from '../store/useGitStore';
import { useGitTaskStore } from '../store/useGitTaskStore';
import { extractCloneRepoName } from '../utils/cloneDestination';
import { createCloneOptions, validateCloneOptions } from '../utils/cloneOptions';
import { useCloneDestination } from './useCloneDestination';
import { useCloneRemoteRefs } from './useCloneRemoteRefs';

export function useCloneRepository() {
  const { isCloneModalOpen, setIsCloneModalOpen, cloneRepo, pickCloneFolder } = useGitStore();
  const credentials = useGitCredentialsStore((state) => state.credentials);
  const credentialsLoading = useGitCredentialsStore((state) => state.isLoading);
  const fetchCredentials = useGitCredentialsStore((state) => state.fetchCredentials);

  const [remoteUrl, setRemoteUrl] = useState('');

  const [cloneOptions, setCloneOptions] = useState(createCloneOptions);
  const isCloning = useGitTaskStore((state) =>
    state.tasks.some((task) => task.operation === 'clone' && task.status === 'running')
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useSavedCredential, setUseSavedCredential] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState('');

  // URL Validation State

  const remoteOrigin = useMemo(() => {
    try {
      const parsed = new URL(remoteUrl.trim());
      return parsed.protocol === 'https:' && !parsed.username && !parsed.password
        ? parsed.origin
        : null;
    } catch {
      return null;
    }
  }, [remoteUrl]);

  const credentialOptions = useMemo(() => {
    return credentials.filter((credential) => {
      if (
        !credential.is_in_keyring ||
        credential.token_type === 'ssh_key' ||
        !['stage0', 'system_global'].includes(credential.source)
      ) {
        return false;
      }
      try {
        const credentialUrl = new URL(credential.server_url);
        return (
          credentialUrl.protocol === 'https:' &&
          (!remoteOrigin || credentialUrl.origin === remoteOrigin)
        );
      } catch {
        return false;
      }
    });
  }, [credentials, remoteOrigin]);

  const selectedCredential = credentialOptions.find(
    (credential) => credential.id === selectedCredentialId
  );
  const hasSelectedCredential = useSavedCredential && !!selectedCredential && !!remoteOrigin;
  const isSshRemote = /^git@|^ssh:\/\//i.test(remoteUrl.trim());

  useEffect(() => {
    if (!isCloneModalOpen) return;
    void fetchCredentials();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen('git-credentials-updated', () => {
      void fetchCredentials();
    })
      .then((stopListening) => {
        if (disposed) stopListening();
        else unlisten = stopListening;
      })
      .catch((error) => {
        console.warn('[CloneRepoModal] Could not subscribe to credential refresh:', error);
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [isCloneModalOpen, fetchCredentials]);

  useEffect(() => {
    if (!isCloneModalOpen) {
      setUseSavedCredential(false);
      setSelectedCredentialId('');
    }
  }, [isCloneModalOpen]);

  const {
    repoNameEdited,
    repoName,
    setDestinationPath,
    setRepoName,
    destinationPath,
    setRepoNameEdited,
    setParentDir,
    parentDir,
    handleBrowseFolder,
  } = useCloneDestination({ isCloneModalOpen, setErrorMessage, pickCloneFolder });

  useEffect(() => {
    if (isSshRemote) {
      setUseSavedCredential(false);
      setSelectedCredentialId('');
    }
  }, [isSshRemote]);

  useEffect(() => {
    if (!remoteOrigin || !selectedCredentialId) return;
    const credential = credentials.find((item) => item.id === selectedCredentialId);
    if (!credential) {
      if (!credentialsLoading) setSelectedCredentialId('');
      return;
    }
    try {
      if (new URL(credential.server_url).origin !== remoteOrigin) {
        setSelectedCredentialId('');
      }
    } catch {
      setSelectedCredentialId('');
    }
  }, [credentials, credentialsLoading, remoteOrigin, selectedCredentialId]);

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRemoteUrl(val);
    setRemoteRefs(null);
    setCloneOptions((current) => ({ ...current, branch: '' }));
    setErrorMessage(null);
    if (!repoNameEdited) {
      const inferred = extractCloneRepoName(val);
      if (inferred !== repoName) setDestinationPath('');
      setRepoName(inferred);
    }
  };

  // Debounce 1s then validate URL format and remote availability
  const { setRemoteRefs, setUrlStatus, setUrlMessage, urlStatus, urlMessage, remoteRefs } =
    useCloneRemoteRefs({
      setCloneOptions,
      remoteUrl,
      isCloneModalOpen,
      useSavedCredential,
      hasSelectedCredential,
      selectedCredentialId,
    });

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCloneModalOpen && !isCloning) {
        setIsCloneModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCloneModalOpen, isCloning, setIsCloneModalOpen]);

  // Native path APIs handle Windows drive roots / UNC and Unix roots correctly.

  const handleClose = () => {
    if (isCloning) return;
    setIsCloneModalOpen(false);
    setErrorMessage(null);
    setUrlStatus('idle');
    setUrlMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remoteUrl.trim()) {
      setErrorMessage('Please enter a valid repository URL.');
      return;
    }
    if (useSavedCredential && !remoteOrigin) {
      setErrorMessage('Saved Git credentials can only be used with HTTPS repository URLs.');
      return;
    }
    if (useSavedCredential && !selectedCredential) {
      setErrorMessage(
        'Select a saved Git credential, or turn off the credential option to clone without one.'
      );
      return;
    }
    if (urlStatus === 'invalid') {
      setErrorMessage(urlMessage || 'Repository URL is invalid or inaccessible.');
      return;
    }
    if (!destinationPath.trim()) {
      setErrorMessage('Please select a destination folder.');
      return;
    }

    const optionsError = validateCloneOptions(cloneOptions);
    if (optionsError) {
      setErrorMessage(optionsError);
      return;
    }

    setErrorMessage(null);
    // The store owns execution and reports errors to the task dialog even after
    // this form closes or the user puts the operation in the background.
    void cloneRepo(
      remoteUrl.trim(),
      destinationPath.trim(),
      useSavedCredential ? selectedCredential?.id : undefined,
      cloneOptions
    ).catch(() => {});
    setIsCloneModalOpen(false);
    setRemoteUrl('');
    setRepoName('');
    setRepoNameEdited(false);
    setParentDir('');
    setDestinationPath('');
    setUrlStatus('idle');
    setUrlMessage(null);
    setRemoteRefs(null);
    setUseSavedCredential(false);
    setSelectedCredentialId('');
    setCloneOptions(createCloneOptions());
  };

  return {
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
  };
}
