import React from 'react';
import { Box } from '../../../../common/components/icons/Box';
import { useGitStore } from '../../../../features/git/store/useGitStore';
import { usePreferencesStore } from '../../../../features/preferences/store/usePreferencesStore';

export const StatusBarSandboxEngine: React.FC = () => {
  const { activeSandboxType } = useGitStore();
  const { openPreferences } = usePreferencesStore();

  const label =
    activeSandboxType === 'in_memory'
      ? 'In-Memory'
      : activeSandboxType === 'local_worktree'
      ? 'Worktree'
      : 'Docker';

  return (
    <button
      type="button"
      onClick={() => openPreferences('ai-sandbox')}
      className="h-5.5 px-2 bg-surface0/70 hover:bg-surface1 border border-surface1 hover:border-surface2 text-subtext0 hover:text-text flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs rounded-sm"
      title={`Configure Sandbox Engine in Preferences (${label})`}
    >
      <Box className="w-3 h-3 text-subtext0" />
      <span className="font-normal text-subtext0 max-xl:hidden">Sandbox:</span>
      <span className="font-medium text-text">{label}</span>
    </button>
  );
};

