import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { KeymapPresetLogo } from './KeymapPresetLogo';
import { Check } from '../../../../common/components/icons/Check';
import { KEYMAP_PRESETS } from '../../../../core/services/keymaps/catalog';
import type { KeymapPresetPickerProps } from '../../types/KeymapPresetPickerProps';

export function KeymapPresetPicker({ value, onChange }: KeymapPresetPickerProps) {
  const { t: translateUiText } = useUiTextTranslation();
  return (
    <div role="group" aria-label={translateUiText('preferences.keymaps.presetsLabel')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {KEYMAP_PRESETS.map((preset) => (
        <button key={preset.id} type="button" aria-pressed={value.preset === preset.id}
          title={translateUiText(`preferences.keymaps.presetDescriptions.${preset.id}`)} onClick={() => onChange({ ...value, preset: preset.id })}
          className={`flex min-h-14 items-center gap-2 rounded-sm border px-3 py-2 text-start text-xs transition-colors focus-visible:outline focus-visible:outline-brand ${
            value.preset === preset.id ? 'border-brand bg-brand/10 text-text' : 'border-surface0 bg-crust text-subtext1 hover:border-brand/50 hover:bg-surface0/40'
          }`}>
          <KeymapPresetLogo preset={preset.id} />
          <span className="min-w-0 flex-1 font-medium">{preset.label}</span>
          {value.preset === preset.id && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
        </button>
      ))}
    </div>
  );
}
