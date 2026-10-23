import React from 'react';
import { createPortal } from 'react-dom';
import { isMacOS } from '../../../common/utils/shortcuts';
import type { PreferencesJsonEditorProps } from '../types/PreferencesJsonEditorProps';
import { PreferencesJsonEditorHeader } from './PreferencesJsonEditorHeader';
import { usePreferencesJsonCodeBuffer } from './usePreferencesJsonCodeBuffer';
import { usePreferencesJsonDocument } from './usePreferencesJsonDocument';

const PREFERENCES_SCHEMA_URI = 'https://stage0.app/schemas/preferences-v1.json';

export const PreferencesJsonEditor: React.FC<PreferencesJsonEditorProps> = ({ onClose }) => {
  const isMac = isMacOS();
  const {
    draft,
    setDraft,
    setSaveState,
    setError,
    saveState,
    handleClose,
    document,
    reload,
    handleRestoreDefaults,
    error,
  } = usePreferencesJsonDocument({ onClose });

  const {
    fontStyle,
    gutterRef,
    lines,
    activeLine,
    lineHeight,
    codeViewportRef,
    highlightRef,
    highlightedLines,
    sourceRef,
    updateActiveLine,
    updateCompletion,
    handleEditorKeyDown,
    syncScroll,
    completion,
    completionPosition,
    completionIndex,
    applyCompletion,
  } = usePreferencesJsonCodeBuffer({ draft, setDraft, setSaveState, setError });

  return createPortal(
    <section
      className="fixed inset-x-0 bottom-0 top-8.5 z-[90] flex min-h-0 flex-col bg-mantle text-text"
      aria-label="Edit preferences.json"
    >
      <PreferencesJsonEditorHeader isMac={isMac} saveState={saveState} handleClose={handleClose} />
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="flex shrink-0 items-center justify-between gap-3 text-[11px] text-subtext0">
          <span className="truncate" title={document?.path}>
            {document?.path ?? 'Loading preferences file…'}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="preferences-json-schema" className="text-overlay1">
              Schema
            </label>
            <input
              id="preferences-json-schema"
              disabled
              value={PREFERENCES_SCHEMA_URI}
              className="w-[min(34vw,420px)] rounded-sm border border-surface0 bg-crust px-2 py-1 text-[10px] text-overlay1 disabled:opacity-80"
            />
            {saveState === 'conflict' && (
              <button
                type="button"
                onClick={() => void reload()}
                className="border border-surface1 px-2 py-1 hover:bg-surface0 rounded-sm"
              >
                Reload latest
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleRestoreDefaults()}
              className="border border-surface1 px-2 py-1 hover:bg-surface0 rounded-sm"
            >
              Restore defaults
            </button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-sm border border-surface0 bg-crust focus-within:border-primary">
          <div
            aria-hidden="true"
            className="relative w-14 shrink-0 overflow-hidden border-r border-surface0 bg-mantle text-right text-overlay0 select-none"
            style={fontStyle}
          >
            <div ref={gutterRef} className="px-3 pt-3">
              {lines.map((_, index) => (
                <div
                  key={index}
                  className={index === activeLine ? 'text-text' : ''}
                  style={{ height: `${lineHeight}px` }}
                >
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
          <div ref={codeViewportRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <pre
              ref={highlightRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 m-0 min-h-full w-max min-w-full whitespace-pre px-3 py-3 text-text"
              style={fontStyle}
            >
              {highlightedLines.map((segments, index) => (
                <div
                  key={index}
                  className={index === activeLine ? 'bg-surface0/70' : ''}
                  style={{ height: `${lineHeight}px` }}
                >
                  {segments.length
                    ? segments.map((segment, segmentIndex) => (
                        <span key={segmentIndex} className={segment.className}>
                          {segment.value}
                        </span>
                      ))
                    : '\u00a0'}
                </div>
              ))}
            </pre>
            <textarea
              ref={sourceRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setSaveState('saved');
                setError(null);
                updateActiveLine(event.target);
                updateCompletion(event.target.value, event.target.selectionStart);
              }}
              onClick={(event) => {
                updateActiveLine(event.currentTarget);
                updateCompletion(event.currentTarget.value, event.currentTarget.selectionStart);
              }}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={(event) => {
                updateActiveLine(event.currentTarget);
                const completionShortcut =
                  (event.ctrlKey || event.metaKey) && event.code === 'Space';
                if (
                  !completionShortcut &&
                  ![
                    'ArrowDown',
                    'ArrowUp',
                    'Enter',
                    'Tab',
                    'Escape',
                    'Control',
                    'Meta',
                    'Shift',
                  ].includes(event.key)
                ) {
                  updateCompletion(event.currentTarget.value, event.currentTarget.selectionStart);
                }
              }}
              onSelect={(event) => updateActiveLine(event.currentTarget)}
              onScroll={(event) => syncScroll(event.currentTarget)}
              spellCheck={false}
              aria-label="Preferences JSONC source"
              className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-transparent caret-primary outline-none selection:bg-primary/25 rounded-sm"
              style={{ ...fontStyle, WebkitTextFillColor: 'transparent', tabSize: 2 }}
            />
            {completion && completionPosition && (
              <div
                role="listbox"
                aria-label="JSONC completions"
                className="absolute z-20 max-h-52 overflow-y-auto rounded-sm border border-surface1 bg-mantle py-1 shadow-xl"
                style={completionPosition}
              >
                {completion.items.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    role="option"
                    aria-selected={index === completionIndex}
                    className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-xs rounded-sm ${index === completionIndex ? 'bg-surface0 text-text' : 'text-subtext1 hover:bg-surface0/70 hover:text-text'}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyCompletion(item)}
                  >
                    <span className="font-mono">{item.label}</span>
                    <span className="shrink-0 text-[10px] text-overlay0">{item.detail}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {error && (
          <p className="shrink-0 whitespace-pre-wrap text-xs text-red" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>,
    globalThis.document.body
  );
};
