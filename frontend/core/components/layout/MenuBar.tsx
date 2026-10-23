import { invoke } from '@tauri-apps/api/core';
import React, { useEffect, useRef, useState } from 'react';
import { formatShortcutText } from '../../../common/utils/shortcuts';
import { AboutModal } from '../../../features/about/components/AboutModal';
import { useGitStore } from '../../../features/git/store/useGitStore';
import { getOsFileManagerName } from '../../../features/git/utils/fileActions';
import { usePerformanceMonitorStore } from '../../../features/performance/store/usePerformanceMonitorStore';
import { usePreferencesStore } from '../../../features/preferences/store/usePreferencesStore';
import { useVirtualMrStore } from '../../../features/virtual-mr/store/useVirtualMrStore';
import type { MenuBarProps } from '../../types/MenuBarProps';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { MenuBarEditMenu } from './menu-bar/MenuBarEditMenu';
import { MenuBarFileMenu } from './menu-bar/MenuBarFileMenu';
import { MenuBarHelpMenu } from './menu-bar/MenuBarHelpMenu';
import { MenuBarRepositoryMenu } from './menu-bar/MenuBarRepositoryMenu';
import { MenuBarViewMenu } from './menu-bar/MenuBarViewMenu';
import { useNativeMenuActions } from './useNativeMenuActions';

export const MenuBar: React.FC<MenuBarProps> = ({ hidden = false }) => {
  const { openRepoSettings, openNewMrDraft } = useVirtualMrStore();
  const {
    currentRepo,
    openRepoDialog,
    setIsCloneModalOpen,
    closeRepo,
    setViewMode,
    runSync,
    setIsPullFromOpen,
    setIsMergeFromOpen,
    setIsRebaseFromOpen,
    setIsGitGraphOpen,
    toggleFileBlame,
  } = useGitStore();

  const { setIsPreferencesOpen, toggleInlineBlame } = usePreferencesStore();
  const { toggle: togglePerformanceMonitor } = usePerformanceMonitorStore();

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeRepositorySubmenu, setActiveRepositorySubmenu] = useState<
    'sync' | 'merge' | 'rebase' | 'open' | null
  >(null);
  const [showPerformanceSubmenu, setShowPerformanceSubmenu] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  const fileManagerName = getOsFileManagerName();

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const shortcut = (value: string) => formatShortcutText(value, isMac);

  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentRepo) return;

    setActiveMenu((menu) => (menu === 'repository' || menu === 'edit' ? null : menu));
    setActiveRepositorySubmenu(null);
  }, [currentRepo]);

  const closeMenus = () => {
    setActiveMenu(null);
    setActiveRepositorySubmenu(null);
    setShowPerformanceSubmenu(false);
  };

  const handleMenuClick = (menuName: string) => {
    if (activeMenu === menuName) {
      closeMenus();
    } else {
      setActiveMenu(menuName);
      setActiveRepositorySubmenu(null);
      setShowPerformanceSubmenu(false);
    }
  };

  const handleMenuHover = (menuName: string) => {
    if (activeMenu !== null && activeMenu !== menuName) {
      setActiveMenu(menuName);
      setActiveRepositorySubmenu(null);
      setShowPerformanceSubmenu(false);
    }
  };

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        closeMenus();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenus();
        setShowShortcutsModal(false);
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === ',' || (e.shiftKey && (e.key.toLowerCase() === 't' || e.code === 'KeyT')))
      ) {
        e.preventDefault();
        // The native macOS menu owns Cmd+,; keep the custom Shift+T alias here.
        if (!(isMac && e.key === ',')) {
          closeMenus();
          setIsPreferencesOpen(true);
        }
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        if (!isMac) openRepoDialog();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'n' || e.code === 'KeyN')
      ) {
        e.preventDefault();
        // macOS routes this accelerator through the native application menu.
        if (!isMac) void invoke('create_new_window');
      } else if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.key.toLowerCase() === 'o' || e.code === 'KeyO')
      ) {
        e.preventDefault();
        if (!isMac) setIsCloneModalOpen(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMac, openRepoDialog, setIsPreferencesOpen, setIsCloneModalOpen]);

  // Listen to native macOS menu events from Tauri
  const {} = useNativeMenuActions({
    openRepoDialog,
    setIsCloneModalOpen,
    closeRepo,
    setIsPreferencesOpen,
    openNewMrDraft,
    runSync,
    setIsPullFromOpen,
    setIsMergeFromOpen,
    setIsRebaseFromOpen,
    setIsGitGraphOpen,
    openRepoSettings,
    setViewMode,
    toggleFileBlame,
    toggleInlineBlame,
    togglePerformanceMonitor,
    setShowShortcutsModal,
    setShowAboutModal,
  });

  return (
    <>
      {!hidden && (
        <nav
          ref={menuBarRef}
          aria-label="Application menu"
          className="flex items-center h-full select-none text-xs"
        >
          <MenuBarFileMenu
            isOpen={activeMenu === 'file'}
            onToggle={() => handleMenuClick('file')}
            onHover={() => handleMenuHover('file')}
            onClose={closeMenus}
            shortcut={shortcut}
          />

          <MenuBarEditMenu
            isOpen={activeMenu === 'edit'}
            onToggle={() => handleMenuClick('edit')}
            onHover={() => handleMenuHover('edit')}
            onClose={closeMenus}
            shortcut={shortcut}
            fileManagerName={fileManagerName}
          />

          <MenuBarViewMenu
            isOpen={activeMenu === 'view'}
            onToggle={() => handleMenuClick('view')}
            onHover={() => handleMenuHover('view')}
            onClose={closeMenus}
            shortcut={shortcut}
            showPerformanceSubmenu={showPerformanceSubmenu}
            setShowPerformanceSubmenu={setShowPerformanceSubmenu}
          />

          <MenuBarRepositoryMenu
            isOpen={activeMenu === 'repository'}
            onToggle={() => handleMenuClick('repository')}
            onHover={() => handleMenuHover('repository')}
            onClose={closeMenus}
            shortcut={shortcut}
            fileManagerName={fileManagerName}
            activeSubmenu={activeRepositorySubmenu}
            setActiveSubmenu={setActiveRepositorySubmenu}
          />

          <MenuBarHelpMenu
            isOpen={activeMenu === 'help'}
            onToggle={() => handleMenuClick('help')}
            onHover={() => handleMenuHover('help')}
            onClose={closeMenus}
            onOpenShortcuts={() => setShowShortcutsModal(true)}
            onOpenAbout={() => setShowAboutModal(true)}
          />
        </nav>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* About Modal */}
      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
    </>
  );
};

export type { MenuBarProps } from '../../types/MenuBarProps';
