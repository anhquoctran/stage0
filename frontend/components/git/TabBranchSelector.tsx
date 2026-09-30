import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, ChevronDown, Search, Check, Globe } from 'lucide-react';

interface TabBranchSelectorProps {
  value: string;
  roleType: 'source' | 'target'; // 'source' = Compare, 'target' = Base
  branches: {
    current: string;
    local: string[];
    remote: string[];
  } | null;
  onChange: (branch: string) => void;
  disabled?: boolean;
  className?: string;
  maxWidthClass?: string;
  buttonClassName?: string;
}

export const TabBranchSelector: React.FC<TabBranchSelectorProps> = ({
  value,
  roleType,
  branches,
  onChange,
  disabled = false,
  className,
  maxWidthClass,
  buttonClassName,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
  const roleLabel = isSource ? 'Compare (Source)' : 'Base (Target)';

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
        title={`${roleLabel}: ${value || 'Select branch'}`}
        className={`inline-flex items-center gap-2 px-2.5 py-1 text-left transition-colors min-w-[110px] border ${
          maxWidthClass || 'max-w-[360px]'
        } ${
          disabled || !branches
            ? 'bg-surface0/40 border-surface0/60 text-subtext0/50 cursor-not-allowed'
            : 'bg-base/70 hover:bg-surface0 border-surface0 hover:border-surface1 text-text cursor-pointer'
        } ${buttonClassName || ''}`}
      >
        <GitBranch className="w-3.5 h-3.5 shrink-0 text-brand" />
        <span className="truncate font-mono text-xs font-medium text-text leading-tight">
          {value || (isSource ? 'compare...' : 'base...')}
        </span>
        <ChevronDown className="w-3 h-3 text-subtext0 shrink-0 ml-auto opacity-75" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 min-w-[280px] w-max max-w-sm shadow-2xl bg-mantle border border-surface0 z-[120] overflow-hidden py-1 animate-in fade-in duration-100 text-left">
          {/* Header indicator */}
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-subtext0 bg-base/60 border-b border-surface0/60 flex items-center justify-between">
            <span>{roleLabel}</span>
            <span className="font-mono text-[9px] text-brand lowercase">MR branch</span>
          </div>

          {/* Search box */}
          <div className="p-2 bg-base/40 border-b border-surface0/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-subtext0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Filter branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-mantle border border-surface0 text-xs text-text placeholder-subtext0 focus:outline-none focus:border-brand font-mono"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-surface0/60">
            {/* Local Branches */}
            <div className="py-1">
              <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-subtext0 bg-mantle flex items-center gap-1.5">
                <GitBranch className="w-3 h-3 text-brand" />
                <span>Local Branches ({localBranches.length})</span>
              </div>
              {localBranches.length === 0 ? (
                <div className="px-3 py-1.5 text-xs text-subtext0 italic">No local branches found</div>
              ) : (
                localBranches.map((branch) => {
                  const isSelected = branch === value;
                  const isCurrent = branch === branches?.current;
                  return (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => {
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono transition-colors text-left cursor-pointer ${
                        isSelected
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'hover:bg-surface0 text-text'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate pr-2">
                        <span className="truncate">{branch}</span>
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
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-subtext0 bg-mantle flex items-center gap-1.5">
                  <Globe className="w-3 h-3 text-subtext0" />
                  <span>Remote Branches ({remoteBranches.length})</span>
                </div>
                {remoteBranches.map((branch) => {
                  const isSelected = branch === value;
                  return (
                    <button
                      key={branch}
                      type="button"
                      onClick={() => {
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-mono transition-colors text-left cursor-pointer ${
                        isSelected
                          ? 'bg-brand/10 text-brand font-medium'
                          : 'hover:bg-surface0 text-text'
                      }`}
                    >
                      <span className="truncate pr-2">{branch}</span>
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
