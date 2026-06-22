/**
 * RTL tests for ResourceSelect.
 * Covers: group rendering, search filtering, per-group select-all, row toggle.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResourceSelect from './ResourceSelect';
import type { ResourceRow } from '@/lib/queries';

// Mock @tanstack/react-virtual so we don't need a real DOM measurement loop.
// The mock renders all items (no windowing) so RTL can find them.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, getItemKey }: { count: number; getItemKey: (i: number) => string }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: getItemKey(i),
        start: i * 48,
        size: 48,
        lane: 0,
      })),
    getTotalSize: () => count * 48,
    measureElement: () => {},
  }),
}));

const SERVICES: ResourceRow[] = [
  { id: 's1', type: 'service', name: 'SEO Audit', description: 'Full SEO audit service' },
  { id: 's2', type: 'service', name: 'PPC Management', description: 'Pay-per-click campaigns' },
];
const PRODUCTS: ResourceRow[] = [
  { id: 'p1', type: 'product', name: 'Analytics Dashboard', description: 'Real-time analytics' },
  { id: 'p2', type: 'product', name: 'Keyword Tool', description: 'Keyword research product' },
];
const ALL: ResourceRow[] = [...SERVICES, ...PRODUCTS];

describe('ResourceSelect', () => {
  let onChange: ReturnType<typeof vi.fn>;
  let selectedIds: Set<string>;

  beforeEach(() => {
    onChange = vi.fn();
    selectedIds = new Set<string>();
  });

  it('renders services and products in their respective groups', () => {
    render(
      <ResourceSelect resources={ALL} value={selectedIds} onChange={onChange} />,
    );
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('SEO Audit')).toBeInTheDocument();
    expect(screen.getByText('PPC Management')).toBeInTheDocument();
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Keyword Tool')).toBeInTheDocument();
  });

  it('typing in search box filters rows by name', async () => {
    vi.useFakeTimers();
    render(
      <ResourceSelect resources={ALL} value={selectedIds} onChange={onChange} />,
    );

    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'SEO' } });

    // Flush debounce (200 ms)
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('SEO Audit')).toBeInTheDocument();
    expect(screen.queryByText('PPC Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Analytics Dashboard')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('per-group select-all checks all visible rows in that group and calls onChange', async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <ResourceSelect resources={ALL} value={selectedIds} onChange={onChange} />,
    );

    // Flush any debounce init
    await act(async () => { vi.advanceTimersByTime(250); });

    // Find "Select all" checkbox inside the Services group header
    const selectAllServicesCheckbox = screen.getByRole('checkbox', {
      name: /select all services/i,
    });

    fireEvent.click(selectAllServicesCheckbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextSet: Set<string> = onChange.mock.calls[0][0] as Set<string>;
    expect(nextSet.has('s1')).toBe(true);
    expect(nextSet.has('s2')).toBe(true);
    expect(nextSet.has('p1')).toBe(false);
    expect(nextSet.has('p2')).toBe(false);

    // Verify deselect-all works: simulate controlled re-render with all selected
    selectedIds = new Set(['s1', 's2']);
    rerender(<ResourceSelect resources={ALL} value={selectedIds} onChange={onChange} />);
    onChange.mockClear();

    const selectAllServicesCheckbox2 = screen.getByRole('checkbox', {
      name: /select all services/i,
    });
    // Should now be checked; clicking unchecks all
    fireEvent.click(selectAllServicesCheckbox2);
    expect(onChange).toHaveBeenCalledTimes(1);
    const afterDeselect: Set<string> = onChange.mock.calls[0][0] as Set<string>;
    expect(afterDeselect.has('s1')).toBe(false);
    expect(afterDeselect.has('s2')).toBe(false);

    vi.useRealTimers();
  });

  it('toggling a single row updates the controlled Set via onChange', () => {
    const { rerender } = render(
      <ResourceSelect resources={ALL} value={selectedIds} onChange={onChange} />,
    );

    const seoCheckbox = screen.getByRole('checkbox', { name: /select SEO Audit/i });
    fireEvent.click(seoCheckbox);

    expect(onChange).toHaveBeenCalledTimes(1);
    const next: Set<string> = onChange.mock.calls[0][0] as Set<string>;
    expect(next.has('s1')).toBe(true);

    // Simulate controlled re-render with s1 selected, then deselect
    onChange.mockClear();
    rerender(
      <ResourceSelect resources={ALL} value={new Set(['s1'])} onChange={onChange} />,
    );
    const seoCheckbox2 = screen.getByRole('checkbox', { name: /select SEO Audit/i });
    fireEvent.click(seoCheckbox2);
    expect(onChange).toHaveBeenCalledTimes(1);
    const afterToggle: Set<string> = onChange.mock.calls[0][0] as Set<string>;
    expect(afterToggle.has('s1')).toBe(false);
  });

  it('does not throw when a resource has an undefined description', async () => {
    vi.useFakeTimers();

    // Cast needed because ResourceRow types description as string, but the DB
    // can return null/undefined at runtime.
    const withNullDesc: ResourceRow[] = [
      { id: 'sNull', type: 'service', name: 'No-Desc Service', description: undefined as unknown as string },
      ...PRODUCTS,
    ];

    expect(() =>
      render(
        <ResourceSelect resources={withNullDesc} value={selectedIds} onChange={onChange} />,
      ),
    ).not.toThrow();

    // Row must still appear by name
    expect(screen.getByText('No-Desc Service')).toBeInTheDocument();

    // Searching by a term that would hit description must not throw
    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'analytics' } });

    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    // The undefined-description service should be filtered out (name does not match)
    expect(screen.queryByText('No-Desc Service')).not.toBeInTheDocument();
    // The product with matching description should still appear
    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
