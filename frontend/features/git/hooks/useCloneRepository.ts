import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { homeDir } from '@tauri-apps/api/path';
import React, { useEffect, useMemo, useState } from 'react';
import { useGitCredentialsStore } from '../../credentials/store/useGitCredentialsStore';
import { resolveCloneDestination } from '../services/resolveCloneDestination';
import { useGitStore } from '../store/useGitStore';
import { useGitTaskStore } from '../store/useGitTaskStore';
import type { RemoteCloneRefs } from '../types/RemoteCloneRefs';
import type { UrlValidationStatus } from '../types/UrlValidationStatus';
import { extractCloneRepoName } from '../utils/cloneDestination';
import { createCloneOptions, validateCloneOptions } from '../utils/cloneOptions';

export function useCloneRepository() {
  const { isCloneModalOpen, setIsCloneModalOpen, cloneRepo, pickCloneFolder } = useGitStore();
  const credentials = useGitCredentialsStore((state) => state.credentials);
  const credentialsLoading = useGitCredentialsStore((state) => state.isLoading);
  const fetchCredentials = useGitCredentialsStore((state) => state.fetchCredentials);

  const [remoteUrl, setRemoteUrl] = useState('');
  const [parentDir, setParentDir] = useState('');
  const [repoName, setRepoName] = useState('');
  const [repoNameEdited, setRepoNameEdited] = useState(false);
  const [destinationPath, setDestinationPath] = useState('');
  const [cloneOptions, setCloneOptions] = useState(createCloneOptions);
  const isCloning = useGitTaskStore((state) =>
    state.tasks.some((task) => task.operation === 'clone' && task.status === 'running')
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useSavedCredential, setUseSavedCredential] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState('');

  // URL Validation State
  const [urlStatus, setUrlStatus] = useState<UrlValidationStatus>('idle');
  const [urlMessage, setUrlMessage] = useState<string | null>(null);
  const [remoteRefs, setRemoteRefs] = useState<RemoteCloneRefs | null>(null);

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

  useEffect(() => {
    if (!isCloneModalOpen) return;
    let disposed = false;
    void homeDir()
      .then((directory) => {
        // A late home lookup must not replace a folder the user has chosen.
        if (!disposed) setParentDir((current) => current || directory);
      })
      .catch(() => {
        if (!disposed)
          setErrorMessage(
            'Could not resolve your home directory. Please choose a destination with Browse.'
          );
      });
    return () => {
      disposed = true;
    };
  }, [isCloneModalOpen]);

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
  useEffect(() => {
    let disposed = false;
    setDestinationPath('');
    void resolveCloneDestination(parentDir, repoName)
      .then((destination) => {
        if (!disposed) setDestinationPath(destination);
      })
      .catch(() => {
        if (!disposed)
          setErrorMessage(
            'Could not resolve the destination path. Please choose a folder with Browse.'
          );
      });
    return () => {
      disposed = true;
    };
  }, [parentDir, repoName]);

  const handleBrowseFolder = async () => {
    const folder = await pickCloneFolder();
    if (folder) {
      setParentDir(folder);
      if (folder !== parentDir) setDestinationPath('');
      setErrorMessage(null);
    }
  };

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
