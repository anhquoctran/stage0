import type { MenuFlags } from '../../types/menu/MenuFlags';
import type { RepoInfo } from '../../../features/git/types/RepoInfo';
import type { WindowStartupContext } from '../../../features/git/types/WindowStartupContext';

/** Feature-owned backend contract. Inputs retain the existing wire field names. */
export interface ApplicationService {
  createNewWindow(): Promise<unknown>;
  getWindowStartupContext(): Promise<WindowStartupContext>;
  openWebviewDevtools(): Promise<unknown>;
  pickFolder(): Promise<string | null>;
  restartApp(): Promise<unknown>;
  updateApplicationMenuState(input: {
    flags: MenuFlags;
    accelerators: Record<string, string>;
    shortcutLabels: {
      [k: string]: string;
    };
  }): Promise<unknown>;
  updateRecentRepositoriesMenu(input: {
    repositories: RepoInfo[];
  }): Promise<unknown>;
  windowClose(): Promise<unknown>;
  windowIsFullscreen(): Promise<boolean>;
  windowIsMaximized(): Promise<boolean>;
  windowMaximize(): Promise<unknown>;
  windowMinimize(): Promise<unknown>;
  windowResetSize(): Promise<unknown>;
  windowPrepareMain(): Promise<unknown>;
  windowShow(): Promise<unknown>;
  windowToggleMaximize(): Promise<boolean>;
}
