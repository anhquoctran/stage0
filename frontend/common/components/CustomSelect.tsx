import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown } from './icons/ChevronDown';
import { Check } from './icons/Check';
import type { CustomSelectProps } from '../types/CustomSelectProps';

export function CustomSelect<T extends string>({
  id: customId,
  value,
  options,
  onChange,
  disabled = false,
  autoFocus = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  dropdownWidth = 'w-56',
  placeholder = 'Select option...',
  align = 'right',
  'aria-label': ariaLabel,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const generatedId = useId();
  const selectId = customId || generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const findEnabledOptionIndex = useCallback(
    (startIndex: number, direction: 1 | -1) => {
      if (options.length === 0) return -1;
      for (let step = 1; step <= options.length; step += 1) {
        const index = (startIndex + direction * step + options.length) % options.length;
        if (!options[index].disabled) return index;
      }
      return -1;
    },
    [options]
  );

  useEffect(() => {
    if (autoFocus) buttonRef.current?.focus();
  }, [autoFocus]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Sync highlighted index when opened
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = options.findIndex((opt) => opt.value === value && !opt.disabled);
      setHighlightedIndex(
        selectedIndex >= 0 ? selectedIndex : options.findIndex((option) => !option.disabled)
      );
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, options, value]);

  const handleSelect = useCallback(
    (newValue: T) => {
      onChange(newValue);
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((previous) => findEnabledOptionIndex(previous, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((previous) => findEnabledOptionIndex(previous, -1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < options.length &&
          !options[highlightedIndex].disabled
        ) {
          handleSelect(options[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={buttonRef}
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || selectedOption?.label || placeholder}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`flex items-center justify-between gap-2.5 px-3 py-1.5 rounded border text-xs transition-colors cursor-pointer select-none focus:outline-none focus:border-brand/70 focus:ring-1 focus:ring-brand/30 ${
          disabled
            ? 'bg-crust/50 border-surface0/50 text-subtext0 cursor-not-allowed opacity-60'
            : isOpen
            ? 'bg-base border-brand/60 text-text'
            : 'bg-crust border-surface0 hover:border-surface1 text-text'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-subtext0 transition-transform duration-150 shrink-0 ml-1 ${
            isOpen ? 'rotate-180 text-text' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-labelledby={selectId}
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } top-full mt-1.5 ${dropdownWidth} bg-mantle border border-surface0 rounded-md shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in duration-100 ${menuClassName}`}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isHighlighted = idx === highlightedIndex;
            const previousOption = options[idx - 1];
            const showGroupLabel = option.group && option.group !== previousOption?.group;

            return (
              <React.Fragment key={`${option.group ?? ''}:${option.value}`}>
                {showGroupLabel && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-subtext0 border-t border-surface0 first:border-t-0">
                    {option.group}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onClick={() => !option.disabled && handleSelect(option.value)}
                  onMouseEnter={() => !option.disabled && setHighlightedIndex(idx)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs transition-colors select-none ${
                    option.disabled
                      ? 'text-subtext0/50 cursor-not-allowed'
                      : isHighlighted
                      ? 'bg-surface0/60 text-text cursor-pointer'
                      : isSelected
                      ? 'bg-surface0/30 text-text cursor-pointer'
                      : 'text-subtext1 hover:text-text hover:bg-base cursor-pointer'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <span className={`truncate ${isSelected ? 'font-semibold text-text' : ''}`}>
                        {option.label}
                      </span>
                      {option.badge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-normal bg-brand/15 text-brand border border-brand/30">
                          {option.badge}
                        </span>
                      )}
                    </div>
                    {option.description && (
                      <span className="text-[11px] text-subtext0 leading-normal mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>

                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 text-brand shrink-0" />
                  ) : (
                    <span className="w-3.5 shrink-0" />
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { CustomSelectOption } from '../types/CustomSelectOption';
export type { CustomSelectProps } from '../types/CustomSelectProps';
