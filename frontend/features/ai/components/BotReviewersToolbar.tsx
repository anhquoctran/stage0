import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <>
      {/* Tab Header & Action Controls */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pb-4 border-b border-surface0/60 rounded-sm">
        <div className="min-w-0 flex-[1_1_20rem]">
          <h3 className="text-sm font-bold text-text flex items-center gap-2">
            <Shield className="w-4 h-4 shrink-0 text-brand" />
            {t('ai.botReviewers.title')}
          </h3>
          <p className="text-xs text-subtext0 mt-0.5">
            {t('ai.botReviewers.description')}
          </p>
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenResetConfirm}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border-0 bg-surface0 px-3 py-1.5 text-xs text-subtext0 transition-colors hover:bg-surface1 hover:text-text cursor-pointer"
            title={t('ai.botReviewers.resetGlobalTitle')}
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>{t('ai.botReviewers.resetButton')}</span>
          </button>
          <button
            type="button"
            onClick={onOpenAdd}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm border-0 bg-brand px-3 py-1.5 text-xs font-semibold text-on-accent shadow-xs transition-colors hover:bg-brand/90 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>{t('ai.botReviewers.newReviewer')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-[1_1_16rem]">
          <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-subtext0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('ai.botReviewers.searchPlaceholder')}
            className="w-full ps-8 pe-3 py-1.5 bg-surface0/60 border border-surface1 text-xs text-text placeholder-subtext0/70 focus:outline-none focus:border-brand rounded-sm"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-2 whitespace-nowrap text-xs text-subtext0 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyEnabled}
              onChange={(e) => setOnlyEnabled(e.target.checked)}
              className="accent-brand cursor-pointer"
            />
            <span>{t('ai.botReviewers.activeOnly')}</span>
          </label>
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`shrink-0 whitespace-nowrap px-2.5 py-1 text-xs transition-colors cursor-pointer border-0 rounded-sm ${
            selectedCategory === 'all'
              ? 'bg-surface1 text-text font-medium'
              : 'bg-surface0/60 text-subtext0 hover:bg-surface0'
          }`}
        >
          {t('ai.botReviewers.allCount', { count: globalReviewers.length })}
        </button>
        {BOT_CATEGORIES.map((cat) => {
          const count = globalReviewers.filter((b) => b.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 whitespace-nowrap px-2 py-1 text-xs transition-colors cursor-pointer border-0 rounded-sm ${
                selectedCategory === cat.id
                  ? `${cat.bg} font-medium`
                  : 'bg-surface0/60 text-subtext0 hover:bg-surface0'
              }`}
            >
              {t(`ai.botCategories.${cat.id}`)} ({count})
            </button>
          );
        })}
      </div>
    </>
  );
};
