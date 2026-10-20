import React from 'react';

export const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-brand' : 'bg-surface0'
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full shadow-xs transition duration-200 ease-in-out ${
        checked ? 'translate-x-4.5 bg-base' : 'translate-x-0.5 bg-overlay1'
      }`}
    />
  </button>
);
