import type { Dispatch, SetStateAction } from 'react';
import type { StoreApi, UseBoundStore } from 'zustand';
import { type ThemeMode } from '../../../core/types/ThemeMode';
import { type AiConfig } from '../../ai/types/AiConfig';
import type { AiPreferencesEditor } from '../../ai/types/AiPreferencesEditor';
import type { AiPreferencesSnapshot } from '../../ai/types/AiPreferencesSnapshot';
import { type SandboxType } from '../../git/types/SandboxType';
import type { PreferenceTab } from '../types/PreferenceTab';

export interface PreferencesDraftSessionContext {
  storedThemeMode: ThemeMode;
  storedFontFamily: string;
  storedFontSize: number;
  storedIsBold: boolean;
  storedIsItalic: boolean;
  storedIsUnderline: boolean;
  storedLineSpacing: number;
  storedEnableLigatures: boolean;
  storedShowInlineBlame: boolean;
  storedSandboxType: SandboxType;
  storedGitBinaryId: string;
  storedGitBinaryPath: string;
  storedAiConfig: AiConfig;
  isPreferencesOpen: boolean;
  aiDraftStore: UseBoundStore<StoreApi<AiPreferencesEditor>>;
  setAiBaseline: Dispatch<SetStateAction<AiPreferencesSnapshot>>;
  setApplyError: Dispatch<SetStateAction<string | null>>;
  fetchActiveBinary: () => Promise<{ id: string; path: string }>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setActiveTab: Dispatch<SetStateAction<PreferenceTab | null>>;
  setExpandedGroups: Dispatch<SetStateAction<Record<string, boolean>>>;
}
