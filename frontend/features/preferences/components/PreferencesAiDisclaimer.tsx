import React from 'react';

export const PreferencesAiDisclaimer: React.FC<{
  isVisible: boolean;
}> = ({ isVisible }) => {
  if (!isVisible) return null;

  return (
    <p className="mb-4 border border-surface1 bg-base p-3 text-[11px] text-subtext0">
      Configuration changes are drafts until Apply or OK. Cancel discards changes since the last Apply.
      Sign-in/out, tests, discovery, audit clearing, copy/export and sandbox execution are separate immediate actions; Cancel does not undo them.
    </p>
  );
};

