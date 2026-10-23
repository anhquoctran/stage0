import React from 'react';
import { ChevronLeft } from '../../../common/components/icons/ChevronLeft';

export const AiMcpTabHeader: React.FC<{
  activeView?: 'providers' | 'mcp' | 'prompts';
  activeSubTab: 'ai' | 'mcp' | 'prompts' | 'guardrails';
  onBackToOverview?: () => void;
  onSelectSubTab: (tab: 'ai' | 'mcp' | 'prompts') => void;
  activeProviderName: string;
  activeModel: string;
  enabledMcpCount: number;
  totalMcpCount: number;
}> = ({
  activeView,
  activeSubTab,
  onBackToOverview,
  onSelectSubTab,
  activeProviderName,
  activeModel,
  enabledMcpCount,
  totalMcpCount,
}) => {
  return (
    <>
      {onBackToOverview && (
        <div className="flex items-center gap-2 pb-1 border-b border-surface0/40 rounded-sm">
          <button
            type="button"
            onClick={onBackToOverview}
            className="inline-flex items-center gap-1 text-xs text-subtext0 hover:text-text transition-colors cursor-pointer group rounded-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>AI Overview</span>
          </button>
          <span className="text-xs text-surface2 font-mono">/</span>
          <span className="text-xs font-semibold text-text">
            {activeView === 'mcp' ? 'MCP Servers' : 'LLM Providers'}
          </span>
        </div>
      )}

      {/* Standalone Header & Sub-Navigation (only when not embedded inside a specific view) */}
      {!activeView && (
        <div className="flex flex-col gap-3 pb-3 border-b border-surface0 rounded-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-text">
                AI & Model Context Protocol (MCP)
              </h3>
              <p className="text-[11px] text-subtext0 mt-0.5">
                Configure LLM intelligence, automated diff reviewer, and Model Context Protocol servers
              </p>
            </div>
            <span className="text-[10px] text-subtext0 font-mono px-2 py-0.5 bg-surface0 border border-surface1">
              Active: {activeProviderName} • {activeModel}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-1 border-t border-surface0/60 rounded-sm">
            <button
              type="button"
              onClick={() => onSelectSubTab('ai')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border rounded-sm ${
                activeSubTab === 'ai' || activeSubTab === 'guardrails'
                  ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                  : 'border-transparent text-subtext0 hover:bg-surface0 hover:text-text'
              }`}
            >
              <span>AI Model & Security Policies</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSubTab('mcp')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border rounded-sm ${
                activeSubTab === 'mcp'
                  ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                  : 'border-transparent text-subtext0 hover:bg-surface0 hover:text-text'
              }`}
            >
              <span>MCP Servers</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-base border border-surface2 font-mono">
                {enabledMcpCount}/{totalMcpCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onSelectSubTab('prompts')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border rounded-sm ${
                activeSubTab === 'prompts'
                  ? 'bg-surface1 border-surface2 text-text shadow-xs ring-1 ring-surface2'
                  : 'border-transparent text-subtext0 hover:bg-surface0 hover:text-text'
              }`}
            >
              <span>Stage0 System Prompts</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

