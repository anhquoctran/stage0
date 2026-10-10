import React, { useState, useRef, useEffect, useCallback, useId, useMemo } from 'react';
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
  searchable = false,
  searchPlaceholder = 'Search options...',
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
  const [search, setSearch] = useState('');
  const generatedId = useId();
  const selectId = customId || generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matchingOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return !searchable || !query ? options : options.filter((option) =>
      `${option.label} ${option.description ?? ''}`.toLowerCase().includes(query));
  }, [options, search, searchable]);
  // Large remote listings remain searchable without mounting thousands of rows.
  const visibleOptions = useMemo(() => searchable ? matchingOptions.slice(0, 200) : matchingOptions, [matchingOptions, searchable]);

  const selectedOption = options.find((opt) => opt.value === value);

  const findEnabledOptionIndex = useCallback(
    (startIndex: number, direction: 1 | -1) => {
      if (visibleOptions.length === 0) return -1;
      for (let step = 1; step <= visibleOptions.length; step += 1) {
        const index = (startIndex + direction * step + visibleOptions.length) % visibleOptions.length;
        if (!visibleOptions[index].disabled) return index;
      }
      return -1;
    },
    [visibleOptions]
  );

  useEffect(() => {
    if (autoFocus) buttonRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (isOpen && searchable) searchRef.current?.focus();
    if (!isOpen) setSearch('');
  }, [isOpen, searchable]);

  useEffect(() => {
    listRef.current?.querySelectorAll('[role="option"]')[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

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
      const selectedIndex = visibleOptions.findIndex((opt) => opt.value === value && !opt.disabled);
      setHighlightedIndex(
        selectedIndex >= 0 ? selectedIndex : visibleOptions.findIndex((option) => !option.disabled)
      );
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, visibleOptions, value]);

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
    if ((e.target as HTMLElement).tagName === 'INPUT' && e.key === ' ') return;

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
          highlightedIndex < visibleOptions.length &&
          !visibleOptions[highlightedIndex].disabled
        ) {
          handleSelect(visibleOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
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
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } top-full mt-1.5 ${dropdownWidth} bg-mantle border border-surface0 rounded-md shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in duration-100 ${menuClassName}`}
        >
          {searchable && <div className="px-2 py-1 border-b border-surface0">
            <input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              aria-label={searchPlaceholder} placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 bg-base border border-surface1 text-xs text-text outline-none focus:border-brand" />
          </div>}
          <div ref={listRef} role="listbox" aria-labelledby={selectId} className="max-h-60 overflow-y-auto overscroll-contain">
          {visibleOptions.map((option, idx) => {
            const isSelected = option.value === value;
            const isHighlighted = idx === highlightedIndex;
            const previousOption = visibleOptions[idx - 1];
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
          {visibleOptions.length === 0 && <p className="px-3 py-3 text-xs text-subtext0">No matching options.</p>}
          </div>
          {matchingOptions.length > visibleOptions.length && <p className="px-3 py-2 border-t border-surface0 text-[10px] text-subtext0">Showing {visibleOptions.length} of {matchingOptions.length}. Search to narrow the list.</p>}
        </div>
      )}
    </div>
  );
}

export type { CustomSelectOption } from '../types/CustomSelectOption';
export type { CustomSelectProps } from '../types/CustomSelectProps';
