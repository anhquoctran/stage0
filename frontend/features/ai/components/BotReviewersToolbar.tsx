import React from 'react';
import { Shield } from '../../../common/components/icons/Shield';
import { RotateCcw } from '../../../common/components/icons/RotateCcw';
import { Plus } from '../../../common/components/icons/Plus';
import { Search } from '../../../common/components/icons/Search';
import { BOT_CATEGORIES } from '../constants/botPresets';
import type { BotReviewer } from '../../virtual-mr/types/BotReviewer';

export const BotReviewersToolbar: React.FC<{
  globalReviewers: BotReviewer[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  onlyEnabled: boolean;
  setOnlyEnabled: (enabled: boolean) => void;
  onOpenAdd: () => void;
  onOpenResetConfirm: () => void;
}> = ({
  globalReviewers,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  onlyEnabled,
  setOnlyEnabled,
  onOpenAdd,
  onOpenResetConfirm,
}) => {
  return (
    <>
      {/* Tab Header & Action Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-surface0/60 rounded-sm">
        <div>
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand" />
            Global Reviewer Bots
          </h3>
          <p className="text-xs text-subtext0 mt-0.5">
            Configure automated reviewer bots with custom system roles, prompts, and models across projects.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={onOpenResetConfirm}
            className="px-3 py-1.5 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors flex items-center gap-1.5 cursor-pointer rounded-sm"
            title="Reset global reviewers to defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="px-3 py-1.5 bg-brand hover:bg-brand/90 text-on-accent font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs rounded-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Reviewer</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-subtext0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reviewers by name, tagline, or prompt..."
            className="w-full pl-8 pr-3 py-1.5 bg-surface0/60 border border-surface1 text-xs text-text placeholder-subtext0/70 focus:outline-none focus:border-brand rounded-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-subtext0 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyEnabled}
              onChange={(e) => setOnlyEnabled(e.target.checked)}
              className="accent-brand cursor-pointer"
            />
            <span>Active only</span>
          </label>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-2.5 py-1 text-xs transition-colors cursor-pointer border rounded-sm ${
            selectedCategory === 'all'
              ? 'bg-surface1 text-text border-surface2 font-medium'
              : 'bg-surface0/60 text-subtext0 hover:bg-surface0 border-transparent'
          }`}
        >
          All ({globalReviewers.length})
        </button>
        {BOT_CATEGORIES.map((cat) => {
          const count = globalReviewers.filter((b) => b.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2 py-1 text-xs transition-colors cursor-pointer border rounded-sm ${
                selectedCategory === cat.id
                  ? `${cat.bg} font-medium`
                  : 'bg-surface0/60 text-subtext0 hover:bg-surface0 border-transparent'
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>
    </>
  );
};

