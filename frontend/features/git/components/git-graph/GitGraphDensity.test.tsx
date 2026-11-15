import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GitGraphTableRow } from './GitGraphTableRow';
import { usePreferencesStore } from '../../../preferences/store/usePreferencesStore';
vi.mock('../../../preferences/services/preferencesJsonService', () => ({ preferencesJsonService: { patch: vi.fn() } }));
vi.mock('../../../preferences/services/preferencesWindowService', () => ({ requestPreferencesWindow: vi.fn() }));
vi.mock('../../../i18n/hooks/useDateTimeLanguage', () => ({ useDateTimeLanguage: vi.fn() }));
vi.mock('../CommitAuthorAvatar', () => ({ CommitAuthorAvatar: () => <span>Avatar</span> }));

afterEach(() => usePreferencesStore.setState({ uiDensity: 'standard' }));

it('keeps graph edges continuous and nodes centered when committed density changes', () => {
  const { rerender } = render(<table><tbody><GitGraphTableRow
    commit={{ hash: 'abc', short_hash: 'abc', parents: ['def'], subject: 'Example',
      author_name: 'Author', author_email: 'author@example.com', authored_date: '2026-11-09T00:00:00Z', refs: [] }}
    row={{ lane: 0, hasIncomingEdge: true, throughLanes: [1], parentLanes: [0, 1] }}
    graphWidth={100} hasSearchFilter={false} isSelected={false} isMatch={false} isActiveMatch={false}
    onSelect={vi.fn()} onContextMenu={vi.fn()} onRowRef={vi.fn()} /></tbody></table>);
  for (const [uiDensity, size] of [['compact', 28], ['standard', 36], ['touch', 48]] as const) {
    act(() => usePreferencesStore.setState({ uiDensity }));
    const row = screen.getByRole('row'), svg = screen.getByRole('img');
    expect(row).toHaveStyle({ height: `${size}px` });
    expect(svg).toHaveAttribute('height', String(size));
    expect(svg.querySelector('circle')).toHaveAttribute('cy', String(size / 2));
    const paths = Array.from(svg.querySelectorAll('path'), path => path.getAttribute('d'));
    expect(paths).toEqual([`M 30 0 V ${size}`, `M 12 0 V ${size / 2}`,
      `M 12 ${size / 2} V ${size}`, `M 12 ${size / 2} C 12 ${size * 0.75}, 30 ${size * 0.75}, 30 ${size}`]);
  }
  rerender(<table><tbody><GitGraphTableRow
    commit={{ hash: 'abc', short_hash: 'abc', parents: [], subject: 'Example',
      author_name: 'Author', author_email: '', authored_date: '', refs: [] }}
    row={{ lane: 0, hasIncomingEdge: false, throughLanes: [], parentLanes: [] }}
    graphWidth={100} hasSearchFilter isSelected={false} isMatch={false} isActiveMatch={false}
    onSelect={vi.fn()} onContextMenu={vi.fn()} onRowRef={vi.fn()} /></tbody></table>);
  expect(screen.getByRole('img').querySelector('circle')).toHaveAttribute('cy', '24');
});
