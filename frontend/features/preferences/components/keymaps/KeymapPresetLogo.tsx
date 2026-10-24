import { AppLogo } from '../../../../common/components/AppLogo';
import { KEYMAP_PRESET_LOGOS } from '../../constants/keymapPresetLogos';
import type { KeymapPresetLogoProps } from '../../types/KeymapPresetLogoProps';

export function KeymapPresetLogo({ preset }: KeymapPresetLogoProps) {
  const source = KEYMAP_PRESET_LOGOS[preset];
  return (
    <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center">
      {source ? (
        <img src={source} alt="" width={24} height={24} draggable={false}
          className="h-6 w-6 object-contain" />
      ) : (
        <AppLogo size="sm" />
      )}
    </span>
  );
}
