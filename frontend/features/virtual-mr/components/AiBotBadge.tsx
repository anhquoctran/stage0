import { useTranslation } from 'react-i18next';
import { Bot } from '../../../common/components/icons/Bot';

export function AiBotBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border-0 bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-none text-white" aria-label={t('virtualMr.discussion.botBadgeAria')}>
      <Bot className="h-2.5 w-2.5" aria-hidden="true" />
      {t('virtualMr.discussion.botBadge')}
    </span>
  );
}
