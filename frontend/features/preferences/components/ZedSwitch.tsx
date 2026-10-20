import React from 'react';
import type { ZedSwitchProps } from '../types/ZedSwitchProps';

export const ZedSwitch: React.FC<ZedSwitchProps> = ({ checked, onChange, disabled, id }) => {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${disabled
          ? 'opacity-40 cursor-not-allowed bg-surface0'
          : checked
            ? 'bg-brand'
            : 'bg-surface0'
        }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-crust shadow-xs ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4.5 bg-crust' : 'translate-x-0.5 bg-subtext0'
          }`}
      />
    </button>
  );
};
