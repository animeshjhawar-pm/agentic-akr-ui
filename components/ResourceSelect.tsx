'use client';

/**
 * ResourceSelect
 *
 * Two collapsible groups (Services / Products). Each row: checkbox + name +
 * truncated description. Per-group select-all. Debounced search. Virtualized
 * list per group via @tanstack/react-virtual. Controlled: value + onChange.
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ResourceRow } from '@/lib/queries';

interface ResourceSelectProps {
  resources: ResourceRow[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}

function useDebounce(val: string, delay: number): string {
  const [debounced, setDebounced] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(val), delay);
    return () => clearTimeout(t);
  }, [val, delay]);
  return debounced;
}

interface GroupProps {
  label: string;
  groupType: 'service' | 'product';
  rows: ResourceRow[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
}

function ResourceGroup({ label, groupType, rows, value, onChange }: GroupProps) {
  const [open, setOpen] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  const allSelected = rows.length > 0 && rows.every((r) => value.has(r.id));
  const someSelected = rows.some((r) => value.has(r.id));

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    getItemKey: (i) => rows[i].id,
    overscan: 5,
  });

  const handleSelectAll = useCallback(() => {
    const next = new Set(value);
    if (allSelected) {
      rows.forEach((r) => next.delete(r.id));
    } else {
      rows.forEach((r) => next.add(r.id));
    }
    onChange(next);
  }, [allSelected, rows, value, onChange]);

  const handleToggle = useCallback(
    (id: string) => {
      const next = new Set(value);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onChange(next);
    },
    [value, onChange],
  );

  const selectedCount = rows.filter((r) => value.has(r.id)).length;

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-muted select-none">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected && !allSelected;
          }}
          onChange={handleSelectAll}
          aria-label={`Select all ${label}`}
          className="cursor-pointer accent-primary h-4 w-4 rounded"
        />
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`group-${groupType}`}
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1 cursor-pointer text-sm font-semibold text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
        >
          {open ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
          {label}
        </button>
        <span className="tabular-nums text-xs text-on-surface-muted ml-auto">
          {selectedCount}/{rows.length}
        </span>
      </div>

      {/* Virtualized rows */}
      {open && (
        <div
          id={`group-${groupType}`}
          ref={parentRef}
          style={{ maxHeight: '280px', overflowY: 'auto' }}
          className="bg-surface-elevated"
        >
          <div
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((vItem) => {
              const row = rows[vItem.index];
              const checked = value.has(row.id);
              return (
                <div
                  key={vItem.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: `${vItem.start}px`,
                    left: 0,
                    right: 0,
                  }}
                  className="flex items-start gap-3 px-3 py-2 border-b border-border last:border-b-0 hover:bg-surface-muted"
                >
                  <input
                    type="checkbox"
                    id={`res-${row.id}`}
                    checked={checked}
                    onChange={() => handleToggle(row.id)}
                    aria-label={`Select ${row.name}`}
                    className="cursor-pointer accent-primary mt-0.5 h-4 w-4 shrink-0 rounded"
                  />
                  <label
                    htmlFor={`res-${row.id}`}
                    className="cursor-pointer flex-1 min-w-0"
                  >
                    <span className="block text-sm font-medium text-on-surface truncate">
                      {row.name}
                    </span>
                    <span className="block text-xs text-on-surface-muted line-clamp-1 truncate">
                      {row.description ?? ''}
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResourceSelect({ resources, value, onChange }: ResourceSelectProps) {
  const [searchRaw, setSearchRaw] = useState('');
  const query = useDebounce(searchRaw, 200);

  const totalSelected = value.size;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resources;
    return resources.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  }, [resources, query]);

  const services = useMemo(
    () => filtered.filter((r) => r.type === 'service'),
    [filtered],
  );
  const products = useMemo(
    () => filtered.filter((r) => r.type === 'product'),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-on-surface">Resources</h2>
        <span className="tabular-nums text-xs text-on-surface-muted">
          {totalSelected} selected
        </span>
      </div>

      {/* Search */}
      <div>
        <label htmlFor="resource-search" className="sr-only">
          Search resources
        </label>
        <input
          id="resource-search"
          type="search"
          role="searchbox"
          placeholder="Search services and products..."
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
        />
      </div>

      {/* Groups */}
      <div className="flex flex-col gap-2">
        {services.length > 0 && (
          <ResourceGroup
            label="Services"
            groupType="service"
            rows={services}
            value={value}
            onChange={onChange}
          />
        )}
        {products.length > 0 && (
          <ResourceGroup
            label="Products"
            groupType="product"
            rows={products}
            value={value}
            onChange={onChange}
          />
        )}
        {filtered.length === 0 && (
          <p className="text-sm text-on-surface-muted text-center py-6">
            No resources match your search.
          </p>
        )}
      </div>
    </div>
  );
}
