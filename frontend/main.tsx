import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-sans/300.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/400-italic.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/600-italic.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-sans/700-italic.css';
import '@fontsource/fira-code/300.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
import '@fontsource/fira-code/600.css';
import '@fontsource/fira-code/700.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { invoke, isTauri } from '@tauri-apps/api/core';
import type { PreferenceBootstrap } from './features/preferences/types/PreferenceBootstrap';
import type { PreferencesDocument } from './features/preferences/types/PreferencesDocument';
import { isLikelySecretMcpEnvValue, isSecretMcpEnvName } from './features/ai/utils/listSecretMcpEnv';
import './core/styles/index.css';

const LEGACY_KEYS = [
  'stage0_catppuccin_theme_mode', 'stage0_catppuccin_theme',
  'stage0_viewer_font_settings', 'stage0_show_inline_blame',
  'stage0_ai_mcp_config', 'stage0_global_bot_reviewers',
  'stage0_notification_settings',
];

function readLegacyJson(key: string): unknown {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : undefined; }
  catch { return undefined; }
}

function collectLegacyMcpSecrets(value: unknown): Record<string, Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const servers = (value as Record<string, unknown>).mcpServers;
  if (!Array.isArray(servers)) return {};
  const secrets: Record<string, Record<string, string>> = {};
  for (const server of servers) {
    if (!server || typeof server !== 'object' || Array.isArray(server)) continue;
    const record = server as Record<string, unknown>;
    if (typeof record.id !== 'string' || !record.id) continue;
    if (!record.env || typeof record.env !== 'object' || Array.isArray(record.env)) continue;
    for (const [name, value] of Object.entries(record.env as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim() && (isSecretMcpEnvName(name) || isLikelySecretMcpEnvValue(value))) {
        secrets[record.id] ??= {};
        secrets[record.id][name] = value.trim();
      }
    }
  }
  return secrets;
}

function removeMigratedLegacyStorage(legacyRawAi: Record<string, unknown> | undefined, preserveAiConfig: boolean) {
  for (const key of LEGACY_KEYS) {
    if (key === 'stage0_ai_mcp_config' && preserveAiConfig) continue;
    localStorage.removeItem(key);
  }
  if (preserveAiConfig && legacyRawAi) {
    const aiConfig = legacyRawAi.aiConfig && typeof legacyRawAi.aiConfig === 'object'
      ? { ...(legacyRawAi.aiConfig as Record<string, unknown>), apiKey: '' }
      : legacyRawAi.aiConfig;
    localStorage.setItem('stage0_ai_mcp_config', JSON.stringify({ ...legacyRawAi, aiConfig }));
  }
}

function buildLegacyPreferences(): PreferenceBootstrap {
  const oldAi = readLegacyJson('stage0_ai_mcp_config') as Record<string, unknown> | undefined;
  const oldAiConfig = oldAi?.aiConfig as Record<string, unknown> | undefined;
  const legacyPrompt = oldAiConfig?.systemPrompt;
  const defaultLegacyPrompt = `You are an expert software engineer and code reviewer embedded in Stage0 Git Reviewer.
When reviewing git diffs:
1. Identify logic flaws, subtle edge cases, concurrency hazards, and security issues.
2. Recommend idiomatic, performant patterns conforming to the language standard.
3. Be clear, constructive, and concise. Avoid superfluous praise.
4. Format markdown with code blocks, line references, and actionable improvements.`;
  const migratedAi = oldAi && typeof oldAi === 'object' ? structuredClone(oldAi) : {};
  const migratedAiConfig = migratedAi.aiConfig && typeof migratedAi.aiConfig === 'object'
    ? migratedAi.aiConfig as Record<string, unknown>
    : {};
  if (typeof legacyPrompt === 'string' && legacyPrompt.trim() && legacyPrompt !== defaultLegacyPrompt &&
      (typeof migratedAiConfig.reviewerInstructions !== 'string' || !migratedAiConfig.reviewerInstructions.trim())) {
    migratedAiConfig.reviewerInstructions = legacyPrompt;
  }
  delete migratedAiConfig.systemPrompt;
  delete migratedAiConfig.apiKey;
  migratedAi.aiConfig = migratedAiConfig;
  const oldTheme = localStorage.getItem('stage0_catppuccin_theme_mode');
  const catppuccinTheme = localStorage.getItem('stage0_catppuccin_theme');
  const themeMode = oldTheme === 'dark' || oldTheme === 'light' || oldTheme === 'system'
    ? oldTheme
    : catppuccinTheme === 'mocha-light' ? 'light' : catppuccinTheme === 'mocha' ? 'dark' : 'system';
  const oldFont = readLegacyJson('stage0_viewer_font_settings');
  const showInlineBlame = localStorage.getItem('stage0_show_inline_blame') !== 'false';
  const oldNotifications = readLegacyJson('stage0_notification_settings') as Record<string, unknown> | undefined;
  const reviewers = readLegacyJson('stage0_global_bot_reviewers');

  return {
    schemaVersion: 1,
    general: {
      showInlineBlame,
      streamResponse: oldAiConfig?.streamResponse ?? true,
      enableCodeReviewAssist: oldAiConfig?.enableCodeReviewAssist ?? true,
    },
    appearance: { themeMode, viewerFont: oldFont && typeof oldFont === 'object' ? oldFont : undefined },
    ai: migratedAi,
    reviewers: Array.isArray(reviewers) ? reviewers.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const copy = { ...(item as Record<string, unknown>) };
      if (typeof copy.systemPrompt === 'string' && typeof copy.customInstructions !== 'string') copy.customInstructions = copy.systemPrompt;
      delete copy.systemPrompt;
      return copy;
    }) : [],
    sandbox: { type: 'in_memory' },
    git: {},
    notifications: oldNotifications && typeof oldNotifications === 'object' ? oldNotifications : { channels: { aiReview: true, gitSync: true, guardrails: true } },
  };
}

