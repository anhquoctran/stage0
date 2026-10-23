import { useEffect, useRef, useState } from 'react';
import { isMacOS } from '../../../common/utils/shortcuts';
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
      if (event.key === 'Escape') {
        setActiveMenu(null);
        setShowShortcutsModal(false);
      }
    };
    document.addEventListener('mousedown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <>
      {chord && <div role="status" className="fixed bottom-9 left-3 z-[110] rounded-sm border border-surface1 bg-mantle px-3 py-2 text-xs text-text shadow-lg">
        {chord} … <span className="text-subtext0">Waiting for second key · Esc to cancel</span>
      </div>}
      {!hidden && (
        <nav
          ref={menuBarRef}
          aria-label="Application menu"
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
