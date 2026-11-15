import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MarkdownEditor } from './MarkdownEditor';

function Editor({ initial = '' }: { initial?: string }) {
  const [value, onChange] = useState(initial);
  return <MarkdownEditor value={value} onChange={onChange} mentionOptions={[
    { id: 'one', label: 'Reviewer One', kind: 'reviewer' },
    { id: 'two', label: 'Reviewer Two', kind: 'reviewer' },
  ]} />;
}

it('sets the insertion caret before the next keystroke and never replays a late mention caret over review text', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  render(<Editor initial="@One rest" />);
  const input = screen.getByRole('combobox') as HTMLTextAreaElement;
  act(() => { input.focus(); input.setSelectionRange(4, 4); });
  fireEvent.select(input);
  fireEvent.keyDown(input, { key: 'Enter' });
  const mention = '[@Reviewer One](#mr-mention/reviewer/one)';
  expect(input.value).toBe(`${mention} rest`);
  expect(input.selectionStart).toBe(mention.length);
  // A user can type before an animation frame runs (especially under load).
  const caret = mention.length + 1;
  fireEvent.change(input, { target: { value: `${mention} rrest`, selectionStart: caret + 1, selectionEnd: caret + 1 } });
  act(() => { for (const frame of frames) frame(0); });
  expect(input.selectionStart).toBe(caret + 1);
  expect(input.selectionEnd).toBe(caret + 1);
});

it('does not focus or move the editor after it is unmounted with a pending mention insertion', () => {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  const view = render(<Editor initial="@One" />);
  const input = screen.getByRole('combobox') as HTMLTextAreaElement;
  act(() => { input.focus(); input.setSelectionRange(4, 4); });
  fireEvent.select(input); fireEvent.keyDown(input, { key: 'Tab' });
  view.unmount();
  const focus = vi.spyOn(input, 'focus');
  act(() => { for (const frame of frames) frame(0); });
  expect(focus).not.toHaveBeenCalled();
});


it('types review after multiple keyboard-selected mentions without editing their labels or losing the caret', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const input = screen.getByRole('combobox') as HTMLTextAreaElement;
  await user.type(input, '@One'); await user.keyboard('{Enter}');
  await user.keyboard('@Two'); await user.keyboard('{Tab}');
  await user.keyboard('review');
  expect(input.value).toBe('[@Reviewer One](#mr-mention/reviewer/one) [@Reviewer Two](#mr-mention/reviewer/two) review');
  expect(input.selectionStart).toBe(input.value.length);
  expect(input.selectionEnd).toBe(input.value.length);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