async function startApp() {
  const legacy = buildLegacyPreferences();
  const legacyRawAi = readLegacyJson('stage0_ai_mcp_config') as Record<string, unknown> | undefined;
  const legacyRawAiConfig = legacyRawAi?.aiConfig as Record<string, unknown> | undefined;
  const legacyApiKey = typeof legacyRawAiConfig?.apiKey === 'string' ? legacyRawAiConfig.apiKey : '';
  let legacyKeyMigrationFailed = false;
  let legacyMcpMigrationFailed = false;
  let preferences = legacy;
  if (isTauri()) {
    try {
      const document = await invoke<PreferencesDocument>('initialize_preferences', { legacy });
      window.__STAGE0_PREFERENCES_REVISION__ = document.revision;
      window.__STAGE0_PREFERENCES_PATH__ = document.path;
      preferences = document.settings ?? JSON.parse(document.content) as PreferenceBootstrap;
      if (legacyApiKey.trim()) {
        try {
          await invoke('store_ai_api_key', { provider: legacyRawAiConfig?.provider ?? 'openai', apiKey: legacyApiKey.trim() });
        } catch {
          legacyKeyMigrationFailed = true;
          console.warn('A legacy AI key could not be moved into the OS keychain. It remains in browser storage for another migration attempt.');
        }
      }
      const legacyMcpSecrets = collectLegacyMcpSecrets(legacyRawAi);
      if (Object.keys(legacyMcpSecrets).length) {
        const migratedServers = (preferences.ai as Record<string, unknown> | undefined)?.mcpServers;
        const mcpSecretMetadataReady = Object.entries(legacyMcpSecrets).every(([serverId, secrets]) =>
          Array.isArray(migratedServers) && migratedServers.some((server) => {
            if (!server || typeof server !== 'object' || Array.isArray(server)) return false;
            const record = server as Record<string, unknown>;
            const keys = record.secretEnvKeys;
            return record.id === serverId && Array.isArray(keys)
              && Object.keys(secrets).every((name) => keys.includes(name));
          }));
        if (mcpSecretMetadataReady && !document.validationError) {
          try {
            await invoke('commit_ai_preferences', {
              apiKeys: {},
              apiKeyRemovals: [],
              policy: null,
              mcpEnvSecrets: legacyMcpSecrets,
              mcpEnvRemovals: {},
            });
          } catch {
            legacyMcpMigrationFailed = true;
            console.warn('Legacy MCP credentials could not be moved into the OS keychain. They remain in browser storage for another migration attempt.');
          }
        } else {
          legacyMcpMigrationFailed = true;
          console.warn('Legacy MCP credentials were retained because preferences.json has no matching secret-variable metadata; Stage0 did not overwrite the current preferences.');
        }
      }
      if (!legacyKeyMigrationFailed && legacyRawAiConfig && typeof legacyRawAiConfig.apiKey === 'string' && legacyRawAiConfig.apiKey) {
        localStorage.setItem('stage0_ai_mcp_config', JSON.stringify({
          ...legacyRawAi,
          aiConfig: { ...legacyRawAiConfig, apiKey: '' },
        }));
      }
      if (!legacyKeyMigrationFailed && !legacyMcpMigrationFailed && !document.validationError) {
        removeMigratedLegacyStorage(legacyRawAi, false);
      } else if (document.validationError) {
        console.warn('preferences.json is invalid. Legacy preferences were retained so they can be recovered after the file is fixed.');
      }
    } catch (error) {
      console.error('Could not initialize preferences.json. Existing browser preferences were retained.', error);
    }
  } else {
    window.__STAGE0_PREFERENCES_REVISION__ = 'web';
    window.__STAGE0_PREFERENCES_PATH__ = 'browser storage';
  }
  window.__STAGE0_PREFERENCES__ = preferences;

  const [{ default: App }, { ErrorBoundary }] = await Promise.all([
    import('./core/App'),
    import('./common/components/ErrorBoundary'),
  ]);
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary><App /></ErrorBoundary>
    </React.StrictMode>
  );
}

void startApp();
