'use client';

/**
 * ResourceSelect
 *
 * Two collapsible groups (Services / Products). Each row: checkbox + name +
 * truncated description. Per-group select-all. Debounced search. Virtualized
 * list per group via @tanstack/react-virtual. Controlled: value + onChange.
 *
 * Interaction:
 *   - Clicking the checkbox toggles selection.
 *   - Clicking the row body opens a read-only detail dialog (each field shown
 *     as a labelled, non-editable field) with Close / Select(Deselect) CTAs.
 *
 * The whole Resources section can also be collapsed via the header toggle.
 */

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
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
  onOpenDetail: (row: ResourceRow) => void;
}

function ResourceGroup({ label, groupType, rows, value, onChange, onOpenDetail }: GroupProps) {
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
                  {/* Row body opens the detail dialog (does NOT toggle selection). */}
                  <button
                    type="button"
                    onClick={() => onOpenDetail(row)}
                    aria-label={`View details for ${row.name}`}
                    className="cursor-pointer flex-1 min-w-0 text-left focus-visible:outline-2 focus-visible:outline-primary rounded"
                  >
                    <span className="block text-sm font-medium text-on-surface truncate">
                      {row.name}
                    </span>
                    <span className="block text-xs text-on-surface-muted line-clamp-1 truncate">
                      {row.description ?? ''}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResourceDetailDialog -- read-only field viewer with Close / Select CTA
// ---------------------------------------------------------------------------

interface ResourceDetailDialogProps {
  row: ResourceRow;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onClose: () => void;
}

function ReadonlyField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-on-surface-muted uppercase tracking-wider">{label}</span>
      {multiline ? (
        <textarea
          readOnly
          value={value}
          rows={6}
          className="w-full resize-none rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-on-surface focus:outline-none"
        />
      ) : (
        <input
          readOnly
          value={value}
          className="w-full rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-on-surface focus:outline-none"
        />
      )}
    </div>
  );
}

function ResourceDetailDialog({ row, selected, onToggleSelect, onClose }: ResourceDetailDialogProps) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Resource details: ${row.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-on-surface truncate">{row.name}</h3>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-muted text-on-surface-muted cursor-pointer flex items-center justify-center min-h-[36px] min-w-[36px]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Read-only fields */}
        <div className="flex flex-col gap-4 px-5 py-4 max-h-[60vh] overflow-y-auto">
          <ReadonlyField label="Name" value={row.name} />
          <ReadonlyField label="Type" value={row.type} />
          <ReadonlyField label="ID" value={row.id} />
          <ReadonlyField label="Description" value={row.description ?? ''} multiline />
        </div>

        {/* Footer CTAs */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-surface px-4 py-2 min-h-[40px] text-sm text-on-surface hover:bg-surface-muted cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onToggleSelect(row.id);
              onClose();
            }}
            className={[
              'rounded-lg px-4 py-2 min-h-[40px] text-sm font-semibold cursor-pointer',
              selected
                ? 'border border-border bg-surface text-on-surface hover:bg-surface-muted'
                : 'bg-primary text-primary-fg hover:bg-primary-hover',
            ].join(' ')}
          >
            {selected ? 'Deselect' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResourceSelect({ resources, value, onChange }: ResourceSelectProps) {
  const [searchRaw, setSearchRaw] = useState('');
  const query = useDebounce(searchRaw, 200);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [detailRow, setDetailRow] = useState<ResourceRow | null>(null);

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

  const handleToggleSelect = useCallback(
    (id: string) => {
      const next = new Set(value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(next);
    },
    [value, onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Header row -- toggles the whole section */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-expanded={sectionOpen}
          aria-controls="resources-section"
          onClick={() => setSectionOpen((o) => !o)}
          className="flex items-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-primary rounded"
        >
          {sectionOpen ? (
            <ChevronDown size={16} aria-hidden="true" className="text-on-surface-muted" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" className="text-on-surface-muted" />
          )}
          <h2 className="text-sm font-semibold text-on-surface">Resources</h2>
        </button>
        <span className="tabular-nums text-xs text-on-surface-muted">
          {totalSelected} selected
        </span>
      </div>

      {sectionOpen && (
        <div id="resources-section" className="flex flex-col gap-3">
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
                onOpenDetail={setDetailRow}
              />
            )}
            {products.length > 0 && (
              <ResourceGroup
                label="Products"
                groupType="product"
                rows={products}
                value={value}
                onChange={onChange}
                onOpenDetail={setDetailRow}
              />
            )}
            {filtered.length === 0 && (
              <p className="text-sm text-on-surface-muted text-center py-6">
                No resources match your search.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Detail dialog */}
      {detailRow && (
        <ResourceDetailDialog
          row={detailRow}
          selected={value.has(detailRow.id)}
          onToggleSelect={handleToggleSelect}
          onClose={() => setDetailRow(null)}
        />
      )}
    </div>
  );
}
