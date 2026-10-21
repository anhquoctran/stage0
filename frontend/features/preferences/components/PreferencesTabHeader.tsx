import React from 'react';

export const PreferencesTabHeader: React.FC<{
  title?: string;
  description?: string;
}> = ({ title, description }) => {
  if (!title) return null;

  return (
    <div className="mb-6 pb-4 border-b border-surface0/60">
      <h2 className="text-lg font-bold text-text mb-1 tracking-tight">
        {title}
      </h2>
      {description && (
        <p className="text-xs text-subtext0 leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
};

