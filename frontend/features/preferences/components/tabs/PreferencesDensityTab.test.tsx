import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import type { UiDensity } from '../../types/UiDensity';
import { PreferencesDensityTab } from './PreferencesDensityTab';

it('shows three named modes, defaults to Standard and edits only its controlled draft', async () => {
  const onChange = vi.fn();
  render(<PreferencesDensityTab value="standard" onChange={onChange} />);
  expect(screen.getAllByRole('radio')).toHaveLength(3);
  expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  expect(screen.getByText('Default')).toBeVisible();
  await userEvent.click(screen.getByRole('radio', { name: 'Touch' }));
  expect(onChange).toHaveBeenCalledWith('touch');
  expect(screen.getByRole('radio', { name: 'Standard' })).toBeChecked();
  expect(document.documentElement).not.toHaveAttribute('data-ui-density', 'touch');
});

it('supports keyboard radio navigation without committing or trapping focus', async () => {
  function Draft() {
    const [value, onChange] = useState<UiDensity>('standard');
    return <><PreferencesDensityTab value={value} onChange={onChange} /><button>Apply</button></>;
  }
  render(<Draft />);
  const user = userEvent.setup();
  await user.tab(); expect(screen.getByRole('radio', { name: 'Standard' })).toHaveFocus();
  await user.keyboard('{ArrowRight}'); expect(screen.getByRole('radio', { name: 'Compact' })).toBeChecked();
  await user.keyboard('{ArrowRight}'); expect(screen.getByRole('radio', { name: 'Touch' })).toBeChecked();
  await user.tab(); expect(screen.getByRole('button', { name: 'Apply' })).toHaveFocus();
});
