import { forwardRef } from 'react';
import { clsx } from 'clsx';
import type { RadioProps } from '../types/RadioProps';

const SIZE_MAP = {
  sm: {
    outer: 'w-3.5 h-3.5',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    outer: 'w-4 h-4',
    dot: 'w-2 h-2',
  },
  lg: {
    outer: 'w-5 h-5',
    dot: 'w-2.5 h-2.5',
  },
};

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  {
    checked = false,
    disabled = false,
    label,
    description,
    size = 'md',
    className = '',
    containerClassName = '',
    onChange,
    ...rest
  },
  ref
) {
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <label
      className={clsx(
        'inline-flex items-start gap-2 select-none group',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        containerClassName
      )}
    >
      <div className="relative flex items-center justify-center shrink-0 pt-0.5">
        <input
          ref={ref}
          type="radio"
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="sr-only peer"
          {...rest}
        />
        <div
          className={clsx(
            'rounded-full border flex items-center justify-center transition-all duration-150',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-crust',
            sizeConfig.outer,
            checked
              ? 'border-brand bg-base'
              : 'border-surface2 bg-base/40 group-hover:border-subtext0',
            className
          )}
        >
          <span
            className={clsx(
              'rounded-full bg-brand transition-all duration-150 ease-out',
              sizeConfig.dot,
              checked ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
            )}
          />
        </div>
      </div>
      {(label || description) && (
        <div className="flex flex-col text-start">
          {label && <span className="text-xs font-semibold text-text">{label}</span>}
          {description && (
            <span className="text-[11px] text-subtext0 leading-relaxed">{description}</span>
          )}
        </div>
      )}
    </label>
  );
});

