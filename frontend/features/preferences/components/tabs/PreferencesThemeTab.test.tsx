import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PreferencesThemeTab } from './PreferencesThemeTab';

it('shows Dark/Light groups and palette choices stage the same mode as the mode controls', async () => {
  const onChange = vi.fn();
  render(<PreferencesThemeTab draftThemeMode="system" setDraftThemeMode={onChange} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Mocha Dark' }));
  expect(onChange).toHaveBeenLastCalledWith('dark');
  await user.click(screen.getByRole('button', { name: 'Mocha Light' }));
  expect(onChange).toHaveBeenLastCalledWith('light');
  expect(document.documentElement).not.toHaveAttribute('data-color-scheme', 'light');
});
