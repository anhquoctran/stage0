import { useTranslation as useUiTextTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { FileJson } from '../../../common/components/icons/FileJson';
import { X } from '../../../common/components/icons/X';
import { Check } from '../../../common/components/icons/Check';
import { Copy } from '../../../common/components/icons/Copy';
import { CheckCircle2 } from '../../../common/components/icons/CheckCircle2';
import { AlertCircle } from '../../../common/components/icons/AlertCircle';

export const McpJsonModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  exportMcpConfigFile: () => string;
  importMcpConfigFile: (content: string) => { success: boolean; count: number; error?: string };
}> = ({ isOpen, onClose, exportMcpConfigFile, importMcpConfigFile }) => {
  const { t: translateUiText } = useUiTextTranslation();
  const [jsonTab, setJsonTab] = useState<'export' | 'import'>('export');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonFeedback, setJsonFeedback] = useState<{ success?: boolean; text: string } | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  if (!isOpen) return null;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(exportMcpConfigFile());
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleImportJson = () => {
    if (!jsonInput.trim()) {
      setJsonFeedback({ success: false, text: translateUiText('ai.mcpJson.enterJson') });
      return;
    }
    const result = importMcpConfigFile(jsonInput.trim());
    if (result.success) {
      setJsonFeedback({
        success: true,
        text: translateUiText('ai.mcpJson.importSuccess', { count: result.count || 0 }),
      });
      setTimeout(() => {
        onClose();
        setJsonFeedback(null);
        setJsonInput('');
      }, 1200);
    } else {
      setJsonFeedback({ success: false, text: result.error || translateUiText('ai.mcpJson.importFailed') });
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 top-8.5 z-60 bg-[var(--backdrop-modal)] backdrop-blur-xs flex items-center justify-center p-4 rounded-sm">
      <div className="bg-mantle border border-surface0 w-full max-w-2xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150 rounded-sm">
        <div
          data-tauri-drag-region
          className="flex items-center justify-between pb-2 border-b border-surface0 cursor-default"
        >
          <div data-tauri-drag-region className="flex items-center gap-2 pointer-events-none">
            <FileJson className="w-4 h-4 text-subtext0" />
            <h4 className="text-sm font-bold text-text">{translateUiText('ai.mcpJson.title')}</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-subtext0 hover:text-text cursor-pointer rounded-sm"
            aria-label={translateUiText('common.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tab: Export vs Import */}
        <div className="flex items-center gap-2 border-b border-surface0 pb-2 rounded-sm">
          <button
            type="button"
            onClick={() => {
              setJsonTab('export');
              setJsonFeedback(null);
            }}
            className={`px-3 py-1.5 text-xs font-semibold cursor-pointer border rounded-sm ${
              jsonTab === 'export'
                ? 'bg-surface1 border-surface2 text-text'
                : 'border-transparent text-subtext0 hover:text-text'
            }`}
          >
            {translateUiText('ai.mcpJson.exportTab')}
          </button>
          <button
            type="button"
            onClick={() => {
              setJsonTab('import');
              setJsonFeedback(null);
            }}
            className={`px-3 py-1.5 text-xs font-semibold cursor-pointer border rounded-sm ${
              jsonTab === 'import'
                ? 'bg-surface1 border-surface2 text-text'
                : 'border-transparent text-subtext0 hover:text-text'
            }`}
          >
            {translateUiText('ai.mcpJson.importTab')}
          </button>
        </div>

        {jsonTab === 'export' ? (
          <div className="space-y-3">
            <p className="text-[11px] text-subtext0">
              {translateUiText('ai.mcpJson.exportInstructionsBefore')} <code>claude_desktop_config.json</code> {translateUiText('ai.mcpJson.exportInstructionsAfter')}
            </p>
            <pre className="p-3 bg-base border border-surface0 text-xs font-mono overflow-auto max-h-60 text-text select-all">
              {exportMcpConfigFile()}
            </pre>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer border border-surface2 shadow-xs rounded-sm"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-text" />
                    <span className="text-text">{translateUiText('ai.mcpJson.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{translateUiText('ai.mcpJson.copyJson')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-subtext0">
              {translateUiText('ai.mcpJson.importInstructionsBefore')} <code>{`{ "mcpServers": { ... } }`}</code> {translateUiText('ai.mcpJson.importInstructionsAfter')}
            </p>
            <textarea
              rows={8}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`{\n  "mcpServers": {\n    "filesystem": {\n      "command": "npx",\n      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]\n    }\n  }\n}`}
              className="w-full p-3 bg-base border border-surface1 text-xs text-text font-mono placeholder:text-subtext0 focus:outline-none focus:border-surface2 rounded-sm"
            />

            {jsonFeedback && (
              <div
                className={`p-2.5 border text-xs flex items-center gap-2 rounded-sm ${
                  jsonFeedback.success
                    ? 'bg-surface1 border-surface2 text-text'
                    : 'bg-surface1 border-surface2 text-subtext0'
                }`}
              >
                {jsonFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{jsonFeedback.text}</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-surface1 hover:bg-surface1 text-subtext0 hover:text-text text-xs transition-colors cursor-pointer rounded-sm"
              >
                {translateUiText('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-surface1 hover:bg-surface2 text-text text-xs font-semibold transition-colors cursor-pointer border border-surface2 shadow-xs rounded-sm"
              >
                <Check className="w-3.5 h-3.5 text-text" />
                <span>{translateUiText('ai.mcpJson.importConfig')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

