import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { Bot } from '../../../../common/components/icons/Bot';
import { AcpReviewerConfigOptions } from '../../../ai/components/AcpReviewerConfigOptions';
import { BOT_CATEGORIES } from '../../../ai/constants/botPresets';
import { getBotRolePrompt } from '../../../ai/utils/botRolePrompts';
import type { RepositoryCustomBotFormProps } from './RepositoryCustomBotFormProps';

export function RepositoryCustomBotForm({
  handleSaveRepoCustomBot,
  canSubmit,
  acpConfig,
  setIsAddingRepoBot,
  repoBotEmoji,
  setRepoBotEmoji,
  repoBotName,
  setRepoBotName,
  repoBotTagline,
  setRepoBotTagline,
  repoBotCategory,
  repoBotCategoryOptions,
  setRepoBotCategory,
  repoBotExecutionMode,
  setRepoBotExecutionMode,
  repoBotAcpAgentId,
  setRepoBotAcpAgentId,
  externalAgents,
  setRepoBotAcpConfigOptions,
  repoBotAcpConfigOptions,
  repoBotAllowAcpSourceTransfer,
  setRepoBotAllowAcpSourceTransfer,
  repoBotInstructions,
  setRepoBotInstructions,
}: RepositoryCustomBotFormProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <form
      onSubmit={handleSaveRepoCustomBot}
      className="p-4 bg-crust border border-accent/40 space-y-3 animate-in fade-in duration-150"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs text-text flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-accent" />
          <span>{translateUiText('git.repositoryBotForm.title')}</span>
        </span>
        <button
          type="button"
          onClick={() => setIsAddingRepoBot(false)}
          className="text-subtext0 hover:text-text cursor-pointer rounded-sm"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-1">
          <label className="block text-[10px] text-subtext0 mb-1">{translateUiText('git.repositoryBotForm.emoji')}</label>
          <input
            type="text"
            maxLength={4}
            value={repoBotEmoji}
            onChange={(e) => setRepoBotEmoji(e.target.value)}
            className="w-12 h-8 text-center text-[1rem] bg-surface0 border border-surface1 text-text rounded-sm"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-[10px] text-subtext0 mb-1">{translateUiText('git.repositoryBotForm.botName')} *</label>
          <input
            type="text"
            required
            placeholder={translateUiText('git.repositoryBotForm.botNameExample')}
            value={repoBotName}
            onChange={(e) => setRepoBotName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs text-text rounded-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-subtext0 mb-1">{translateUiText('git.repositoryBotForm.tagline')}</label>
          <input
            type="text"
            placeholder={translateUiText('git.repositoryBotForm.taglineExample')}
            value={repoBotTagline}
            onChange={(e) => setRepoBotTagline(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs text-text rounded-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] text-subtext0 mb-1">{translateUiText('git.repositoryBotForm.role')}</label>
          <CustomSelect
            value={repoBotCategory}
            options={repoBotCategoryOptions}
            onChange={setRepoBotCategory}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label={translateUiText('git.repositoryBotForm.role')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-subtext0 mb-1">{translateUiText('git.repositoryBotForm.executionEngine')}</label>
          <CustomSelect
            value={repoBotExecutionMode}
            options={[
              { value: 'provider', label: translateUiText('git.repositoryBotForm.globalProvider') },
              { value: 'acp', label: translateUiText('git.repositoryBotForm.acpAgent') },
            ]}
            onChange={(mode) => {
              setRepoBotExecutionMode(mode as 'provider' | 'acp');
              if (mode === 'acp' && !repoBotAcpAgentId)
                setRepoBotAcpAgentId(externalAgents[0]?.id || '');
            }}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label={translateUiText('git.repositoryBotForm.executionEngine')}
          />
        </div>
        {repoBotExecutionMode === 'acp' && (
          <div>
            <label className="block text-[10px] text-subtext0 mb-1">{translateUiText('git.repositoryBotForm.installedAcpAgent')}</label>
            {externalAgents.length > 0 ? (
              <CustomSelect
                value={repoBotAcpAgentId}
                options={externalAgents.map((agent) => ({
                  value: agent.id,
                  label: `${agent.name}${agent.version ? ` · ${agent.version}` : ''}`,
                  description: agent.description || agent.source,
                }))}
                onChange={(agentId) => {
                  setRepoBotAcpAgentId(agentId);
                  setRepoBotAcpConfigOptions({});
                }}
                searchable
                searchPlaceholder={translateUiText('git.repositoryBotForm.searchAgents')}
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label={translateUiText('git.repositoryBotForm.acpReviewerAgent')}
              />
            ) : (
              <p className="border border-yellow/40 bg-yellow/5 p-2 text-[10px] text-yellow">
                {translateUiText('git.repositoryBotForm.installAgentFirst')}
              </p>
            )}
          </div>
        )}
      </div>

      {repoBotExecutionMode === 'acp' && (
        <AcpReviewerConfigOptions
          agent={externalAgents.find((agent) => agent.id === repoBotAcpAgentId)}
          value={repoBotAcpConfigOptions}
          state={acpConfig}
        />
      )}

      {repoBotExecutionMode === 'acp' && (
        <div className="space-y-2 border border-surface0 bg-surface0/20 p-2.5 rounded-sm">
          <label className="flex items-start gap-2 text-[10px] text-subtext0">
            <input
              type="checkbox"
              checked={repoBotAllowAcpSourceTransfer}
              onChange={(event) => setRepoBotAllowAcpSourceTransfer(event.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span>
              {translateUiText('git.repositoryBotForm.sourceTransferConsent')}
            </span>
          </label>
          <p className="text-[10px] text-subtext0">
            {translateUiText('git.repositoryBotForm.agentIsolationNote')}
          </p>
        </div>
      )}

      <div>
        <label className="block text-[10px] text-subtext0 mb-1">
          {translateUiText('git.repositoryBotForm.systemPrompt')} ·{' '}
          {BOT_CATEGORIES.find((category) => category.id === repoBotCategory)?.label} · {translateUiText('git.repositoryBotForm.readOnly')}
        </label>
        <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap px-2.5 py-1.5 bg-crust border border-surface1 text-[10px] font-mono text-subtext1">
          {getBotRolePrompt(repoBotCategory)}
        </pre>
        <label className="block text-[10px] text-subtext0 mb-1 mt-2">
          {translateUiText('git.repositoryBotForm.additionalInstructions')} <span className="font-normal">({translateUiText('common.optional')})</span>
        </label>
        <textarea
          rows={3}
          value={repoBotInstructions}
          onChange={(e) => setRepoBotInstructions(e.target.value)}
          placeholder={translateUiText('git.repositoryBotForm.instructionsPlaceholder')}
          className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs font-mono text-text rounded-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIsAddingRepoBot(false)}
          className="px-3 py-1 bg-surface0 text-xs cursor-pointer rounded-sm"
        >
          {translateUiText('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-1 border-0 bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-on-accent font-semibold text-xs cursor-pointer shadow-xs rounded-sm"
        >
          {translateUiText('git.repositoryBotForm.saveBot')}
        </button>
      </div>
    </form>
  );
}
