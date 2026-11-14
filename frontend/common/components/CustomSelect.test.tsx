import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomSelect } from './CustomSelect';

const options = [
  { value: 'auto', label: 'Automatic', group: 'Detection' },
  { value: 'blocked', label: 'Unavailable', disabled: true },
  { value: 'utf8', label: 'UTF-8', description: 'Unicode', group: 'Unicode' },
  { value: 'utf16', label: 'UTF-16 LE', group: 'Unicode' },
];

function ControlledSelect({ portal = false, searchable = false, disabled = false }) {
  const [value, setValue] = useState('auto');
  return <div data-testid="clipping-parent" style={{ overflow: 'hidden' }}>
    <CustomSelect value={value} onChange={setValue} options={options} portal={portal}
      searchable={searchable} disabled={disabled} aria-label="File encoding" />
    <button type="button">Outside action</button>
  </div>;
}

describe('CustomSelect with real React DOM', () => {
  it('supports keyboard selection, skips disabled options and restores trigger focus', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect />);
    const trigger = screen.getByRole('button', { name: 'File encoding' });
    trigger.focus();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(trigger).toHaveTextContent('UTF-8');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Enter}{ArrowUp}{Enter}');
    expect(trigger).toHaveTextContent('Automatic');
    await user.keyboard('{Enter}{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('portals outside a clipping parent, filters by description and keeps search interaction inside', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect portal searchable />);
    await user.click(screen.getByRole('button', { name: 'File encoding' }));
    const search = screen.getByRole('searchbox');
    expect(search).toHaveFocus();
    const list = screen.getByRole('listbox');
    expect(screen.getByTestId('clipping-parent')).not.toContainElement(list);
    expect(document.body).toContainElement(list);
    await user.type(search, 'Unicode');
    expect(within(list).getAllByRole('option')).toHaveLength(1);
    await user.click(screen.getByRole('option', { name: /UTF-8 Unicode/ }));
    expect(screen.getByRole('button', { name: 'File encoding' })).toHaveTextContent('UTF-8');
    await user.click(screen.getByRole('button', { name: 'File encoding' }));
    expect(screen.getByRole('searchbox')).toHaveValue('');
    await user.type(screen.getByRole('searchbox'), 'no such encoding');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No matching options.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Outside action' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not select disabled options or consume the outside control activation', async () => {
    const user = userEvent.setup();
    const outside = vi.fn();
    render(<><ControlledSelect portal /><button onClick={outside}>Apply changes</button></>);
    await user.click(screen.getByRole('button', { name: 'File encoding' }));
    await user.click(screen.getByRole('option', { name: 'Unavailable' }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File encoding' })).toHaveTextContent('Automatic');
    await user.click(screen.getByRole('button', { name: 'Apply changes' }));
    expect(outside).toHaveBeenCalledOnce();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dismisses on focus leaving the portal and removes the portal on unmount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ControlledSelect portal />);
    await user.click(screen.getByRole('button', { name: 'File encoding' }));
    fireEvent.focusIn(screen.getByRole('button', { name: 'Outside action' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'File encoding' }));
    unmount();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('never opens a disabled select', async () => {
    const user = userEvent.setup();
    render(<ControlledSelect disabled />);
    await user.click(screen.getByRole('button', { name: 'File encoding' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File encoding' })).toBeDisabled();
  });
});
