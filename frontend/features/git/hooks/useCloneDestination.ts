import { homeDir } from '../../../common/services/ipc/ipcPath';
import { useEffect, useState } from 'react';
import { resolveCloneDestination } from '../services/resolveCloneDestination';
import type { CloneDestinationContext } from './CloneDestinationContext';

export function useCloneDestination({
  isCloneModalOpen,
  setErrorMessage,
  pickCloneFolder,
}: CloneDestinationContext) {
  const [parentDir, setParentDir] = useState('');

  const [repoName, setRepoName] = useState('');

  const [repoNameEdited, setRepoNameEdited] = useState(false);

  const [destinationPath, setDestinationPath] = useState('');

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

  return {
    repoNameEdited,
    repoName,
    setDestinationPath,
    setRepoName,
    destinationPath,
    setRepoNameEdited,
    setParentDir,
    parentDir,
    handleBrowseFolder,
  };
}
