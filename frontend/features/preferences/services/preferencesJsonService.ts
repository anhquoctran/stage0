import { invoke, isTauri } from '@tauri-apps/api/core';
import type { PreferencesDocument } from '../types/PreferencesDocument';
import type { PreferenceBootstrap } from '../types/PreferenceBootstrap';

export class PreferencesJsonService {
  private writeQueue: Promise<unknown> = Promise.resolve();

  async load(): Promise<PreferencesDocument> {
    if (!isTauri()) {
      const content = JSON.stringify(window.__STAGE0_PREFERENCES__ ?? {}, null, 2);
      return { content, revision: window.__STAGE0_PREFERENCES_REVISION__ ?? 'web', path: 'browser storage', migrated: false };
    }
    const document = await invoke<PreferencesDocument>('load_preferences_json');
    this.accept(document);
    return document;
  }

  saveText(content: string, expectedRevision: string): Promise<PreferencesDocument> {
    return this.enqueue(async () => {
      if (!isTauri()) {
        const parsed = JSON.parse(content) as PreferenceBootstrap;
        window.__STAGE0_PREFERENCES__ = parsed;
        const revision = `web-${Date.now()}`;
        window.__STAGE0_PREFERENCES_REVISION__ = revision;
        return { content, revision, path: 'browser storage', migrated: false };
      }
      const document = await invoke<PreferencesDocument>('save_preferences_json', { content, expectedRevision });
      this.accept(document);
      return document;
    });
  }

  patch(patch: Record<string, unknown>): Promise<PreferencesDocument> {
    return this.enqueue(async () => {
      if (!isTauri()) {
        const current = window.__STAGE0_PREFERENCES__ ?? {};
        const next = merge(current as Record<string, unknown>, patch) as PreferenceBootstrap;
        window.__STAGE0_PREFERENCES__ = next;
        const content = JSON.stringify(next, null, 2);
        const revision = `web-${Date.now()}`;
        window.__STAGE0_PREFERENCES_REVISION__ = revision;
        return { content, revision, path: 'browser storage', migrated: false };
      }
      const expectedRevision = window.__STAGE0_PREFERENCES_REVISION__;
      if (!expectedRevision) throw new Error('Preferences are not initialized yet.');
      const baseline = structuredClone(window.__STAGE0_PREFERENCES__ ?? {});
      let document: PreferencesDocument;
      try {
        document = await invoke<PreferencesDocument>('patch_preferences', { patch, expectedRevision });
      } catch (error) {
        if (!/changed outside/i.test(String(error))) throw error;
        const latest = await invoke<PreferencesDocument>('load_preferences_json');
        if (latest.validationError) {
          this.accept(latest);
          throw new Error('preferences.json is invalid. Fix or restore the file before applying Preferences.');
        }
        const latestSettings = latest.settings ?? JSON.parse(latest.content) as PreferenceBootstrap;
        if (patchConflictsWithChanges(baseline, latestSettings, patch)) {
          this.accept(latest);
          throw new Error('These preferences changed in another Stage0 window or editor. Reload and review the conflicting values before applying.');
        }
        this.accept(latest);
        document = await invoke<PreferencesDocument>('patch_preferences', { patch, expectedRevision: latest.revision });
      }
      this.accept(document);
      return document;
    });
  }

  async reset(): Promise<PreferencesDocument> {
    if (!isTauri()) throw new Error('Resetting preferences requires the native Stage0 app.');
    return this.enqueue(async () => {
      const document = await invoke<PreferencesDocument>('reset_preferences_json');
      this.accept(document);
      return document;
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation, operation);
    this.writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  private accept(document: PreferencesDocument): void {
    window.__STAGE0_PREFERENCES_REVISION__ = document.revision;
    window.__STAGE0_PREFERENCES_PATH__ = document.path;
    if (document.settings) window.__STAGE0_PREFERENCES__ = document.settings;
    else {
      try { window.__STAGE0_PREFERENCES__ = JSON.parse(document.content) as PreferenceBootstrap; }
      catch { /* Invalid JSONC is intentionally kept as an editor-only draft. */ }
    }
    if (document.settings) {
      window.dispatchEvent(new CustomEvent('stage0-preferences-updated', { detail: document.settings }));
    }
  }
}

function patchConflictsWithChanges(
  baseline: Record<string, unknown>,
  latest: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  for (const [key, patchValue] of Object.entries(patch)) {
    const before = baseline[key];
    const current = latest[key];
    if (isObject(patchValue)) {
      if ((before === undefined || isObject(before)) && (current === undefined || isObject(current))) {
        if (patchConflictsWithChanges(
          isObject(before) ? before : {},
          isObject(current) ? current : {},
          patchValue,
        )) return true;
        continue;
      }
    }
    if (JSON.stringify(before) !== JSON.stringify(current)) return true;
  }
  return false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export const preferencesJsonService = new PreferencesJsonService();

function merge(target: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const output = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    if (isDeleteMarker(value)) {
      delete output[key];
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value) && output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) {
      output[key] = merge(output[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else output[key] = value;
  }
  return output;
}

function isDeleteMarker(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 1 && (value as Record<string, unknown>).$stage0Delete === true;
}
