import { useApplicationServices } from '../../services/runtime/useApplicationServices';

import { useEffect, useMemo, useRef, useState } from 'react';
import { isMacOS } from '../../../common/utils/shortcuts';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';
import { usePerformanceMonitorStore } from '../../../features/performance/store/usePerformanceMonitorStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import { useOnboardingStore } from '../../../features/onboarding/store/useOnboardingStore';
import { getApplicationMenuFlags } from '../../services/applicationMenuState';
import { executeMenuAction } from '../../services/applicationMenuActions';
import { keymapPlatform, resolveKeymap } from '../../services/keymaps/catalog';
import { createKeymapEngine } from '../../services/keymaps/engine';
import { keymapContext, keymapsBlocked } from '../../services/keymaps/context';
import { executeKeymapCommand } from '../../services/keymaps/actions';
import { nativeKeymapAccelerators } from '../../services/keymaps/native';
import { formatKeybinding } from '../../services/keymaps/keystroke';
import { useDateTimeLanguage } from '../../../features/i18n/hooks/useDateTimeLanguage';
import type { MenuCallbacks } from '../../types/menu/MenuCallbacks';
import { MENU_COMMANDS } from '../../constants/applicationMenu';

export function useApplicationMenu(callbacks: MenuCallbacks, modalOpen = false) {
  const appServices = useApplicationServices();
  const language = useDateTimeLanguage();
  const git = useGitStore();
  const prefs = usePreferencesStore();
  const perf = usePerformanceMonitorStore();
  const onboarding = useOnboardingStore((state) => state.isOnboardingOpen);
  useVirtualMrStore(); // Modal state affects the window-scoped native accelerators.
  const [chord, setChord] = useState<string | null>(null);
  const callbackRef = useRef(callbacks);
  callbackRef.current = callbacks;
  const flags = useMemo(getApplicationMenuFlags, [
    git.currentRepo,
    git.selectedFile,
    git.isSyncing,
    git.isRebasing,
    git.recentRepos,
    git.viewMode,
    git.fileViewTab,
    git.fileListLayout,
    prefs.showInlineBlame,
    perf.isEnabled,
    onboarding,
  ]);
  const mac = isMacOS();
  const commands = useMemo(() => resolveKeymap(prefs.keymap, keymapPlatform()), [prefs.keymap]);
  const blocked = modalOpen || onboarding || keymapsBlocked(false);
  const accelerators = useMemo(() => nativeKeymapAccelerators(commands, blocked), [commands, blocked]);
  const shortcutLabels = useMemo(() => Object.fromEntries(commands.filter((command) => Object.hasOwn(MENU_COMMANDS, command.id)).map((command) => [
    command.id, command.keys[0] ? formatKeybinding(command.keys[0], true) : '',
  ])), [commands]);

  useEffect(() => {
    if (mac && appServices.platform.capabilities.nativeMenu) {
      void appServices.application.updateApplicationMenuState({ flags, language, accelerators, shortcutLabels })
        .then(() => appServices.application.updateRecentRepositoriesMenu({ repositories: git.recentRepos }))
        .catch((error) => console.warn('[Stage0 menu] Could not sync native menu state:', error));
    }
  }, [mac, flags, language, accelerators, shortcutLabels, git.recentRepos]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (appServices.platform.capabilities.nativeMenu)
      void appServices.platform.events.subscribe<string>('menu-action', (event) => {
        if (!disposed) void executeMenuAction(event, callbackRef.current);
      })
        .then((stop) => {
          if (disposed) stop();
          else unlisten = stop;
        })
        .catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const engine = createKeymapEngine({
      mac, getCommands: () => commands, getContext: keymapContext,
      execute: (id) => { void executeKeymapCommand(id, callbackRef.current); },
      nativeOwns: (id, key) => mac && appServices.platform.capabilities.nativeMenu && accelerators[id] === key,
      onChord: setChord,
    });
    const onKeyDown = (event: KeyboardEvent) => { engine.handle(event); };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('blur', engine.cancel);
    window.addEventListener('mousedown', engine.cancel);
    return () => {
      engine.dispose();
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('blur', engine.cancel);
      window.removeEventListener('mousedown', engine.cancel);
    };
  }, [mac, commands, accelerators]);
  return { flags, recentRepos: git.recentRepos, chord: chord ? formatKeybinding(chord, mac) : null };
}
