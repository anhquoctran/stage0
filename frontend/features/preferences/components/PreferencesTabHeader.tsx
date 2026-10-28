import React from 'react';
import { useTranslation } from 'react-i18next';

export const PreferencesTabHeader: React.FC<{
  title?: string;
  description?: string;
  itemId?: string;
}> = ({ title, description, itemId }) => {
  const { t } = useTranslation();
  if (!title) return null;

  return (
    <div className="mb-6 pb-4 border-b border-surface0/60">
      <h2 className="text-lg font-bold text-text mb-1 tracking-tight">
        {itemId ? t(`preferences.headers.${itemId}.title`, title) : title}
      </h2>
      {description && (
        <p className="text-xs text-subtext0 leading-relaxed">
          {itemId ? t(`preferences.headers.${itemId}.description`, description) : description}
        </p>
      )}
    </div>
  );
};

