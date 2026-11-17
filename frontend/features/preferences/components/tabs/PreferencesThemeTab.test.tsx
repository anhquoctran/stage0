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
  const darkSelect = screen.getByRole('button', { name: 'Dark Color Palette' });
  await user.click(darkSelect);
  await user.click(screen.getByRole('option', { name: 'Dracula' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('dracula');
  await user.click(darkSelect);
  await user.click(screen.getByRole('option', { name: 'One Dark Pro' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('one-dark-pro');
  await user.click(darkSelect);
  await user.click(screen.getByRole('option', { name: 'Gruvbox Dark' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('gruvbox');
  await user.click(darkSelect);
  await user.click(screen.getByRole('option', { name: 'Monokai' }));
  expect(onDarkThemeChange).toHaveBeenLastCalledWith('monokai');
  const lightSelect = screen.getByRole('button', { name: 'Light Color Palette' });
  for (const [label, id] of [['Alucard', 'alucard'], ['Atom One Light', 'atom-one-light'], ['Gruvbox Light', 'gruvbox-light']]) {
    await user.click(lightSelect);
    await user.click(screen.getByRole('option', { name: label }));
    expect(onLightThemeChange).toHaveBeenLastCalledWith(id);
  }
  expect(onModeChange).not.toHaveBeenCalled();
  expect(document.documentElement).not.toHaveAttribute('data-color-scheme', 'light');
});
