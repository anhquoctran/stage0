import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React from 'react';
import { AlertTriangle } from '../../../common/components/icons/AlertTriangle';

export const PreferencesRestartModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { t: translateUiText } = useUiTextTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-[var(--backdrop-modal)] backdrop-blur-xs animate-in fade-in duration-100">
      <div
        className="w-full max-w-md bg-mantle border border-surface0 shadow-2xl p-5 flex flex-col gap-3 text-text rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 text-text">
          <AlertTriangle className="w-5 h-5 text-yellow shrink-0" />
          <h3 className="text-sm font-bold">{translateUiText('preferences.restart.title')}</h3>
        </div>
        <p className="text-xs text-subtext0 leading-relaxed">
          {translateUiText('preferences.restart.description')}
        </p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs bg-surface0 hover:bg-surface1 text-text border border-surface1 font-semibold transition-colors cursor-pointer rounded-sm"
          >
            {translateUiText('common.ok')}
          </button>
        </div>
      </div>
    </div>
  );
};

