import { Monitor } from '../../../common/components/icons/Monitor';
import { Sun } from '../../../common/components/icons/Sun';
import { Moon } from '../../../common/components/icons/Moon';
import { Check } from '../../../common/components/icons/Check';
import type { WelcomeSettingsProps } from '../types/WelcomeSettingsProps';

export function WelcomeThemePicker({ settings, onChange }: Omit<WelcomeSettingsProps, 'step'>) {
  const choices = [
    { mode: 'system', label: 'System', description: 'Follow your OS', icon: Monitor },
    { mode: 'light', label: 'Light', description: 'A bright workspace', icon: Sun },
    { mode: 'dark', label: 'Dark', description: 'A darker workspace', icon: Moon },
  ] as const;
  return (
    <div role="group" aria-label="Theme mode" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {choices.map(({ mode, label, description, icon: Icon }) => (
        <button key={mode} type="button" aria-pressed={settings.themeMode === mode}
          onClick={() => onChange((previous) => ({ ...previous, themeMode: mode }))}
          className={`rounded-sm border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-brand ${
            settings.themeMode === mode ? 'border-brand bg-brand/10 text-text' : 'border-surface0 bg-crust text-subtext1 hover:border-brand/50'
          }`}>
          <span aria-hidden="true" className="mb-3 flex h-16 overflow-hidden rounded-sm border border-surface1/40">
            {(mode === 'system' ? ['light', 'dark'] : [mode]).map((palette) => (
              <span key={palette} className="flex flex-1 flex-col gap-1.5 p-2.5" style={{ backgroundColor: palette === 'light' ? '#eff1f5' : '#1e1e2e' }}>
                <span className="h-1.5 w-3/4 rounded-sm" style={{ backgroundColor: 'var(--color-brand)' }} />
                <span className="h-1 w-full rounded-sm" style={{ backgroundColor: palette === 'light' ? '#bec4d0' : '#585b70' }} />
                <span className="h-1 w-2/3 rounded-sm" style={{ backgroundColor: palette === 'light' ? '#bec4d0' : '#585b70' }} />
              </span>
            ))}
          </span>
          <span className="flex items-center gap-2 text-xs font-semibold">
            <Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{label}</span>
            {settings.themeMode === mode && <Check className="h-3.5 w-3.5 text-brand" />}
          </span>
          <span className="mt-1 block text-[11px] text-subtext0">{description}</span>
        </button>
      ))}
    </div>
  );
}
