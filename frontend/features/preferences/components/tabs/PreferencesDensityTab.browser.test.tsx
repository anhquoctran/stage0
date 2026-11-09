import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomSelect } from '../../../../common/components/CustomSelect';
import { SettingRow } from '../SettingRow';
import { PreferencesDensityTab } from './PreferencesDensityTab';
import { applyUiDensityToDocument } from '../../utils/applyUiDensityToDocument';
import type { UiDensity } from '../../types/UiDensity';
import '../../../../core/styles/index.css';

afterEach(() => applyUiDensityToDocument('standard'));
const height = (element: Element) => element.getBoundingClientRect().height;

function DensityLayout({ preview = false }: { preview?: boolean }) {
  const [density, setDensity] = useState<UiDensity>('standard');
  const [value, setValue] = useState('one');
  if (preview) return <div className="p-4"><PreferencesDensityTab value={density} onChange={setDensity} /></div>;
  return <main className="w-full p-2">
    <div data-testid="titlebar" data-density-exempt className="h-8.5 flex items-center">
      <button className="h-6 px-2">Window control</button>
    </div>
    <div data-testid="toolbar" className="ui-density-toolbar h-16 flex items-center">
      <button className="h-7 px-3 py-1 text-xs">Refresh</button>
    </div>
    <SettingRow title="Density example" description="Select a value">
      <CustomSelect aria-label="Example select" buttonClassName="w-32" value={value} onChange={setValue} portal dropdownPlacement="auto"
        options={[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }]} />
    </SettingRow>
    <button className="ui-density-row px-3 py-1.5 w-full text-start text-xs">File row</button>
    <div data-density-exempt><div data-testid="code" style={{ height: 24, lineHeight: '24px', fontSize: 13 }}>const value = 1;</div></div>
  </main>;
}

it('changes real control and row geometry, preserves Standard, native chrome and code line sizes', async () => {
  render(<DensityLayout />);
  const user = userEvent.setup();
  const refresh = screen.getByRole('button', { name: 'Refresh' });
  const row = screen.getByRole('button', { name: 'File row' });
  const title = screen.getByTestId('titlebar');
  const native = screen.getByRole('button', { name: 'Window control' });
  const baseline = [height(refresh), height(row), height(title), height(native), height(screen.getByTestId('code'))];
  const measurements = [];
  for (const density of ['standard', 'compact', 'touch', 'standard'] as const) {
    applyUiDensityToDocument(density);
    const control = screen.getByRole('button', { name: 'Example select' });
    measurements.push([height(refresh), height(row)]);
    expect(height(title)).toBe(baseline[2]); expect(height(native)).toBe(baseline[3]);
    expect(height(screen.getByTestId('code'))).toBe(24);
    expect(getComputedStyle(screen.getByTestId('code')).fontSize).toBe('13px');
    const bounds = refresh.getBoundingClientRect(), toolbar = screen.getByTestId('toolbar').getBoundingClientRect();
    expect(bounds.top).toBeGreaterThanOrEqual(toolbar.top); expect(bounds.bottom).toBeLessThanOrEqual(toolbar.bottom);
    await user.click(control);
    const list = await screen.findByRole('listbox');
    expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth);
    if (density === 'touch') {
      expect(height(control)).toBeGreaterThanOrEqual(44);
      expect(height(screen.getByRole('option', { name: 'Two' }))).toBeGreaterThanOrEqual(44);
    }
    await user.click(screen.getByRole('option', { name: 'Two' }));
    expect(control).toHaveFocus();
  }
  expect(measurements[1][0]).toBeLessThan(measurements[0][0]);
  expect(measurements[1][1]).toBeLessThan(measurements[0][1]);
  expect(measurements[2][0]).toBeGreaterThanOrEqual(44);
  expect(measurements[2][1]).toBeGreaterThanOrEqual(44);
  expect(measurements[3]).toEqual(measurements[0]);
});

it('keeps all three preview choices readable and keyboard accessible in a narrow window', async () => {
  applyUiDensityToDocument('touch');
  render(<DensityLayout preview />);
  await userEvent.tab();
  await userEvent.keyboard('{ArrowRight}{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Touch' })).toBeChecked();
  for (const mode of screen.getAllByRole('radio')) {
    const bounds = mode.closest('label')!.getBoundingClientRect();
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(window.innerWidth);
  }
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
});
