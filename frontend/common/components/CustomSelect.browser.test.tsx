import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { CustomSelect } from './CustomSelect';

function ViewportSelect() {
  const [value, onChange] = useState('one');
  return <div style={{ position: 'fixed', bottom: 8, right: -20, width: 180, height: 36, overflow: 'hidden' }} data-testid="clipped">
    <CustomSelect value={value} onChange={onChange} options={[
      { value: 'one', label: 'First encoding' }, { value: 'two', label: 'Second encoding' },
    ]} portal dropdownPlacement="auto" aria-label="Encoding at viewport edge" />
  </div>;
}

it('keeps a portalled dropdown inside the actual viewport and above its clipped bottom trigger', async () => {
  const user = userEvent.setup();
  render(<ViewportSelect />);
  const trigger = screen.getByRole('button', { name: 'Encoding at viewport edge' });
  await user.click(trigger);
  const menu = screen.getByRole('listbox').parentElement!;
  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  expect(menuRect.width).toBeGreaterThan(0);
  expect(menuRect.left).toBeGreaterThanOrEqual(8);
  expect(menuRect.right).toBeLessThanOrEqual(window.innerWidth - 7);
  expect(menuRect.top).toBeGreaterThanOrEqual(8);
  expect(menuRect.bottom).toBeLessThanOrEqual(triggerRect.top);
  expect(screen.getByTestId('clipped')).not.toContainElement(menu);
  await user.click(screen.getByRole('option', { name: 'Second encoding' }));
  expect(trigger).toHaveTextContent('Second encoding');
  expect(trigger).toHaveFocus();
});

it('repositions on actual viewport/scroll events without losing keyboard navigation or leaking a portal', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<ViewportSelect />);
  const trigger = screen.getByRole('button', { name: 'Encoding at viewport edge' });
  trigger.focus();
  await user.keyboard('{Enter}');
  fireEvent.resize(window);
  fireEvent.scroll(window);
  expect(screen.getByRole('listbox')).toBeVisible();
  await user.keyboard('{ArrowDown}{Enter}');
  expect(trigger).toHaveTextContent('Second encoding');
  await user.keyboard('{Enter}');
  unmount();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
