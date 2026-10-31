import { useState } from 'react';
import { useTranslation as useUiTextTranslation } from 'react-i18next';
import { KeymapPresetPicker } from '../keymaps/KeymapPresetPicker';
import { getOsFileManagerName } from '../../../git/utils/fileActions';
import { menuLabel } from '../../../../core/constants/applicationMenu';
import {
    KEYMAP_PRESETS,
    keymapPlatform,
    resolveKeymap,
} from '../../../../core/services/keymaps/catalog';
import { keymapErrors } from '../../../../core/services/keymaps/validation';
import { KeymapBindingRow } from '../keymaps/KeymapBindingRow';
import type { PreferencesKeymapTabProps } from '../../types/PreferencesKeymapTabProps';
import { openUrl } from '../../../../common/utils/openUrl';

export function PreferencesKeymapTab({
    value,
    onChange,
}: PreferencesKeymapTabProps) {
    const { t: translateUiText } = useUiTextTranslation();
    const [query, setQuery] = useState('');
    const [modifiedOnly, setModifiedOnly] = useState(false);
    const [resetEpoch, setResetEpoch] = useState(0);
    const platform = keymapPlatform();
    const preset =
        KEYMAP_PRESETS.find((item) => item.id === value.preset) ??
        KEYMAP_PRESETS[0];
    const customized = new Set(value.overrides.map((item) => item.command));
    const search = query.trim().toLowerCase();
    const fileManager = getOsFileManagerName();
    const commands = resolveKeymap(value, platform).filter((command) => {
        if (modifiedOnly && !customized.has(command.id)) return false;
        const translatedLabel = menuLabel(translateUiText(command.label), fileManager);
        return `${command.id} ${command.label} ${translatedLabel} ${command.scope} ${command.keys.join(' ')}`
            .toLowerCase()
            .includes(search);
    });
    const errors = [
        ...new Set(
            ['macos', 'windows', 'linux'].flatMap((os) =>
                keymapErrors(value, os).map((error) => `${os}: ${error}`),
            ),
        ),
    ];
    return (
        <div className="space-y-4">
            <h3 className="text-xs font-semibold text-text">{translateUiText('preferences.keymaps.title')}</h3>
            <KeymapPresetPicker value={value} onChange={onChange} />
            <p className="text-xs leading-relaxed text-subtext0">
                {translateUiText(`preferences.keymaps.presetDescriptions.${preset.id}`)}{' '}
                {translateUiText('preferences.keymaps.description')}
            </p>
            {preset.documentation && (
                <button
                    type="button"
                    onClick={() => {
                        void openUrl(preset.documentation);
                    }}
                    className="rounded-sm text-xs text-brand underline"
                >
                    {translateUiText('preferences.keymaps.originalReference')}
                </button>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label={translateUiText('preferences.keymaps.searchLabel')}
                    placeholder={translateUiText('preferences.keymaps.searchPlaceholder')}
                    className="min-w-32 flex-1 rounded-sm border border-surface1 bg-crust px-3 py-2 text-xs text-text outline-none focus:border-brand"
                />
                <label className="flex items-center gap-1.5 text-[11px] text-subtext0">
                    <input
                        type="checkbox"
                        checked={modifiedOnly}
                        onChange={(event) =>
                            setModifiedOnly(event.target.checked)
                        }
                        className="rounded-sm accent-brand"
                    />{' '}
                    {translateUiText('preferences.keymaps.customized')}
                </label>
                <button
                    type="button"
                    disabled={!value.overrides.length}
                    onClick={() => {
                        setResetEpoch((epoch) => epoch + 1);
                        onChange({ ...value, overrides: [] });
                    }}
                    className="rounded-sm border border-surface1 px-2 py-1.5 text-xs text-subtext1 hover:bg-surface0 disabled:opacity-40"
                >
                    {translateUiText('preferences.keymaps.resetCustomBindings')}
                </button>
            </div>
            {errors.length > 0 && (
                <div
                    role="alert"
                    className="rounded-sm border border-red/40 bg-red/10 p-3 text-xs text-red"
                >
                    {translateUiText('preferences.keymaps.resolveConflicts')}
                    <ul className="mt-1 list-disc ps-4">
                        {errors.map((error) => (
                            <li key={error}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}
            <p className="text-[11px] text-subtext0">
                {translateUiText('preferences.keymaps.behaviorDescription', { count: commands.length })}
            </p>
            <div className="rounded-sm border border-surface0">
                {commands.map((command) => (
                    <KeymapBindingRow
                        key={`${value.preset}:${resetEpoch}:${command.id}`}
                        command={command}
                        settings={value}
                        onChange={onChange}
                        mac={platform === 'macos'}
                    />
                ))}
                {!commands.length && (
                    <p className="p-4 text-xs text-subtext0">
                        {translateUiText('preferences.keymaps.noMatchingCommands')}
                    </p>
                )}
            </div>
        </div>
    );
}
