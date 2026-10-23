import { useEffect,useRef,useState } from 'react';
import type { NewMrMetadataContext } from './NewMrMetadataContext';

export function useNewMrMetadata({
  reloadPersistedReviewers,
  currentRepo,
  refreshRepoMetadata,
  draftMr,
  updateDraftMr,
  repoLabels,
  createRepoLabel,
}: NewMrMetadataContext) {
  const [showBotDropdown, setShowBotDropdown] = useState(false);

  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  const [isLoadingReviewerOptions, setIsLoadingReviewerOptions] = useState(false);

  const [isLoadingLabelOptions, setIsLoadingLabelOptions] = useState(false);

  const [labelSearch, setLabelSearch] = useState('');

  const [newLabelColor, setNewLabelColor] = useState('#3b82f6');

  const botDropdownRef = useRef<HTMLDivElement>(null);

  const labelDropdownRef = useRef<HTMLDivElement>(null);

  const toggleReviewerDropdown = async () => {
    const willOpen = !showBotDropdown;
    setShowBotDropdown(willOpen);
    if (!willOpen) return;

    reloadPersistedReviewers();
    if (!currentRepo?.id) return;
    setIsLoadingReviewerOptions(true);
    try {
      await refreshRepoMetadata(currentRepo.id);
    } finally {
      setIsLoadingReviewerOptions(false);
    }
  };

  const toggleLabelDropdown = async () => {
    const willOpen = !showLabelDropdown;
    setShowLabelDropdown(willOpen);
    if (!willOpen || !currentRepo?.id) return;

    setIsLoadingLabelOptions(true);
    try {
      await refreshRepoMetadata(currentRepo.id);
    } finally {
      setIsLoadingLabelOptions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (botDropdownRef.current && !botDropdownRef.current.contains(e.target as Node)) {
        setShowBotDropdown(false);
      }
      if (labelDropdownRef.current && !labelDropdownRef.current.contains(e.target as Node)) {
        setShowLabelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleBot = (botId: string) => {
    if (!draftMr) return;
    const exists = draftMr.selectedBots.includes(botId);
    const updated = exists
      ? draftMr.selectedBots.filter((id) => id !== botId)
      : [...draftMr.selectedBots, botId];
    updateDraftMr({ selectedBots: updated });
  };

  const handleRemoveBot = (botId: string) => {
    if (!draftMr) return;
    updateDraftMr({ selectedBots: draftMr.selectedBots.filter((id) => id !== botId) });
  };

  const handleToggleLabel = (labelId: string) => {
    if (!draftMr) return;
    const exists = draftMr.selectedLabels.includes(labelId);
    const updated = exists
      ? draftMr.selectedLabels.filter((id) => id !== labelId)
      : [...draftMr.selectedLabels, labelId];
    updateDraftMr({ selectedLabels: updated });
  };

  const handleRemoveLabel = (labelId: string) => {
    if (!draftMr) return;
    updateDraftMr({ selectedLabels: draftMr.selectedLabels.filter((id) => id !== labelId) });
  };

  const handleCreateAndSelectLabel = async () => {
    const name = labelSearch.trim();
    if (!name || !draftMr) return;
    try {
      const existing = repoLabels.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (!draftMr.selectedLabels.includes(existing.id)) {
          updateDraftMr({ selectedLabels: [...draftMr.selectedLabels, existing.id] });
        }
      } else {
        const newLbl = await createRepoLabel(name, newLabelColor);
        if (newLbl) {
          updateDraftMr({ selectedLabels: [...draftMr.selectedLabels, newLbl.id] });
        }
      }
      setLabelSearch('');
    } catch (err) {
      console.error('Failed to create label:', err);
    }
  };

  return {
    isLoadingReviewerOptions,
    showBotDropdown,
    setShowBotDropdown,
    toggleReviewerDropdown,
    handleToggleBot,
    handleRemoveBot,
    botDropdownRef,
    isLoadingLabelOptions,
    showLabelDropdown,
    setShowLabelDropdown,
    toggleLabelDropdown,
    handleToggleLabel,
    handleRemoveLabel,
    labelSearch,
    setLabelSearch,
    newLabelColor,
    setNewLabelColor,
    handleCreateAndSelectLabel,
    labelDropdownRef,
  };
}
