import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePreferencesStore } from '../store/usePreferencesStore';
import { highlightJsoncLine } from '../utils/highlightJsoncLine';
import { getPreferencesJsonCompletions } from '../utils/preferencesJsonCompletions';
import type { PreferencesJsonCodeBufferContext } from './PreferencesJsonCodeBufferContext';

export function usePreferencesJsonCodeBuffer({
  draft,
  setDraft,
  setSaveState,
  setError,
}: PreferencesJsonCodeBufferContext) {
  const [activeLine, setActiveLine] = useState(0);

  const [completion, setCompletion] =
    useState<ReturnType<typeof getPreferencesJsonCompletions>>(null);

  const [completionIndex, setCompletionIndex] = useState(0);

  const sourceRef = useRef<HTMLTextAreaElement>(null);

  const highlightRef = useRef<HTMLPreElement>(null);

  const gutterRef = useRef<HTMLDivElement>(null);

  const codeViewportRef = useRef<HTMLDivElement>(null);

  const pendingCursorRef = useRef<number | null>(null);

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
    fontVariantLigatures:
      'var(--viewer-font-ligatures)' as React.CSSProperties['fontVariantLigatures'],
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
    const nextDraft =
      source.slice(0, completion.replaceStart) +
      item.insertText +
      source.slice(completion.replaceEnd);
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
    const left = Math.min(
      Math.max(12, 12 + column * charWidth - source.scrollLeft),
      Math.max(12, bounds.width - popupWidth - 8)
    );
    const top = Math.min(
      Math.max(8, 12 + (line + 1) * lineHeight - source.scrollTop),
      Math.max(8, bounds.height - 216)
    );
    return { left, top, width: popupWidth };
  })();

  useEffect(() => {
    sourceRef.current?.focus();
  }, []);

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
        setCompletionIndex(
          (index) => (index + direction + completion.items.length) % completion.items.length
        );
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

  return {
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
  };
}
