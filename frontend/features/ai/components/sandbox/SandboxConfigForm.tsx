import { useTranslation } from 'react-i18next';
import { Radio } from '../../../../common/components/Radio';
import type { SandboxConfigFormProps } from './SandboxConfigFormProps';

export function SandboxConfigForm({
  adapters,
  draftSandboxType,
  committedSandboxType,
  onSelectAdapter,
}: SandboxConfigFormProps) {
  const { t } = useTranslation();
  return (
    <div className="border border-surface0 rounded-sm divide-y divide-surface0/60 overflow-hidden bg-base/30">
      {adapters.map((adapter) => {
        const isSelected = draftSandboxType === adapter.id;
        const isCurrent = committedSandboxType === adapter.id;

        return (
          <div
            key={adapter.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectAdapter(adapter.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectAdapter(adapter.id);
              }
            }}
            className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 select-none rounded-sm ${
              isSelected ? 'bg-surface0/60' : 'hover:bg-surface0/30'
            }`}
          >
            {/* Radio Indicator */}
            <div className="pt-0.5 shrink-0 pointer-events-none">
              <Radio
                checked={isSelected}
                name="sandbox-adapter"
                readOnly
                aria-label={t('ai.sandbox.selectAdapter', { name: adapter.title })}
              />
            </div>

            {/* Text Information */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-text">{adapter.title}</span>

                {adapter.defaultBadge && (
                  <span className="text-[10px] font-mono text-subtext0 px-1.5 py-0.2 rounded-sm bg-surface0 border border-surface1 uppercase">
                    {t('ai.sandbox.default')}
                  </span>
                )}

                {adapter.extraBadge && (
                  <span className="text-[10px] font-mono text-subtext0 px-1.5 py-0.2 rounded-sm bg-surface0 border border-surface1">
                    {adapter.extraBadge}
                  </span>
                )}

                {isCurrent && (
                  <span className="text-[10px] font-mono text-subtext0 px-1.5 py-0.2 rounded-sm bg-surface1 border border-surface2">
                    {t('ai.sandbox.active')}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-subtext0 mt-1 leading-relaxed">
                {adapter.description}
              </p>

              <div className="text-[10px] font-mono text-subtext0/70 mt-1.5">{adapter.specs}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
