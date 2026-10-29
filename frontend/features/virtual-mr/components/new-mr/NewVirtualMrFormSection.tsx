import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { GitPullRequest } from '../../../../common/components/icons/GitPullRequest';
import { Loader2 } from '../../../../common/components/icons/Loader2';
import { MarkdownEditor } from '../../../../common/components/MarkdownEditor';
import { NewVirtualMrLabelsSection } from '../NewVirtualMrLabelsSection';
import { NewVirtualMrReviewersSection } from '../NewVirtualMrReviewersSection';
import type { NewVirtualMrFormSectionProps } from './NewVirtualMrFormSectionProps';

export function NewVirtualMrFormSection({
  draftMr,
  updateDraftMr,
  handleGenerateDescription,
  effectiveReviewers,
  isLoadingReviewerOptions,
  showBotDropdown,
  setShowBotDropdown,
  toggleReviewerDropdown,
  handleToggleBot,
  handleRemoveBot,
  botDropdownRef,
  repoLabels,
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
  handleSubmit,
  isSubmitting,
  canCreateVirtualMr,
  closeNewMrDraft,
}: NewVirtualMrFormSectionProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div className="border-b border-surface0 bg-base/50 p-4 shrink-0 space-y-3 rounded-sm">
      <div className="flex items-start gap-4">
        <div className="flex-1 space-y-2.5">
          {/* Title Input */}
          <input
            type="text"
            value={draftMr.title}
            onChange={(e) => updateDraftMr({ title: e.target.value })}
            placeholder="Virtual MR Title..."
            className="w-full px-3 py-1.5 bg-mantle border border-surface1 focus:border-brand text-xs text-text font-medium placeholder:text-subtext0 outline-none transition-colors rounded-sm"
          />

          {/* Markdown Description */}
          <div className="border border-surface1 bg-mantle overflow-hidden">
            <MarkdownEditor
              value={draftMr.description}
              onChange={(description) => updateDraftMr({ description })}
              placeholder="Write your description or notes here..."
              rows={10}
              minHeight="260px"
              maxHeight="650px"
              onGenerateDraft={handleGenerateDescription}
            />
          </div>
        </div>

        {/* Sidebar Configuration (Bots & Labels) + Create Action */}
        <div className="w-72 shrink-0 space-y-3">
          {/* Reviewers Section */}
          <NewVirtualMrReviewersSection
            selectedBots={draftMr.selectedBots}
            effectiveReviewers={effectiveReviewers}
            isLoadingReviewerOptions={isLoadingReviewerOptions}
            showBotDropdown={showBotDropdown}
            setShowBotDropdown={setShowBotDropdown}
            onToggleReviewerDropdown={toggleReviewerDropdown}
            onToggleBot={handleToggleBot}
            onRemoveBot={handleRemoveBot}
            botDropdownRef={botDropdownRef}
          />

          {/* Labels Section */}
          <NewVirtualMrLabelsSection
            selectedLabels={draftMr.selectedLabels}
            repoLabels={repoLabels}
            isLoadingLabelOptions={isLoadingLabelOptions}
            showLabelDropdown={showLabelDropdown}
            setShowLabelDropdown={setShowLabelDropdown}
            onToggleLabelDropdown={toggleLabelDropdown}
            onToggleLabel={handleToggleLabel}
            onRemoveLabel={handleRemoveLabel}
            labelSearch={labelSearch}
            setLabelSearch={setLabelSearch}
            newLabelColor={newLabelColor}
            setNewLabelColor={setNewLabelColor}
            handleCreateAndSelectLabel={handleCreateAndSelectLabel}
            labelDropdownRef={labelDropdownRef}
          />

          {/* Create Button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting || !canCreateVirtualMr}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-brand hover:bg-brand/90 active:scale-[0.98] text-on-accent font-bold text-xs shadow-md shadow-brand/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-on-accent" />
              ) : (
                <GitPullRequest className="w-4 h-4 stroke-[2.5]" />
              )}
              <span>Create Virtual MR</span>
            </button>

            <button
              type="button"
              onClick={closeNewMrDraft}
              className="px-3 py-2 bg-surface0 hover:bg-surface1 text-subtext0 hover:text-text text-xs font-medium transition-colors cursor-pointer border border-surface1/60 rounded-sm"
            >
              {translateUiText('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
