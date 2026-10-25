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
  return (
    <form
      onSubmit={handleSaveRepoCustomBot}
      className="p-4 bg-crust border border-accent/40 space-y-3 animate-in fade-in duration-150"
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs text-text flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-accent" />
          <span>Create Repo-Exclusive Reviewer Bot</span>
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
          <label className="block text-[10px] text-subtext0 mb-1">Emoji</label>
          <input
            type="text"
            maxLength={4}
            value={repoBotEmoji}
            onChange={(e) => setRepoBotEmoji(e.target.value)}
            className="w-12 h-8 text-center text-[1rem] bg-surface0 border border-surface1 text-text rounded-sm"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-[10px] text-subtext0 mb-1">Bot Name *</label>
          <input
            type="text"
            required
            placeholder="e.g. Migration Linter"
            value={repoBotName}
            onChange={(e) => setRepoBotName(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs text-text rounded-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-subtext0 mb-1">Tagline</label>
          <input
            type="text"
            placeholder="e.g. Database schema backwards compatibility"
            value={repoBotTagline}
            onChange={(e) => setRepoBotTagline(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs text-text rounded-sm"
          />
        </div>
        <div>
          <label className="block text-[10px] text-subtext0 mb-1">Role</label>
          <CustomSelect
            value={repoBotCategory}
            options={repoBotCategoryOptions}
            onChange={setRepoBotCategory}
            className="w-full"
            buttonClassName="w-full"
            dropdownWidth="w-full"
            align="left"
            aria-label="Reviewer role"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-subtext0 mb-1">Execution engine</label>
          <CustomSelect
            value={repoBotExecutionMode}
            options={[
              { value: 'provider', label: 'Global LLM provider' },
              { value: 'acp', label: 'ACP Agent' },
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
            aria-label="Repository reviewer execution engine"
          />
        </div>
        {repoBotExecutionMode === 'acp' && (
          <div>
            <label className="block text-[10px] text-subtext0 mb-1">Installed ACP agent</label>
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
                searchPlaceholder="Search installed agents…"
                className="w-full"
                buttonClassName="w-full"
                dropdownWidth="w-full"
                align="left"
                aria-label="Repository ACP reviewer agent"
              />
            ) : (
              <p className="border border-yellow/40 bg-yellow/5 p-2 text-[10px] text-yellow">
                Install an agent in AI Preferences → External Agents first.
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
              I allow this ACP agent to receive eligible changed-file diffs and review context.
              Sensitive paths are excluded and matching secret lines are redacted, but detection
              cannot catch every secret. This consent is used for automatic reviews assigned to this
              bot.
            </span>
          </label>
          <p className="text-[10px] text-subtext0">
            Stage0 validates tool requests and finding evidence; the agent runs outside the
            repository directory.
          </p>
        </div>
      )}

      <div>
        <label className="block text-[10px] text-subtext0 mb-1">
          Stage0 System Prompt ·{' '}
          {BOT_CATEGORIES.find((category) => category.id === repoBotCategory)?.label} · read-only
        </label>
        <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap px-2.5 py-1.5 bg-crust border border-surface1 text-[10px] font-mono text-subtext1">
          {getBotRolePrompt(repoBotCategory)}
        </pre>
        <label className="block text-[10px] text-subtext0 mb-1 mt-2">
          Additional Instructions <span className="font-normal">(optional)</span>
        </label>
        <textarea
          rows={3}
          value={repoBotInstructions}
          onChange={(e) => setRepoBotInstructions(e.target.value)}
          placeholder="Add bot-specific review guidance for this repository..."
          className="w-full px-2.5 py-1.5 bg-surface0 border border-surface1 text-xs font-mono text-text rounded-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setIsAddingRepoBot(false)}
          className="px-3 py-1 bg-surface0 text-xs cursor-pointer rounded-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-1 border-0 bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-on-accent font-semibold text-xs cursor-pointer shadow-xs rounded-sm"
        >
          Save Bot
        </button>
      </div>
    </form>
  );
}
