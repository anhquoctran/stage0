import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, ChevronDown, Search, Check, Globe } from 'lucide-react';

interface BranchSelectorProps {
  label: string;
  value: string;
  branches: {
    current: string;
    local: string[];
    remote: string[];
  } | null;
  onChange: (branch: string) => void;
  disabled?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  label,
  value,
  branches,
  onChange,
  disabled = false,
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled || !branches}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2.5 px-2.5 py-1 rounded-md border text-left transition-all ${
          disabled || !branches
            ? 'bg-mantle/50 border-surface0/50 text-subtext0 cursor-not-allowed'
            : 'bg-surface0 border-surface0 text-text hover:bg-surface1 hover:border-surface2 focus:outline-none focus:ring-1 focus:ring-blue/50 shadow-xs'
        }`}
      >
        <div className="min-w-0 max-w-[150px]">
          <span className="block text-[9px] font-bold uppercase tracking-wider text-subtext0 leading-tight">
            {label}
          </span>
          <div className="flex items-center gap-1.5 truncate mt-0.5">
            <GitBranch className="w-3.5 h-3.5 text-blue shrink-0" />
            <span className="truncate font-mono text-xs font-semibold text-text leading-none">
              {value || 'Select branch...'}
            </span>
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-subtext1 shrink-0 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-md shadow-2xl bg-mantle border border-surface0 z-50 overflow-hidden py-1 animate-in fade-in duration-100">
          <div className="p-2 border-b border-surface0 bg-base">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-subtext1" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Filter branches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1 bg-mantle border border-surface0 rounded text-xs text-text placeholder-subtext0 focus:outline-none focus:border-surface2"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-surface0">
            <div className="py-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext1 bg-mantle">
                Local Branches ({localBranches.length})
              </div>
              {localBranches.length === 0 ? (
                <div className="px-3 py-2 text-xs text-subtext0 italic">
                  No local branches match
                </div>
              ) : (
                localBranches.map((branch) => {
                  const isSelected = branch === value;
                  const isCurrent = branch === branches?.current;
                  return (
                    <button
                      key={`local-${branch}`}
                      onClick={() => {
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                        isSelected
                          ? 'bg-surface1 text-text font-semibold'
                          : 'text-text hover:bg-surface0'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5 font-mono">
                        <GitBranch className="w-3 h-3 text-subtext1 shrink-0" />
                        <span className="truncate">{branch}</span>
                        {isCurrent && (
                          <span className="text-[9px] px-1 py-0.2 bg-surface1 text-subtext1 border border-surface2 rounded font-sans">
                            HEAD
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-text shrink-0 ml-1" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {remoteBranches.length > 0 && (
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-subtext1 bg-mantle flex items-center gap-1">
                  <Globe className="w-3 h-3 text-subtext1" />
                  <span>Remote Branches ({remoteBranches.length})</span>
                </div>
                {remoteBranches.map((branch) => {
                  const isSelected = branch === value;
                  return (
                    <button
                      key={`remote-${branch}`}
                      onClick={() => {
                        onChange(branch);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                        isSelected
                          ? 'bg-surface1 text-text font-semibold'
                          : 'text-subtext1 hover:bg-surface0 hover:text-text'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-subtext0">origin/</span>
                        <span className="truncate">
                          {branch.replace(/^origin\//, '')}
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-text shrink-0 ml-1" />
                      )}
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
