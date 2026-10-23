import React from 'react';
import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import { X } from '../../../../common/components/icons/X';
import { formatShortcutText } from '../../../../common/utils/shortcuts';
import type { VirtualMrSession } from '../../../../features/virtual-mr/types/VirtualMrSession';
import { TabBarStatusBadge } from './TabBarStatusBadge';
import { TabBarSessionConflictIndicator } from './TabBarSessionConflictIndicator';

export const TabBarSessionItem: React.FC<{
  session: VirtualMrSession;
  isActive: boolean;
  isDiffLoading: boolean;
  hasConflict: boolean;
  conflictCount: number;
  onSelect: () => void;
  onClose: () => void;
}> = ({
  session,
  isActive,
  isDiffLoading,
  hasConflict,
  conflictCount,
  onSelect,
  onClose,
}) => {
  const displayTitle = session.title || `${session.compareBranch} → ${session.baseBranch}`;

  return (
    <div
      onClick={onSelect}
      className={`group relative h-8 px-2.5 border-t border-x flex items-center gap-2 cursor-pointer transition-colors shrink-0 max-w-[260px] rounded-sm ${
        isActive
          ? 'bg-mantle border-surface1 text-text font-medium shadow-xs'
          : 'bg-crust/50 border-transparent text-subtext0 hover:text-text hover:bg-surface0/40'
      }`}
    >
      <GitPullRequest
        className={`w-3.5 h-3.5 shrink-0 ${
          isActive ? 'text-brand' : 'text-subtext0'
        }`}
      />

      <span
        className={`truncate text-xs ${isActive ? 'font-medium text-text' : 'text-subtext0'}`}
        title={displayTitle}
      >
        {displayTitle}
      </span>

      <TabBarStatusBadge status={session.status} />

      {isActive && (
        <TabBarSessionConflictIndicator
          isLoading={isDiffLoading}
          hasConflict={hasConflict}
          conflictCount={conflictCount}
        />
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-surface1 text-subtext0 hover:text-text transition-opacity ml-1 cursor-pointer shrink-0 rounded-sm"
        title={formatShortcutText('Close tab. This MR remains saved in this repository. (Ctrl+W)')}
      >
        <X className="w-3 h-3" />
      </button>

      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
      )}
    </div>
  );
};

