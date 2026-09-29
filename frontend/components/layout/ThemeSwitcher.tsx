import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';

export const ThemeSwitcher: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();
  const isLight = theme === 'mocha-light';

  return (
    <button
      type="button"
      id="theme-switcher-button"
      onClick={toggleTheme}
      title={
        isLight
          ? 'Switch to Catppuccin Mocha (Dark)'
          : 'Switch to Catppuccin Mocha Light (Light)'
      }
      aria-label="Toggle Catppuccin Mocha Dark/Light mode"
      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface0 hover:bg-surface1 border border-surface0 hover:border-surface2 text-text transition-all duration-200 select-none shadow-xs group cursor-pointer text-[10px]"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isLight ? (
          <Sun className="w-3.5 h-3.5 text-peach group-hover:rotate-45 transition-transform duration-300" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-lavender group-hover:rotate-12 transition-transform duration-300" />
        )}
      </div>

      <span className="text-[11px] font-semibold tracking-wide text-subtext1 group-hover:text-text transition-colors">
        {isLight ? 'Mocha Light' : 'Mocha Dark'}
      </span>
    </button>
  );
};
