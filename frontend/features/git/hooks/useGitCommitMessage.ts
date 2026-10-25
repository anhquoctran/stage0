import { useApplicationServices } from '../../../core/services/runtime/useApplicationServices';

import { useEffect, useRef, useState } from 'react';
import type { GitCommitMessageContext } from './GitCommitMessageContext';

export function useGitCommitMessage({ isOpen, repoPath, selectedCommit }: GitCommitMessageContext) {
  const appServices = useApplicationServices();
  const [selectedCommitMessage, setSelectedCommitMessage] = useState<string | null>(null);

  const [isLoadingCommitMessage, setIsLoadingCommitMessage] = useState(false);

  const [commitMessageError, setCommitMessageError] = useState<string | null>(null);

  const commitMessageRequest = useRef(0);

  useEffect(() => {
    const requestId = ++commitMessageRequest.current;
    if (!isOpen || !repoPath || !selectedCommit) {
      setSelectedCommitMessage(null);
      setCommitMessageError(null);
      setIsLoadingCommitMessage(false);
      return;
    }

    setSelectedCommitMessage(null);
    setCommitMessageError(null);
    setIsLoadingCommitMessage(true);
    appServices.gitHistory.getGitCommitMessage({
      repoPath,
      commitHash: selectedCommit.hash,
    })
      .then((message) => {
        if (commitMessageRequest.current === requestId) setSelectedCommitMessage(message);
      })
      .catch((reason: unknown) => {
        if (commitMessageRequest.current === requestId) {
          setCommitMessageError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => {
        if (commitMessageRequest.current === requestId) setIsLoadingCommitMessage(false);
      });

    return () => {
      if (commitMessageRequest.current === requestId) commitMessageRequest.current += 1;
    };
  }, [isOpen, repoPath, selectedCommit]);

  return { selectedCommitMessage, isLoadingCommitMessage, commitMessageError };
}
