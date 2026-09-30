import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface WindowControlsProps {
  style?: 'windows' | 'mac' | 'auto';
  className?: string;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
  style = 'auto',
  className = '',
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const isApple =
      typeof navigator !== 'undefined' &&
      (/Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ||
        (typeof window !== 'undefined' && window.location.search.includes('platform=mac')));
    setIsMac(isApple);

    const checkMaximized = async () => {
      try {
        const max = await invoke<boolean>('window_is_maximized');
        setIsMaximized(max);
      } catch {
        // Fallback for browser testing
      }
    };

    checkMaximized();

    const handleResize = () => {
      checkMaximized();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveStyle = style === 'auto' ? (isMac ? 'mac' : 'windows') : style;

  const handleMinimize = async () => {
    try {
      await invoke('window_minimize');
    } catch (err) {
      console.warn('Minimize error:', err);
    }
  };

  const handleToggleMaximize = async () => {
    try {
      const next = await invoke<boolean>('window_toggle_maximize');
      setIsMaximized(next);
    } catch (err) {
      setIsMaximized((prev) => !prev);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('window_close');
    } catch (err) {
      console.warn('Close error:', err);
    }
  };

  // MAC STYLE: Red, Yellow, Green traffic light dots
  if (effectiveStyle === 'mac') {
    return (
      <div
        className={`flex items-center gap-2 group/traffic select-none ${className}`}
        aria-label="macOS Window Controls"
      >
        {/* Close (Red) */}
        <button
          type="button"
          onClick={handleClose}
          title="Close (⌘W)"
          aria-label="Close"
          className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/70 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs relative"
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
          onClick={handleMinimize}
          title="Minimize (⌘M)"
          aria-label="Minimize"
          className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea125]/70 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs relative"
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

        {/* Zoom / Maximize (Green) */}
        <button
          type="button"
          onClick={handleToggleMaximize}
          title={isMaximized ? 'Restore Down' : 'Zoom (Maximize)'}
          aria-label={isMaximized ? 'Restore Down' : 'Zoom'}
          className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]/70 flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xs relative"
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

  // WINDOWS STYLE: Minimize, Maximize, Close icons on the right
  return (
    <div className={`flex items-center h-full select-none ml-2 shrink-0 ${className}`}>
      {/* Minimize */}
      <button
        type="button"
        onClick={handleMinimize}
        title="Minimize"
        aria-label="Minimize"
        className="h-full px-3.5 flex items-center justify-center text-subtext1 hover:text-text hover:bg-surface0 transition-colors"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      {/* Maximize / Restore */}
      <button
        type="button"
        onClick={handleToggleMaximize}
        title={isMaximized ? 'Restore Down' : 'Maximize'}
        aria-label={isMaximized ? 'Restore Down' : 'Maximize'}
        className="h-full px-3.5 flex items-center justify-center text-subtext1 hover:text-text hover:bg-surface0 transition-colors"
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
            <path d="M2.5 2.5V0.5H9.5V7.5H7.5" strokeWidth="1" />
            <rect x="0.5" y="2.5" width="7" height="7" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
            <rect x="0.5" y="0.5" width="9" height="9" strokeWidth="1" />
          </svg>
        )}
      </button>

      {/* Close */}
      <button
        type="button"
        onClick={handleClose}
        title="Close"
        aria-label="Close"
        className="h-full px-3.5 flex items-center justify-center text-subtext1 hover:text-white hover:bg-[#e81123] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  );
};
