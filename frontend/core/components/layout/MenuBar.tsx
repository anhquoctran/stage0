import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isMacOS } from '../../../common/utils/shortcuts';
import { useApplicationServices } from '../../services/runtime/useApplicationServices';
import { isPrimaryAppWindow } from '../../utils/isPrimaryAppWindow';
import { AboutModal } from '../../../features/about/components/AboutModal';
import { ReleaseNotesModal } from '../../../features/about/components/ReleaseNotesModal';
import { getOsFileManagerName } from '../../../features/git/utils/fileActions';
import { APPLICATION_MENUS, menuNodesForPlatform } from '../../constants/applicationMenu';
import { executeMenuAction } from '../../services/applicationMenuActions';
import type { MenuBarProps } from '../../types/MenuBarProps';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { ConfiguredMenu } from './menu-bar/ConfiguredMenu';
import { useApplicationMenu } from './useApplicationMenu';

export function MenuBar({ hidden = false }: MenuBarProps) {
  const appServices = useApplicationServices();
  const { t } = useTranslation();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showReleaseNotesModal, setShowReleaseNotesModal] = useState(false);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const callbacks = {
    onOpenShortcuts: () => setShowShortcutsModal(true),
    onOpenReleaseNotes: () => setShowReleaseNotesModal(true),
    onOpenAbout: () => setShowAboutModal(true),
  };
  const { flags, recentRepos, chord } = useApplicationMenu(callbacks, showShortcutsModal || showAboutModal || showReleaseNotesModal);
  useEffect(() => {
    if (!appServices.platform.capabilities.backend || !isPrimaryAppWindow()) return;
    let disposed = false;
    void appServices.softwareUpdates.consumeReleaseNotesPrompt()
      .then((shouldOpen) => {
        if (!disposed && shouldOpen) setShowReleaseNotesModal(true);
      })
      .catch((error) => {
        console.warn('Could not check for release notes after the software update:', error);
      });
    return () => {
      disposed = true;
    };
  }, [appServices]);
  useEffect(() => {
    if (!flags.repository)
      setActiveMenu((current) => (current === 'repository_menu' ? null : current));
  }, [flags.repository]);
  const platform = isMacOS()
    ? 'macos'
    : /Win/i.test(navigator.platform || navigator.userAgent)
      ? 'windows'
      : 'linux';
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!menuBarRef.current?.contains(event.target as Node)) setActiveMenu(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'F10' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !flags.onboarding && menuBarRef.current) {
        event.preventDefault();
        menuBarRef.current.querySelector<HTMLButtonElement>(':scope > div > button:not(:disabled)')?.focus();
        return;
      }
      if (event.key === 'Escape') {
        const trigger = menuBarRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"]');
        setActiveMenu(null);
        setShowShortcutsModal(false);
        if (document.activeElement?.closest('[role="menu"]')) trigger?.focus();
      }
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [flags.onboarding]);
  return (
    <>
      {chord && <div role="status" className="fixed bottom-9 start-3 z-[110] rounded-sm border border-surface1 bg-mantle px-3 py-2 text-xs text-text shadow-lg">
        {chord} … <span className="text-subtext0">{t('menu.waitingForSecondKey')}</span>
      </div>}
      {!hidden && (
        <nav
          ref={menuBarRef}
          aria-label={t('menu.application')}
          onKeyDown={(event) => {
            if (event.target instanceof Element && event.target.closest('[role="menu"]')) return;
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const items = [...(menuBarRef.current?.querySelectorAll<HTMLButtonElement>(':scope > div > button:not(:disabled)') ?? [])];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            if (index < 0 || !items.length) return;
            event.preventDefault();
            const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
            setActiveMenu(null);
            items[next]?.focus();
          }}
          className="flex h-full select-none text-xs"
        >
          {menuNodesForPlatform(APPLICATION_MENUS, platform).map((node) => (
            <ConfiguredMenu
              key={node.id}
              node={node}
              flags={flags}
              recentRepos={recentRepos}
              platform={platform}
              fileManager={getOsFileManagerName()}
              isOpen={activeMenu === node.id}
              onToggle={() => setActiveMenu(activeMenu === node.id ? null : node.id!)}
              onHover={() => {
                if (activeMenu !== null) setActiveMenu(node.id!);
              }}
              onClose={() => setActiveMenu(null)}
              execute={(id) => void executeMenuAction(id, callbacks)}
            />
          ))}
        </nav>
      )}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
      <ReleaseNotesModal
        isOpen={showReleaseNotesModal}
        onClose={() => setShowReleaseNotesModal(false)}
      />
      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />
    </>
  );
}

export type { MenuBarProps } from '../../types/MenuBarProps';
