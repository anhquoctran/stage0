import { WindowControlIcon } from './WindowControlIcon';
import { useApplicationServices } from '../../services/runtime/useApplicationServices';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { WindowControlsProps } from '../../types/WindowControlsProps';
import { useCommandShortcut } from '../../hooks/useCommandShortcut';

export const WindowControls: React.FC<WindowControlsProps> = ({
  style = 'auto',
  className = '',
  buttons = ['minimize', 'maximize', 'close'],
}) => {
  const appServices = useApplicationServices();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useTranslation();
  const { title } = useCommandShortcut();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const isApple =
      typeof navigator !== 'undefined' &&
      (/Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ||
        (typeof window !== 'undefined' && window.location.search.includes('platform=mac')));
    setIsMac(isApple);

    let current = true;
    let requestVersion = 0;
    const checkMaximized = async () => {
      const version = ++requestVersion;
      try {
        const [max, fullscreen] = await Promise.all([
          appServices.application.windowIsMaximized(),
          appServices.application.windowIsFullscreen(),
        ]);
        if (current && version === requestVersion) {
          setIsMaximized(max);
          setIsFullscreen(fullscreen);
        }
      } catch {
        // Fallback for browser testing
      }
    };

    checkMaximized();

    const handleResize = () => {
      checkMaximized();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('focus', handleResize);
    return () => {
      current = false;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focus', handleResize);
    };
  }, []);

  const effectiveStyle = style === 'auto' ? (isMac ? 'mac' : 'windows') : style;

  const handleMinimize = async () => {
    try {
      await appServices.application.windowMinimize();
    } catch (err) {
      console.warn('Minimize error:', err);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const next = await appServices.application.windowToggleMaximize();
      setIsMaximized(next);
    } catch (err) {
      console.warn('Maximize error:', err);
    }
  };

  const handleToggleFullscreen = async () => {
    try {
      const next = await appServices.application.windowToggleFullscreen();
      setIsFullscreen(next);
    } catch (err) {
      console.warn('Full screen toggle error:', err);
    }
  };

  const handleClose = async () => {
    try {
      await appServices.application.windowClose();
    } catch (err) {
      console.warn('Close error:', err);
    }
  };

  // MAC STYLE: Red, Yellow, Green traffic light dots
  if (effectiveStyle === 'mac') {
    return (
      <div
        className={`flex items-center gap-2 group/traffic select-none ${className}`}
        aria-label={t('common.windowControls')}
      >
        {/* Close (Red) */}
        <button
          type="button"
          data-macos-traffic-light
          onClick={handleClose}
          title={title('close_window', t('common.close'))}
          aria-label={t('common.close')}
          className="btn-solid w-3 h-3 rounded-full bg-[#ff5f56] flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs relative"
        >
          <svg
            className="w-2 h-2 text-[#4c0002] opacity-0 group-hover/traffic:opacity-100 transition-opacity"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Minimize (Yellow) */}
        <button
          type="button"
          data-macos-traffic-light
          onClick={handleMinimize}
          title={`${t('menu.commands.minimize')} (⌘M)`}
          aria-label={t('menu.commands.minimize')}
          className="btn-solid w-3 h-3 rounded-full bg-[#ffbd2e] flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs relative"
        >
          <svg
            className="w-2 h-2 text-[#5e3b00] opacity-0 group-hover/traffic:opacity-100 transition-opacity"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* Native macOS Full Screen (Green) */}
        <button
          type="button"
          data-macos-traffic-light
          onClick={handleToggleFullscreen}
          title={isFullscreen ? t('menu.commands.exit_fullscreen') : t('menu.commands.fullscreen')}
          aria-label={isFullscreen ? t('menu.commands.exit_fullscreen') : t('menu.commands.fullscreen')}
          className="btn-solid w-3 h-3 rounded-full bg-[#27c93f] flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs relative"
        >
          <svg
            className="w-2 h-2 text-[#004d11] opacity-0 group-hover/traffic:opacity-100 transition-opacity"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="14" y1="10" x2="3" y2="21" />
          </svg>
        </button>
      </div>
    );
  }

  // Custom Linux frames use the desktop's supported button order and visibility.
  return (
    <div className={`flex items-center h-full select-none shrink-0 ${className}`}>
      {buttons.map((action) => {
        const label = action === 'close' ? t('common.close') : action === 'minimize' ? t('menu.commands.minimize')
          : isMaximized ? t('common.restoreWindow') : t('common.maximizeWindow');
        return <button
          key={action}
          type="button"
          data-window-control={action}
          onClick={action === 'close' ? handleClose : action === 'minimize' ? handleMinimize : handleToggleMaximize}
          title={label}
          aria-label={label}
          className={`h-full border-0 px-3.5 flex items-center justify-center transition-colors rounded-none ${action === 'close'
            ? 'text-subtext1 hover:text-white hover:bg-[#e81123]'
            : 'text-subtext1 hover:text-text hover:bg-surface0'}`}
        >
          <WindowControlIcon action={action} maximized={isMaximized} />
        </button>;
      })}
    </div>
  );
};

export type { WindowControlsProps } from '../../types/WindowControlsProps';
