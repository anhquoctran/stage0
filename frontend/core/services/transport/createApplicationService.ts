import type { CommandTransport } from '../../../common/services/ipc/contracts/CommandTransport';
import type { ApplicationService } from './ApplicationService';

export function createApplicationService(transport: CommandTransport): ApplicationService {
  return {
    createNewWindow: () => transport.executeCommand('create_new_window'),
    getWindowStartupContext: () => transport.executeCommand('get_window_startup_context'),
    openWebviewDevtools: () => transport.executeCommand('open_webview_devtools'),
    pickFolder: () => transport.executeCommand('pick_folder'),
    restartApp: () => transport.executeCommand('restart_app'),
    updateApplicationMenuState: (input) => transport.executeCommand('update_application_menu_state', input),
    updateRecentRepositoriesMenu: (input) => transport.executeCommand('update_recent_repositories_menu', input),
    windowClose: () => transport.executeCommand('window_close'),
    windowIsFullscreen: () => transport.executeCommand('window_is_fullscreen'),
    windowIsMaximized: () => transport.executeCommand('window_is_maximized'),
    windowMaximize: () => transport.executeCommand('window_maximize'),
    windowMinimize: () => transport.executeCommand('window_minimize'),
    windowResetSize: () => transport.executeCommand('window_reset_size'),
    windowPrepareMain: () => transport.executeCommand('window_prepare_main'),
    windowShow: () => transport.executeCommand('window_show'),
    windowToggleMaximize: () => transport.executeCommand('window_toggle_maximize'),
  };
}
