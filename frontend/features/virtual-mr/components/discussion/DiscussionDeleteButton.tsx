import { useTranslation } from 'react-i18next';
import { Trash2 } from '../../../../common/components/icons/Trash2';

export function DiscussionDeleteButton({ onDelete, disabled }: {
  onDelete: (element: HTMLElement) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const label = t('virtualMr.discussion.deleteOwnContent');
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="p-1 rounded-sm text-subtext0 hover:text-red-600 hover:bg-red-600/10 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand cursor-pointer"
      onClick={(event) => {
        const target = event.currentTarget.closest<HTMLElement>('[data-delete-comment-id]');
        if (target) onDelete(target);
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
