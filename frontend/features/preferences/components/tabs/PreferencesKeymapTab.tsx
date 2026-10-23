import { useState } from 'react';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { KEYMAP_PRESETS, keymapPlatform, resolveKeymap } from '../../../../core/services/keymaps/catalog';
import { keymapErrors } from '../../../../core/services/keymaps/validation';
import { KeymapBindingRow } from '../keymaps/KeymapBindingRow';
import type { PreferencesKeymapTabProps } from '../../types/PreferencesKeymapTabProps';
import { openUrl } from '../../../../common/utils/openUrl';

export function PreferencesKeymapTab({ value, onChange }: PreferencesKeymapTabProps) {
  const [query, setQuery] = useState('');
  const [modifiedOnly, setModifiedOnly] = useState(false);
  const [resetEpoch, setResetEpoch] = useState(0);
  const platform = keymapPlatform();
  const preset = KEYMAP_PRESETS.find((item) => item.id === value.preset) ?? KEYMAP_PRESETS[0];
  const customized = new Set(value.overrides.map((item) => item.command));
  const search = query.trim().toLowerCase();
  const commands = resolveKeymap(value, platform).filter((command) =>
    (!modifiedOnly || customized.has(command.id)) &&
    `${command.id} ${command.label} ${command.scope} ${command.keys.join(' ')}`.toLowerCase().includes(search));
  const errors = [...new Set(['macos', 'windows', 'linux'].flatMap((os) => keymapErrors(value, os).map((error) => `${os}: ${error}`)))];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-semibold text-text" htmlFor="keymap-preset">Base keymap</label>
        <CustomSelect id="keymap-preset" value={value.preset} align="right" dropdownWidth="w-80"
          options={KEYMAP_PRESETS.map((item) => ({ value: item.id, label: item.label, description: item.description }))}
          onChange={(presetId) => onChange({ ...value, preset: presetId })} />
      </div>
      <p className="text-xs leading-relaxed text-subtext0">{preset.description} Presets adapt equivalent actions, not every shortcut of the original app. Your custom bindings are kept when changing presets.</p>
      {preset.documentation && <button type="button" onClick={() => { void openUrl(preset.documentation); }} className="rounded-sm text-xs text-brand underline">Original shortcut reference ↗</button>}
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search keybindings"
          placeholder="Search commands, keys or scope…" className="min-w-32 flex-1 rounded-sm border border-surface1 bg-crust px-3 py-2 text-xs text-text outline-none focus:border-brand" />
        <label className="flex items-center gap-1.5 text-[11px] text-subtext0"><input type="checkbox" checked={modifiedOnly} onChange={(event) => setModifiedOnly(event.target.checked)} className="rounded-sm accent-brand" /> Customized</label>
        <button type="button" disabled={!value.overrides.length} onClick={() => { setResetEpoch((epoch) => epoch + 1); onChange({ ...value, overrides: [] }); }}
          className="rounded-sm border border-surface1 px-2 py-1.5 text-xs text-subtext1 hover:bg-surface0 disabled:opacity-40">Reset custom bindings</button>
      </div>
      {errors.length > 0 && <div role="alert" className="rounded-sm border border-red/40 bg-red/10 p-3 text-xs text-red">Resolve conflicts before Apply/OK:
        <ul className="mt-1 list-disc pl-4">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
      </div>}
      <p className="text-[11px] text-subtext0">{commands.length} commands · Workspace shortcuts pause while typing or using a dialog. System editing keys stay with the OS/text control. OS-reserved combinations may not reach Stage0. Changes activate after Apply or OK.</p>
      <div className="rounded-sm border border-surface0">
        {commands.map((command) => <KeymapBindingRow key={`${value.preset}:${resetEpoch}:${command.id}`} command={command} settings={value} onChange={onChange} mac={platform === 'macos'} />)}
        {!commands.length && <p className="p-4 text-xs text-subtext0">No matching commands.</p>}
      </div>
    </div>
  );
}
