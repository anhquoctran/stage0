import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PreferencesThemeTab } from './PreferencesThemeTab';

it('shows every bundled palette and stages palette selection independently of the mode', async () => {
  const onModeChange = vi.fn();
  const onDarkThemeChange = vi.fn();
  const onLightThemeChange = vi.fn();
  render(<PreferencesThemeTab
    draftThemeMode="system" setDraftThemeMode={onModeChange}
    draftDarkThemeId="catppuccin-mocha" setDraftDarkThemeId={onDarkThemeChange}
    draftLightThemeId="catppuccin-latte" setDraftLightThemeId={onLightThemeChange}
  />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Dracula' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('dracula');
  await user.click(screen.getByRole('button', { name: 'One Dark Pro' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('one-dark-pro');
  await user.click(screen.getByRole('button', { name: 'Gruvbox Dark' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('gruvbox');
  await user.click(screen.getByRole('button', { name: 'Monokai' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('monokai');
  expect(onModeChange).not.toHaveBeenCalled();
  expect(onLightThemeChange).not.toHaveBeenCalled();
  expect(document.documentElement).not.toHaveAttribute('data-color-scheme', 'light');
});
