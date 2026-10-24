import { GitBranch } from '../../../../common/components/icons/GitBranch';
import { Check } from '../../../../common/components/icons/Check';
import { KEYMAP_PRESETS } from '../../../../core/services/keymaps/catalog';
import type { KeymapPresetPickerProps } from '../../types/KeymapPresetPickerProps';

export function KeymapPresetPicker({ value, onChange }: KeymapPresetPickerProps) {
  return (
    <div role="group" aria-label="Keymap presets" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {KEYMAP_PRESETS.map((preset) => (
        <button key={preset.id} type="button" aria-pressed={value.preset === preset.id}
          title={preset.description} onClick={() => onChange({ ...value, preset: preset.id })}
          className={`flex min-h-14 items-center gap-2 rounded-sm border px-3 py-2 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-mauve ${
            value.preset === preset.id ? 'border-mauve bg-mauve/10 text-text' : 'border-surface0 bg-crust text-subtext1 hover:border-mauve/50 hover:bg-surface0/40'
          }`}>
          <GitBranch className="h-4 w-4 shrink-0 text-mauve" />
          <span className="min-w-0 flex-1 font-medium">{preset.label}</span>
          {value.preset === preset.id && <Check className="h-3.5 w-3.5 shrink-0 text-mauve" />}
        </button>
      ))}
    </div>
  );
}
