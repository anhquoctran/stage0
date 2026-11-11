import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../../i18n/i18n';
import { preferencesJsonService } from '../services/preferencesJsonService';
import type { JsonEditorDocument } from '../types/JsonEditorDocument';
import type { PreferencesJsonEditorSaveState } from '../types/PreferencesJsonEditorSaveState';
import { hidePreferencesSchemaProperty } from '../utils/preferencesJsonCompletions';
import type { PreferencesJsonDocumentContext } from './PreferencesJsonDocumentContext';

export function usePreferencesJsonDocument({ onClose, adapter, conflictMessage }: PreferencesJsonDocumentContext) {
  const service = adapter ?? preferencesJsonService;
  const [document, setDocument] = useState<JsonEditorDocument | null>(null);
  const [draft, setDraft] = useState('');
  const [saveState, setSaveState] = useState<PreferencesJsonEditorSaveState>('loading');
  const [error, setError] = useState<string | null>(null);
  const savedTextRef = useRef('');
  const documentRef = useRef<JsonEditorDocument | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savingRef = useRef<Promise<boolean> | null>(null);
  const [pollKey, setPollKey] = useState(0);

  const acceptDocument = useCallback((next: JsonEditorDocument) => {
    const content = adapter ? next.content : hidePreferencesSchemaProperty(next.content);
    const accepted = { ...next, content };
    documentRef.current = accepted;
    setDocument(accepted);
    setDraft(content);
    draftRef.current = content;
    savedTextRef.current = content;
    setSaveState(next.validationError ? 'invalid' : 'saved');
    setError(next.validationError ?? null);
    setPollKey((value) => value + 1);
  }, [adapter]);

  const reload = useCallback(async () => {
    setSaveState('loading');
    try { acceptDocument(await service.load()); }
    catch (reason) {
      setSaveState('error');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [acceptDocument, service]);

  useEffect(() => { void reload(); }, [reload]);

  const saveNow = useCallback(async (): Promise<boolean> => {
    // Closing while autosave is pending must await it, then save any newer text.
    while (savingRef.current) {
      if (!(await savingRef.current)) return false;
    }
    const before = documentRef.current;
    const text = draftRef.current;
    if (!before) return false;
    if (text === savedTextRef.current) return true;
    setSaveState('saving');
    setError(null);
    const pending = (async () => {
      try {
        const saved = await service.saveText(text, before.revision);
        const acknowledged = adapter ? saved.content : hidePreferencesSchemaProperty(saved.content);
        if (acknowledged !== text) {
          // A newer publication may supersede the acknowledgement in transit.
          // Keep the old revision so Close cannot silently rebase this draft.
          setSaveState('conflict');
          setError(conflictMessage ?? i18n.t('preferences.jsonEditor.changedOutside'));
          return false;
        }
        documentRef.current = saved;
        setDocument(saved);
        savedTextRef.current = text;
        setSaveState('saved');
        setPollKey((value) => value + 1);
        return true;
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : String(reason);
        setError(message);
        setSaveState(/changed outside|reload the latest|reload before/i.test(message)
          ? 'conflict' : /invalid|schema|required|secret|too large|duplicate|unknown field|must be|exceeds/i.test(message)
            ? 'invalid' : 'error');
        return false;
      }
    })();
    savingRef.current = pending;
    try { return await pending; }
    finally { if (savingRef.current === pending) savingRef.current = null; }
  }, [service, adapter, conflictMessage]);

  useEffect(() => {
    if (!document || ['loading', 'invalid', 'conflict', 'error'].includes(saveState) || draft === savedTextRef.current) return;
    const timer = window.setTimeout(() => { void saveNow(); }, 2000);
    setSaveState('saving');
    return () => window.clearTimeout(timer);
  }, [draft, document, saveNow, saveState]);

  useEffect(() => {
    let active = true;
    const timer = window.setInterval(async () => {
      if (savingRef.current) return;
      try {
        const observed = documentRef.current;
        const latest = await service.load();
        if (!active || savingRef.current || documentRef.current !== observed) return;
        if (observed && latest.revision !== observed.revision) {
          if (draftRef.current === savedTextRef.current) acceptDocument(latest);
          else {
            setSaveState('conflict');
            setError(conflictMessage ?? i18n.t('preferences.jsonEditor.changedOutside'));
          }
        }
      } catch { /* Keep the draft; read/save errors never overwrite its text. */ }
    }, 2500);
    return () => { active = false; window.clearInterval(timer); };
  }, [acceptDocument, service, pollKey, conflictMessage]);

  const handleClose = async () => {
    if ((savingRef.current || draftRef.current !== savedTextRef.current) && !(await saveNow())) return;
    onClose();
  };
  const handleRestoreDefaults = async () => {
    try { if (service.reset) acceptDocument(await service.reset()); }
    catch (reason) {
      setSaveState('error'); setError(reason instanceof Error ? reason.message : String(reason));
    }
  };
  return { draft, setDraft, setSaveState, setError, saveState, handleClose,
    document, reload, handleRestoreDefaults, error };
}
