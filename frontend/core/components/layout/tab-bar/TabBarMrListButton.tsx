import React from 'react';
import { List } from '../../../../common/components/icons/List';

export const TabBarMrListButton: React.FC<{
  isActive: boolean;
  sessionCount: number;
  onClick: () => void;
}> = ({ isActive, sessionCount, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-8 shrink-0 items-center gap-1.5 border-t border-x px-2.5 transition-colors cursor-pointer rounded-sm ${
        isActive
          ? 'bg-mantle border-surface1 text-text font-medium shadow-xs'
          : 'border-transparent text-subtext0 hover:bg-surface0/50 hover:text-text'
      }`}
      title="Browse saved merge requests for this repository"
    >
      <List className={`h-3.5 w-3.5 ${isActive ? 'text-brand' : 'text-subtext0'}`} />
      <span className="hidden sm:inline">Merge Requests</span>
      <span className="font-mono text-[10px]">{sessionCount}</span>
      {isActive && (
        <div className="absolute bottom-0 inset-x-0 h-0.5 bg-brand" />
      )}
    </button>
  );
};

