import { useState } from 'react';
import type { GitBinaryInfo } from '../types/GitBinaryInfo';
import type { CustomGitBinaryContext } from './CustomGitBinaryContext';

export function useCustomGitBinary({
  pickGitExecutable,
  validateCustomBinary,
  onSelectBinary,
}: CustomGitBinaryContext) {
  const [customPath, setCustomPath] = useState('');

  const [customError, setCustomError] = useState<string | null>(null);

  const [isValidatingCustom, setIsValidatingCustom] = useState(false);

  const [showAddCustom, setShowAddCustom] = useState(false);

  const [customBinaries, setCustomBinaries] = useState<GitBinaryInfo[]>([]);

  const handleBrowseCustom = async () => {
    setCustomError(null);
    const picked = await pickGitExecutable();
    if (picked) {
      setCustomPath(picked);
    }
  };

  const handleValidateAndAddCustom = async () => {
    if (!customPath.trim()) {
      setCustomError('Please specify the path to a Git executable');
      return;
    }
    setIsValidatingCustom(true);
    setCustomError(null);
    try {
      const validated = await validateCustomBinary(customPath.trim());
      setCustomBinaries((prev) => [validated, ...prev]);
      onSelectBinary(validated.id, validated.path);
      setCustomPath('');
      setShowAddCustom(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCustomError(msg);
    } finally {
      setIsValidatingCustom(false);
    }
  };

  return {
    customBinaries,
    showAddCustom,
    setShowAddCustom,
    setCustomError,
    customPath,
    setCustomPath,
    handleBrowseCustom,
    handleValidateAndAddCustom,
    isValidatingCustom,
    customError,
  };
}
