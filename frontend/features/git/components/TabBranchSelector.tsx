import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GitBranch } from '../../../common/components/icons/GitBranch';
import { ChevronDown } from '../../../common/components/icons/ChevronDown';
import { Search } from '../../../common/components/icons/Search';
import { Check } from '../../../common/components/icons/Check';
import { Globe } from '../../../common/components/icons/Globe';
import type { TabBranchSelectorProps } from '../types/TabBranchSelectorProps';
import { useOutsideDismiss } from '../../../common/hooks/useOutsideDismiss';

export const TabBranchSelector: React.FC<TabBranchSelectorProps> = ({
  value,
  roleType,
  branches,
  onChange,
  disabled = false,
  title,
  className,
  maxWidthClass,
  buttonClassName,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useOutsideDismiss(dropdownRef, isOpen, () => setIsOpen(false));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const localBranches = (branches?.local || []).filter((b) =>
    b.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const remoteBranches = (branches?.remote || []).filter((b) =>
    b.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isSource = roleType === 'source';
  const roleLabel = isSource ? t('git.branchSelector.compareSource') : t('git.branchSelector.baseTarget');

  return (
    <div
      className={`relative inline-flex items-center ${className || ''}`}
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || !branches}
        onClick={() => setIsOpen(!isOpen)}
        title={title || `${roleLabel}: ${value || t('git.branchSelector.selectBranch')}`}
        className={`inline-flex items-center gap-2 px-2.5 py-1 text-start transition-colors min-w-[110px] border rounded-sm ${
          maxWidthClass || 'max-w-[360px]'
        } ${
          disabled || !branches
            ? 'bg-surface0/40 border-surface0/60 text-subtext0/50 cursor-not-allowed'
            : 'bg-base/70 hover:bg-surface0 border-surface0 hover:border-surface1 text-text cursor-pointer'
        } ${buttonClassName || ''}`}
      >
        <GitBranch className={`w-3.5 h-3.5 shrink-0 ${disabled || !branches ? 'text-subtext0' : 'text-brand'}`} />
        <span dir="ltr" className="truncate font-mono text-xs font-medium text-text leading-tight">
          {value || (isSource ? 'compare...' : 'base...')}
        </span>
        <ChevronDown className="w-3 h-3 text-subtext0 shrink-0 ms-auto opacity-75" />
      </button>

      {isOpen && (
        <div className="absolute start-0 top-full mt-1 min-w-[280px] w-max max-w-sm shadow-2xl bg-mantle border border-surface0 z-[120] overflow-hidden py-1 animate-in fade-in duration-100 text-start rounded-sm">
          {/* Header indicator */}
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext0 bg-base/60 border-b border-surface0/60 flex items-center justify-between rounded-sm">
            <span>{roleLabel}</span>
            <span className="font-mono text-[9px] text-brand lowercase">{t('git.branchSelector.mrBranch')}</span>
          </div>

          {/* Search box */}
          <div className="p-2 bg-base/40 border-b border-surface0/60 rounded-sm">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-subtext0" />
              <input
                ref={inputRef}
                type="text"
                dir="ltr"
                placeholder={t('git.branchSelector.filterBranches')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full ps-8 pe-2.5 py-1 bg-mantle border border-surface0 text-xs text-text placeholder-subtext0 focus:outline-none focus:border-brand font-mono rounded-sm"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-surface0/60">
            {/* Local Branches */}
            <div className="py-1">
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-subtext0 bg-mantle flex items-center gap-1.5 rounded-sm">
                <GitBranch className="w-3 h-3 text-brand" />
                <span>{t('git.branchSelector.localBranches', { count: localBranches.length })}</span>
              </div>
              {localBranches.length === 0 ? (
                <div className="px-3 py-1.5 text-xs text-subtext0 italic">{t('git.branchSelector.noBranchesFound')}</div>
              ) : (
                localBranches.map((branch) => {
                  const isSelected = branch === value;
                  const isCurrent = branch === branches?.current;
                  return (
                    <button
                      key={branch}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      onClick={() => {
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono transition-colors text-start cursor-pointer rounded-sm ${
                        isSelected
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'hover:bg-surface0 text-text'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate pe-2">
                        <span dir="ltr" className="truncate">{branch}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 bg-surface0 border border-surface1/60 text-subtext0 font-sans">
                            HEAD
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Remote Branches */}
            {remoteBranches.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-subtext0 bg-mantle flex items-center gap-1.5 rounded-sm">
                  <Globe className="w-3 h-3 text-subtext0" />
                <span>{t('git.branchSelector.remoteBranches', { count: remoteBranches.length })}</span>
                </div>
                {remoteBranches.map((branch) => {
                  const isSelected = branch === value;
                  return (
                    <button
                      key={branch}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      onClick={() => {
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono transition-colors text-start cursor-pointer rounded-sm ${
                        isSelected
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'hover:bg-surface0 text-text'
                      }`}
                    >
                      <span dir="ltr" className="truncate pe-2">{branch}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
