import React from 'react';
import { SettingRow } from '../SettingRow';
import { ZedSwitch } from '../ZedSwitch';
import { useCommandShortcut } from '../../../../core/hooks/useCommandShortcut';
import { useApplicationServices } from '../../../../core/services/runtime/useApplicationServices';
import type { AiConfig } from '../../../ai/types/AiConfig';

export const PreferencesGeneralTab: React.FC<{
  draftShowInlineBlame: boolean;
  setDraftShowInlineBlame: (val: boolean) => void;
  draftLaunchAtStartup: boolean;
  setDraftLaunchAtStartup: (val: boolean) => void;
  draftStartInBackground: boolean;
  setDraftStartInBackground: (val: boolean) => void;
  draftExplorerContextMenu: boolean;
  setDraftExplorerContextMenu: (val: boolean) => void;
  draftAddToPath: boolean;
  setDraftAddToPath: (val: boolean) => void;
  draftAiConfig: AiConfig;
  setDraftAiConfig: (next: AiConfig | ((prev: AiConfig) => AiConfig)) => void;
  showToast: (msg: string) => void;
}> = ({
  draftShowInlineBlame,
  setDraftShowInlineBlame,
  draftLaunchAtStartup,
  setDraftLaunchAtStartup,
  draftStartInBackground,
  setDraftStartInBackground,
  draftExplorerContextMenu,
  setDraftExplorerContextMenu,
  draftAddToPath,
  setDraftAddToPath,
  draftAiConfig,
  setDraftAiConfig,
  showToast,
}) => {
  const { title: commandTitle } = useCommandShortcut();
  const canAddToPath = useApplicationServices().platform.capabilities.backend;
  const isWindows = typeof navigator !== 'undefined' && /Win/i.test(navigator.platform || navigator.userAgent);
  return (
    <div className="space-y-1">
      <SettingRow
        title="Start Stage0 on System Boot"
        description="Automatically launch Stage0 when you log in to Windows."
      >
        <ZedSwitch
          checked={draftLaunchAtStartup}
          onChange={setDraftLaunchAtStartup}
        />
      </SettingRow>

      <SettingRow
        title="Start in Background"
        description="Keep Stage0 running in the system tray on startup without opening a window until requested."
      >
        <ZedSwitch
          checked={draftStartInBackground}
          onChange={setDraftStartInBackground}
        />
      </SettingRow>

      <SettingRow
        title="File Explorer Context Menu (Windows only)"
        description="Add 'Open with Stage0' to the right-click context menu for folders and directories in Windows File Explorer."
      >
        <ZedSwitch
          checked={draftExplorerContextMenu}
          disabled={!isWindows}
          onChange={(val) => {
            if (!isWindows) {
              showToast('Windows Explorer integration is only available on Windows.');
              return;
            }
            setDraftExplorerContextMenu(val);
          }}
        />
      </SettingRow>

      <SettingRow
        title="Stage0 terminal command"
        description={canAddToPath
          ? <>Add <code>stage0</code> to your user PATH. Start a new terminal and run <code>stage0 [dir]</code> to open a repository.</>
          : 'Available in the Stage0 desktop app.'}
      >
        <ZedSwitch
          checked={draftAddToPath}
          disabled={!canAddToPath}
          onChange={setDraftAddToPath}
        />
      </SettingRow>

      <SettingRow
        title="Inline Git Blame"
        description={commandTitle('toggle_inline_blame',
          'Show commit author, relative time, and summary annotation at the end of the active line in diff view.'
        )}
      >
        <ZedSwitch
          checked={draftShowInlineBlame}
          onChange={setDraftShowInlineBlame}
        />
      </SettingRow>

      <SettingRow
        title="Stream AI Responses"
        description="Stream token-by-token completion for real-time responsiveness when generating summaries and reviews."
      >
        <ZedSwitch
          checked={draftAiConfig.streamResponse}
          onChange={(val) =>
            setDraftAiConfig((prev) => ({ ...prev, streamResponse: val }))
          }
        />
      </SettingRow>

      <SettingRow
        title="AI Code Review Assistance"
        description="Enable proactive code review suggestions, inline risk detection, and automated MR annotations."
      >
        <ZedSwitch
          checked={draftAiConfig.enableCodeReviewAssist}
          onChange={(val) =>
            setDraftAiConfig((prev) => ({
              ...prev,
              enableCodeReviewAssist: val,
            }))
          }
        />
      </SettingRow>

      <SettingRow
        title="Accessibility & Contrast"
        description="Enhance focus rings, contrast boundaries, and text legibility across all editor panels."
      >
        <ZedSwitch
          checked={false}
          onChange={() =>
            showToast('High contrast mode is currently aligned with OS settings.')
          }
        />
      </SettingRow>
    </div>
  );
};
