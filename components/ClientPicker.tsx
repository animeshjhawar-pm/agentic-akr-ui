'use client';

/**
 * ClientPicker
 *
 * Searchable list of clients. Debounced filter by name.
 * Lifts selected client via onSelect.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { ClientRow } from '@/lib/queries';

interface ClientPickerProps {
  clients: ClientRow[];
  selectedId: string | null;
  onSelect: (client: ClientRow) => void;
  loading?: boolean;
  /** Optional control rendered on the search row, right-aligned (e.g. collapse). */
  rightAction?: React.ReactNode;
}

function useDebounce(val: string, delay: number): string {
  const [d, setD] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setD(val), delay);
    return () => clearTimeout(t);
  }, [val, delay]);
  return d;
}

export default function ClientPicker({
  clients,
  selectedId,
  onSelect,
  loading = false,
  rightAction,
}: ClientPickerProps) {
  const [searchRaw, setSearchRaw] = useState('');
  const query = useDebounce(searchRaw, 200);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : clients;

  return (
    <div className="flex flex-col gap-2">
      {/* Label row -- collapse action (if provided) aligns to the "Client" label */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="client-search"
          className="text-sm font-semibold text-on-surface"
        >
          Client
        </label>
        {rightAction}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id="client-search"
          type="search"
          placeholder="Search clients..."
          value={searchRaw}
          onChange={(e) => setSearchRaw(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface-muted pl-8 pr-3 py-2 text-sm text-on-surface placeholder:text-on-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
          aria-label="Search clients"
          aria-autocomplete="list"
          aria-controls="client-list"
        />
      </div>

      {/* Client list */}
      <ul
        id="client-list"
        role="listbox"
        aria-label="Client list"
        className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface divide-y divide-border"
      >
        {loading && (
          <li className="px-3 py-2 text-sm text-on-surface-muted">
            Loading clients...
          </li>
        )}
        {!loading && filtered.length === 0 && (
          <li className="px-3 py-2 text-sm text-on-surface-muted">
            No clients found.
          </li>
        )}
        {!loading &&
          filtered.map((client) => {
            const isSelected = client.id === selectedId;
            return (
              <li
                key={client.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(client)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(client);
                  }
                }}
                tabIndex={0}
                className={`px-3 py-2 text-sm cursor-pointer select-none motion-safe:transition-colors focus-visible:outline-2 focus-visible:outline-primary ${
                  isSelected
                    ? 'bg-primary text-primary-fg font-medium'
                    : 'text-on-surface hover:bg-surface-muted'
                }`}
              >
                {client.name}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
