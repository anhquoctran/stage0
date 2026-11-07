import { useTranslation } from 'react-i18next';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import type { CustomSelectOption } from '../../../../common/types/CustomSelectOption';
import encodings from '../../../../../shared/text-encodings.json';

export function FileEncodingPicker({ encoding, onChange }: {
  encoding: string | null;
  onChange: (encoding: string | null) => void;
}) {
  const { t } = useTranslation();
  const options: CustomSelectOption<string>[] = [
    { value: '', label: t('git.encoding.automatic') },
    ...encodings.map(value => ({ value, label: value })),
  ];

  return (
    <CustomSelect
      value={encoding ?? ''}
      onChange={value => onChange(value || null)}
      options={options}
      className="w-44 max-w-full min-w-0"
      buttonClassName="w-full min-w-0 bg-mantle px-2 py-1 text-xs"
      dropdownWidth="w-full"
      dropdownPlacement="auto"
      portal
      align="left"
      aria-label={t('git.encoding.label')}
    />
  );
}
