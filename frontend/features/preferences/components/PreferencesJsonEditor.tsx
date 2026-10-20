import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { isMacOS } from '../../../common/utils/shortcuts';
import { preferencesJsonService } from '../services/preferencesJsonService';
import { usePreferencesStore } from '../store/usePreferencesStore';
import type { PreferencesDocument } from '../types/PreferencesDocument';
import type { PreferencesJsonEditorProps } from '../types/PreferencesJsonEditorProps';
import type { PreferencesJsonEditorSaveState } from '../types/PreferencesJsonEditorSaveState';
import { highlightJsoncLine } from '../utils/highlightJsoncLine';
import { getPreferencesJsonCompletions, hidePreferencesSchemaProperty } from '../utils/preferencesJsonCompletions';

const PREFERENCES_SCHEMA_URI = 'https://stage0.app/schemas/preferences-v1.json';

export const PreferencesJsonEditor: React.FC<PreferencesJsonEditorProps> = ({ onClose }) => {
  const isMac = isMacOS();
  const [document, setDocument] = useState<PreferencesDocument | null>(null);
  const [draft, setDraft] = useState('');
  const [saveState, setSaveState] = useState<PreferencesJsonEditorSaveState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [activeLine, setActiveLine] = useState(0);
  const [completion, setCompletion] = useState<ReturnType<typeof getPreferencesJsonCompletions>>(null);
  const [completionIndex, setCompletionIndex] = useState(0);
  const savedTextRef = useRef('');
  const savingRef = useRef(false);
  const sourceRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const codeViewportRef = useRef<HTMLDivElement>(null);
  const pendingCursorRef = useRef<number | null>(null);
  const [pollKey, setPollKey] = useState(0);
  const [, setScrollRevision] = useState(0);
  const fontSettings = usePreferencesStore();
  const lineHeight = fontSettings.fontSize * fontSettings.lineSpacing;
  const lines = useMemo(() => draft.split('\n'), [draft]);
  const highlightedLines = useMemo(() => {
    let continuesBlockComment = false;
    return lines.map((line) => {
      const highlighted = highlightJsoncLine(line, continuesBlockComment);
      continuesBlockComment = highlighted.continuesBlockComment;
      return highlighted.segments;
    });
  }, [lines]);

  const fontStyle: React.CSSProperties = {
    fontFamily: 'var(--viewer-font-family)',
    fontSize: 'var(--viewer-font-size)',
    fontWeight: 'var(--viewer-font-weight)' as React.CSSProperties['fontWeight'],
    fontStyle: 'var(--viewer-font-style)' as React.CSSProperties['fontStyle'],
    textDecoration: 'var(--viewer-text-decoration)',
    lineHeight: `${lineHeight}px`,
    fontVariantLigatures: 'var(--viewer-font-ligatures)' as React.CSSProperties['fontVariantLigatures'],
    fontFeatureSettings: 'var(--viewer-font-features)',
  };

  const updateActiveLine = (source: HTMLTextAreaElement) => {
    setActiveLine(source.value.slice(0, source.selectionStart).split('\n').length - 1);
  };

  const syncScroll = (source: HTMLTextAreaElement) => {
    if (highlightRef.current) {
      highlightRef.current.style.transform = `translate(${-source.scrollLeft}px, ${-source.scrollTop}px)`;
    }
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-source.scrollTop}px)`;
    }
    if (completion) setScrollRevision((revision) => revision + 1);
  };

  const updateCompletion = (source: string, cursor: number, explicit = false) => {
    const next = getPreferencesJsonCompletions(source, cursor, explicit);
    setCompletion(next);
    setCompletionIndex(0);
  };

  const applyCompletion = (item: NonNullable<typeof completion>['items'][number]) => {
    const source = sourceRef.current?.value ?? draft;
    if (!completion) return;
    const nextDraft = source.slice(0, completion.replaceStart) + item.insertText + source.slice(completion.replaceEnd);
    const nextCursor = completion.replaceStart + item.insertText.length;
    pendingCursorRef.current = nextCursor;
    setDraft(nextDraft);
    setCompletion(null);
    setSaveState('saved');
    setError(null);
  };

  const completionPosition = (() => {
    if (!completion || !sourceRef.current || !codeViewportRef.current) return undefined;
    const source = sourceRef.current;
    const beforeCursor = source.value.slice(0, source.selectionStart);
    const line = beforeCursor.split('\n').length - 1;
    const column = beforeCursor.length - beforeCursor.lastIndexOf('\n') - 1;
    const bounds = codeViewportRef.current.getBoundingClientRect();
    const popupWidth = Math.min(340, bounds.width - 24);
    const charWidth = fontSettings.fontSize * 0.61;
    const left = Math.min(Math.max(12, 12 + column * charWidth - source.scrollLeft), Math.max(12, bounds.width - popupWidth - 8));
    const top = Math.min(
      Math.max(8, 12 + (line + 1) * lineHeight - source.scrollTop),
      Math.max(8, bounds.height - 216),
    );
    return { left, top, width: popupWidth };
  })();

  const acceptDocument = useCallback((next: PreferencesDocument) => {
    const content = hidePreferencesSchemaProperty(next.content);
    setDocument({ ...next, content });
    setDraft(content);
    savedTextRef.current = content;
    setSaveState(next.validationError ? 'invalid' : 'saved');
    setError(next.validationError ?? null);
    setPollKey((value) => value + 1);
  }, []);

  const reload = useCallback(async () => {
    setSaveState('loading');
    try { acceptDocument(await preferencesJsonService.load()); }
    catch (reason) {
      setSaveState('error');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [acceptDocument]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { sourceRef.current?.focus(); }, []);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (!document || savingRef.current || draft === savedTextRef.current) return true;
    savingRef.current = true;
    setSaveState('saving');
    setError(null);
    try {
      const saved = await preferencesJsonService.saveText(draft, document.revision);
      setDocument(saved);
      savedTextRef.current = draft;
      setSaveState('saved');
      setPollKey((value) => value + 1);
      return true;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      setSaveState(/changed outside|reload the latest/i.test(message) ? 'conflict' : /invalid jsonc|schema|missing required|secret value|too large/i.test(message) ? 'invalid' : 'error');
      return false;
    } finally { savingRef.current = false; }
  }, [document, draft]);

  useEffect(() => {
    if (!document || saveState === 'loading' || saveState === 'invalid' || saveState === 'conflict' || saveState === 'error' || draft === savedTextRef.current) return;
    const timer = window.setTimeout(() => { void saveNow(); }, 2000);
    setSaveState('saving');
    return () => window.clearTimeout(timer);
  }, [draft, document, saveNow, saveState]);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const latest = await preferencesJsonService.load();
        if (document && latest.revision !== document.revision) {
          if (draft === savedTextRef.current) acceptDocument(latest);
          else {
            setSaveState('conflict');
            setError('preferences.json changed outside Stage0. Reload the latest file to avoid overwriting those edits.');
          }
        }
      } catch { /* Preserve editor text; malformed external drafts are reported on save. */ }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [document, draft, acceptDocument, pollKey]);

  const handleClose = async () => {
    if (draft !== savedTextRef.current && !await saveNow()) return;
    onClose();
  };

  const handleRestoreDefaults = async () => {
    try { acceptDocument(await preferencesJsonService.reset()); }
    catch (reason) {
      setSaveState('error');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const source = event.currentTarget;
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      updateCompletion(source.value, source.selectionStart, true);
      return;
    }
    if (completion) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setCompletionIndex((index) => (index + direction + completion.items.length) % completion.items.length);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setCompletion(null);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && completion.items.length) {
        event.preventDefault();
        applyCompletion(completion.items[completionIndex] ?? completion.items[0]);
        return;
      }
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = source.selectionStart;
      const end = source.selectionEnd;
      const nextDraft = source.value.slice(0, start) + '  ' + source.value.slice(end);
      pendingCursorRef.current = start + 2;
      setDraft(nextDraft);
      setCompletion(null);
      setSaveState('saved');
      setError(null);
    }
  };

  useEffect(() => {
    const cursor = pendingCursorRef.current;
    if (cursor === null || !sourceRef.current) return;
    sourceRef.current.setSelectionRange(cursor, cursor);
    updateActiveLine(sourceRef.current);
    syncScroll(sourceRef.current);
    pendingCursorRef.current = null;
  }, [draft]);

  return createPortal(
    <section className="fixed inset-x-0 bottom-0 top-8.5 z-[90] flex min-h-0 flex-col bg-mantle text-text" aria-label="Edit preferences.json">
      <header className={`flex shrink-0 items-center justify-between border-b border-surface0 ${isMac ? 'pl-16 pr-4' : 'px-4'} py-3`}>
        <div>
          <h2 className="text-sm font-semibold">Edit in preferences.json</h2>
          <p className="mt-1 text-xs text-subtext0">JSONC · comments and trailing commas supported · Ctrl+Space for completions · autosaves after 2 seconds</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${saveState === 'invalid' || saveState === 'conflict' || saveState === 'error' ? 'text-red' : 'text-subtext0'}`} role="status">
            {saveState === 'loading' ? 'Loading…' : saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'invalid' ? 'Invalid draft' : saveState === 'conflict' ? 'Conflict' : 'Not saved'}
          </span>
          <button type="button" onClick={() => void handleClose()} className="rounded border border-surface1 px-3 py-1.5 text-xs hover:bg-surface0">Back to Preferences</button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="flex shrink-0 items-center justify-between gap-3 text-[11px] text-subtext0">
          <span className="truncate" title={document?.path}>{document?.path ?? 'Loading preferences file…'}</span>
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="preferences-json-schema" className="text-overlay1">Schema</label>
            <input id="preferences-json-schema" disabled value={PREFERENCES_SCHEMA_URI} className="w-[min(34vw,420px)] rounded border border-surface0 bg-crust px-2 py-1 text-[10px] text-overlay1 disabled:opacity-80" />
            {saveState === 'conflict' && <button type="button" onClick={() => void reload()} className="rounded border border-surface1 px-2 py-1 hover:bg-surface0">Reload latest</button>}
            <button type="button" onClick={() => void handleRestoreDefaults()} className="rounded border border-surface1 px-2 py-1 hover:bg-surface0">Restore defaults</button>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded border border-surface0 bg-crust focus-within:border-primary">
          <div aria-hidden="true" className="relative w-14 shrink-0 overflow-hidden border-r border-surface0 bg-mantle text-right text-overlay0 select-none" style={fontStyle}>
            <div ref={gutterRef} className="px-3 pt-3">
              {lines.map((_, index) => (
                <div key={index} className={index === activeLine ? 'text-text' : ''} style={{ height: `${lineHeight}px` }}>{index + 1}</div>
              ))}
            </div>
          </div>
          <div ref={codeViewportRef} className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <pre ref={highlightRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 m-0 min-h-full w-max min-w-full whitespace-pre px-3 py-3 text-text" style={fontStyle}>
              {highlightedLines.map((segments, index) => (
                <div key={index} className={index === activeLine ? 'bg-surface0/70' : ''} style={{ height: `${lineHeight}px` }}>
                  {segments.length ? segments.map((segment, segmentIndex) => (
                    <span key={segmentIndex} className={segment.className}>{segment.value}</span>
                  )) : '\u00a0'}
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
                const completionShortcut = (event.ctrlKey || event.metaKey) && event.code === 'Space';
                if (!completionShortcut && !['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape', 'Control', 'Meta', 'Shift'].includes(event.key)) {
                  updateCompletion(event.currentTarget.value, event.currentTarget.selectionStart);
                }
              }}
              onSelect={(event) => updateActiveLine(event.currentTarget)}
              onScroll={(event) => syncScroll(event.currentTarget)}
              spellCheck={false}
              aria-label="Preferences JSONC source"
              className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-3 text-transparent caret-primary outline-none selection:bg-primary/25"
              style={{ ...fontStyle, WebkitTextFillColor: 'transparent', tabSize: 2 }}
            />
            {completion && completionPosition && (
              <div
                role="listbox"
                aria-label="JSONC completions"
                className="absolute z-20 max-h-52 overflow-y-auto rounded border border-surface1 bg-mantle py-1 shadow-xl"
                style={completionPosition}
              >
                {completion.items.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    role="option"
                    aria-selected={index === completionIndex}
                    className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-xs ${index === completionIndex ? 'bg-surface0 text-text' : 'text-subtext1 hover:bg-surface0/70 hover:text-text'}`}
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
        {error && <p className="shrink-0 whitespace-pre-wrap text-xs text-red" role="alert">{error}</p>}
      </div>
    </section>,
    globalThis.document.body,
  );
};
