import { useState } from 'react';
import type { MrMetadataDropdownsContext } from './MrMetadataDropdownsContext';

export function useMrMetadataDropdowns({
  reloadPersistedReviewers,
  currentRepo,
  refreshRepoMetadata,
}: MrMetadataDropdownsContext) {
  const [showReviewerDropdown, setShowReviewerDropdown] = useState(false);

  const [showLabelDropdown, setShowLabelDropdown] = useState(false);

  const [isLoadingReviewerOptions, setIsLoadingReviewerOptions] = useState(false);

  const [isLoadingLabelOptions, setIsLoadingLabelOptions] = useState(false);

  const toggleReviewerDropdown = async () => {
    const willOpen = !showReviewerDropdown;
    setShowReviewerDropdown(willOpen);
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

  return {
    toggleReviewerDropdown,
    showReviewerDropdown,
    isLoadingReviewerOptions,
    setShowReviewerDropdown,
    toggleLabelDropdown,
    showLabelDropdown,
    setShowLabelDropdown,
    isLoadingLabelOptions,
  };
}
