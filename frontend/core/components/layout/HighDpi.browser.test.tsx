import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readDisplayScale } from '../../../common/utils/displayScale';
import { CustomSelect } from '../../../common/components/CustomSelect';
import { syncUnreadBadge } from '../../../features/notifications/services/notificationBadgeService';
import { applyUiDensityToDocument } from '../../../features/preferences/utils/applyUiDensityToDocument';
import '../../styles/index.css';

const native = vi.hoisted(() => ({ overlay: vi.fn() }));
vi.mock('../../services/runtime/applicationRuntime', () => ({ getApplicationServices: () => ({
  platform: { capabilities: { windows: true }, windows: { current: () => ({ setOverlayIcon: native.overlay }) } },
}) }));

afterEach(() => applyUiDensityToDocument('standard'));

it('uses physical backing pixels for native bitmap badges at the actual browser DPI', async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Windows');
  await syncUnreadBadge(1);
  const png = native.overlay.mock.calls.at(-1)![0] as Uint8Array;
  const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const physical = Math.ceil(16 * readDisplayScale());
  expect(header.getUint32(16)).toBe(physical);
  expect(header.getUint32(20)).toBe(physical);
  expect(Array.from(png.slice(0, 4))).toEqual([137, 80, 78, 71]);
  await syncUnreadBadge(0);
  expect(native.overlay).toHaveBeenLastCalledWith(undefined);
});

it('keeps CSS sizes, vector artwork, focus and portal coordinates independent of device pixels', async () => {
  const user = userEvent.setup();
  render(<main className="p-4">
    <button className="text-xs h-7 px-3 py-1">Refresh</button>
    <svg role="img" aria-label="Vector icon" width={24} height={24} viewBox="0 0 24 24"><circle cx={12} cy={12} r={8} /></svg>
    <div className="fixed bottom-2 end-2 w-48">
      <CustomSelect aria-label="Encoding" value="auto" onChange={vi.fn()} searchable portal dropdownPlacement="auto"
        buttonClassName="w-full" options={[{ value: 'auto', label: 'Automatic' }, { value: 'utf8', label: 'UTF-8' }]} />
    </div>
  </main>);
  const refresh = screen.getByRole('button', { name: 'Refresh' });
  const icon = screen.getByRole('img', { name: 'Vector icon' });
  const font = getComputedStyle(refresh).fontSize;
  for (const density of ['standard', 'compact', 'touch'] as const) {
    applyUiDensityToDocument(density);
    expect(refresh.getBoundingClientRect().height).toBe(density === 'touch' ? 44 : density === 'compact' ? 24 : 28);
    expect(getComputedStyle(refresh).fontSize).toBe(font);
    expect(icon.getBoundingClientRect().width).toBe(24);
    expect(icon.getBoundingClientRect().height).toBe(24);
    const trigger = screen.getByRole('button', { name: 'Encoding' });
    await user.click(trigger);
    const list = await screen.findByRole('listbox');
    const bounds = list.parentElement!.getBoundingClientRect();
    expect(bounds.left).toBeGreaterThanOrEqual(8);
    expect(bounds.right).toBeLessThanOrEqual(window.innerWidth - 7);
    expect(bounds.top).toBeGreaterThanOrEqual(8);
    expect(bounds.bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top);
    await waitFor(() => expect(screen.getByRole('searchbox')).toHaveFocus());
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  }
});
