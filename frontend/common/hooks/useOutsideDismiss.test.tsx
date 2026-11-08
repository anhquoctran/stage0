import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { useOutsideDismiss } from './useOutsideDismiss';

function Dismissible({ open = true, dismiss }: { open?: boolean; dismiss: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  useOutsideDismiss(container, open, dismiss, portal);
  return <><div ref={container}><button>Inside</button></div>
    {createPortal(<div ref={portal}><button>Portal action</button></div>, document.body)}
    <button onClick={event => event.stopPropagation()}>Outside stopped</button></>;
}

it('recognizes the real portal as inside and catches stopped outside clicks during capture', async () => {
  const user = userEvent.setup();
  const dismiss = vi.fn();
  render(<Dismissible dismiss={dismiss} />);
  await user.click(screen.getByRole('button', { name: 'Portal action' }));
  await user.click(screen.getByRole('button', { name: 'Inside' }));
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Outside stopped' }));
  expect(dismiss).toHaveBeenCalledOnce();
});

it('uses the latest callback and removes capture listeners on close and unmount', () => {
  const oldCallback = vi.fn();
  const latest = vi.fn();
  const { rerender, unmount } = render(<Dismissible dismiss={oldCallback} />);
  rerender(<Dismissible dismiss={latest} />);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside stopped' }));
  expect(oldCallback).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledOnce();
  rerender(<Dismissible open={false} dismiss={latest} />);
  fireEvent.click(document.body);
  expect(latest).toHaveBeenCalledOnce();
  rerender(<Dismissible dismiss={latest} />);
  unmount();
  fireEvent.click(document.body);
  expect(latest).toHaveBeenCalledOnce();
});

it('ignores body/document focus transitions while dismissing focus on an outside control', () => {
  const dismiss = vi.fn();
  render(<Dismissible dismiss={dismiss} />);
  fireEvent.focusIn(document.body);
  fireEvent.focusIn(document.documentElement);
  fireEvent.focusIn(document);
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.focusIn(screen.getByRole('button', { name: 'Outside stopped' }));
  expect(dismiss).toHaveBeenCalledOnce();
});
