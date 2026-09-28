import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const isApple =
      typeof navigator !== 'undefined' &&
      /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
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

  // On macOS, native traffic light controls are rendered by OS on the left
  if (isMac) {
    return null;
  }

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
      console.warn('Maximize error:', err);
    }
  };

  const handleClose = async () => {
    try {
      await invoke('window_close');
    } catch (err) {
      console.warn('Close error:', err);
    }
  };

  return (
    <div className="flex items-center h-full select-none ml-2 shrink-0">
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
