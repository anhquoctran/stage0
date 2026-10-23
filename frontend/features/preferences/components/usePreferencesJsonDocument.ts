import { useCallback, useEffect, useRef, useState } from 'react';
import { preferencesJsonService } from '../services/preferencesJsonService';
import type { PreferencesDocument } from '../types/PreferencesDocument';
import type { PreferencesJsonEditorSaveState } from '../types/PreferencesJsonEditorSaveState';
import { hidePreferencesSchemaProperty } from '../utils/preferencesJsonCompletions';
import type { PreferencesJsonDocumentContext } from './PreferencesJsonDocumentContext';

export function usePreferencesJsonDocument({ onClose }: PreferencesJsonDocumentContext) {
  const [document, setDocument] = useState<PreferencesDocument | null>(null);

  const [draft, setDraft] = useState('');

  const [saveState, setSaveState] = useState<PreferencesJsonEditorSaveState>('loading');

  const [error, setError] = useState<string | null>(null);

  const savedTextRef = useRef('');

  const savingRef = useRef(false);

  const [pollKey, setPollKey] = useState(0);

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
    try {
      acceptDocument(await preferencesJsonService.load());
    } catch (reason) {
      setSaveState('error');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [acceptDocument]);

  useEffect(() => {
    void reload();
  }, [reload]);

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
      setSaveState(
        /changed outside|reload the latest/i.test(message)
          ? 'conflict'
          : /invalid jsonc|schema|missing required|secret value|too large/i.test(message)
            ? 'invalid'
            : 'error'
      );
      return false;
    } finally {
      savingRef.current = false;
    }
  }, [document, draft]);

  useEffect(() => {
    if (
      !document ||
      saveState === 'loading' ||
      saveState === 'invalid' ||
      saveState === 'conflict' ||
      saveState === 'error' ||
      draft === savedTextRef.current
    )
      return;
    const timer = window.setTimeout(() => {
      void saveNow();
    }, 2000);
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
            setError(
              'preferences.json changed outside Stage0. Reload the latest file to avoid overwriting those edits.'
            );
          }
        }
      } catch {
        /* Preserve editor text; malformed external drafts are reported on save. */
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [document, draft, acceptDocument, pollKey]);

  const handleClose = async () => {
    if (draft !== savedTextRef.current && !(await saveNow())) return;
    onClose();
  };

  const handleRestoreDefaults = async () => {
    try {
      acceptDocument(await preferencesJsonService.reset());
    } catch (reason) {
      setSaveState('error');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  return {
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
  };
}
