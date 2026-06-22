'use client';

/**
 * AKR UI - Main Page
 *
 * State lifted here:
 *   selectedClient: ClientRow | null
 *   clientDetail: { profile: ClientProfile; resources: ResourceRow[] } | null
 *   selectedResourceIds: Set<string>
 *
 * These will be consumed by RunConfig (Task 11) and ExecutionView (Task 12).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, History, ChevronLeft, ChevronRight, User, Activity } from 'lucide-react';
import type { ClientRow, ClientProfile, ResourceRow } from '@/lib/queries';
import ClientPicker from '@/components/ClientPicker';
import ProfilePanel from '@/components/ProfilePanel';
import ResourceSelect from '@/components/ResourceSelect';
import RunConfig from '@/components/RunConfig';
import ExecutionView from '@/components/ExecutionView';
import RunHistory from '@/components/RunHistory';

interface ClientDetail {
  profile: ClientProfile;
  resources: ResourceRow[];
}

type RunState = 'idle' | 'running' | 'done';

export default function HomePage() {
  // --- Primary state (lifted for Tasks 11/12) ---
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());

  // --- Run state (lifted for Tasks 11/12) ---
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>('idle');
  const [activeReader, setActiveReader] = useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // --- Client list state ---
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);

  // --- Per-client detail state ---
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // --- UI state ---
  const [showHistory, setShowHistory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch client list on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/clients');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { clients: ClientRow[] };
        if (!cancelled) {
          setClients(data.clients ?? []);
          setClientsLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setClientsError(err instanceof Error ? err.message : 'Failed to load clients');
          setClientsLoading(false);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // Handle run started: receive runId + open SSE reader, hand off to ExecutionView
  const handleRunStarted = useCallback(
    (runId: string, reader: ReadableStreamDefaultReader<Uint8Array>) => {
      setActiveRunId(runId);
      setRunState('running');
      setActiveReader(reader);
    },
    [],
  );

  // ExecutionView reports the SSE stream finished. Move the lifecycle to 'done'
  // so RunConfig re-enables and the user can start a second run without a refresh.
  const handleStreamDone = useCallback(() => {
    setRunState((s) => (s === 'running' ? 'done' : s));
  }, []);

  // Fetch client detail when selection changes
  const handleSelectClient = useCallback((client: ClientRow) => {
    setSelectedClient(client);
    setClientDetail(null);
    setSelectedResourceIds(new Set());
    setDetailError(null);
    setDetailLoading(true);

    fetch(`/api/clients/${client.id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ profile: ClientProfile; resources: ResourceRow[] }>;
      })
      .then((data) => {
        setClientDetail({ profile: data.profile, resources: data.resources ?? [] });
      })
      .catch((err: unknown) => {
        setDetailError(err instanceof Error ? err.message : 'Failed to load client profile');
      })
      .finally(() => {
        setDetailLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-border h-14 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <img src="/gush_logo.svg" width="22" height="22" alt="Gushwork" />
          <span className="ml-3 text-sm font-semibold text-on-surface">Agentic AKR</span>
          <span className="ml-2 text-xs text-on-surface-muted">Keyword Research Pipeline</span>
        </div>
        <button
          type="button"
          aria-label="Toggle run history"
          onClick={() => setShowHistory((h) => !h)}
          className="bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-on-surface hover:bg-border cursor-pointer flex items-center gap-2 min-h-[44px]"
        >
          <History size={14} aria-hidden="true" />
          Run History
        </button>
      </header>

      {/* Main grid */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left aside */}
        {sidebarOpen ? (
          <aside className="w-[372px] flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-y-auto relative">
            {/* Collapse button */}
            <div className="flex justify-end px-3 pt-3">
              <button
                type="button"
                aria-label="Collapse sidebar"
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded hover:bg-surface-muted text-on-surface-muted cursor-pointer flex items-center justify-center min-h-[44px] min-w-[44px]"
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
            </div>

            {/* ClientPicker card */}
            <div className="rounded-xl bg-surface border border-border mx-3 my-2 p-4">
              {clientsError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-md bg-danger-surface px-3 py-2 text-sm text-danger mb-3"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  {clientsError}
                </div>
              )}
              <ClientPicker
                clients={clients}
                selectedId={selectedClient?.id ?? null}
                onSelect={handleSelectClient}
                loading={clientsLoading}
              />
            </div>

            {/* Profile card */}
            <div className="rounded-xl bg-surface border border-border mx-3 my-2 p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <User size={14} aria-hidden="true" className="text-on-surface-muted" />
                <span className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">Profile</span>
              </div>

              {!selectedClient && !detailLoading && (
                <p className="text-sm text-on-surface-muted">Select a client to view their profile.</p>
              )}

              {detailLoading && (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-surface-muted rounded w-3/4" />
                  <div className="h-4 bg-surface-muted rounded w-1/2" />
                  <div className="h-4 bg-surface-muted rounded w-2/3" />
                </div>
              )}

              {detailError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-md bg-danger-surface px-3 py-2 text-sm text-danger"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  {detailError}
                </div>
              )}

              {clientDetail && !detailLoading && (
                <ProfilePanel profile={clientDetail.profile} />
              )}
            </div>

            {/* Resource card */}
            <div className="rounded-xl bg-surface border border-border mx-3 my-2 p-4">
              {!clientDetail && !detailLoading && (
                <p className="text-sm text-on-surface-muted">
                  {selectedClient
                    ? 'Loading resources...'
                    : 'Select a client to choose resources.'}
                </p>
              )}

              {detailLoading && (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-surface-muted rounded w-1/2" />
                  <div className="h-8 bg-surface-muted rounded w-full" />
                  <div className="h-10 bg-surface-muted rounded w-full" />
                  <div className="h-10 bg-surface-muted rounded w-full" />
                </div>
              )}

              {clientDetail && !detailLoading && (
                <ResourceSelect
                  resources={clientDetail.resources}
                  value={selectedResourceIds}
                  onChange={setSelectedResourceIds}
                />
              )}
            </div>

            {/* RunConfig card -- always visible; disabled during/after a run */}
            <div className="rounded-xl bg-surface border border-border mx-3 my-2 p-4">
              <RunConfig
                clientId={selectedClient?.id ?? ''}
                selectedResourceIds={selectedResourceIds}
                targetGeoDefault={
                  clientDetail?.profile.geo.targetGeographies[0] ?? ''
                }
                onRunStarted={handleRunStarted}
                disabled={runState === 'running'}
              />
            </div>
          </aside>
        ) : (
          /* Collapsed rail */
          <aside className="w-12 flex-shrink-0 border-r border-border bg-surface flex flex-col items-center pt-3">
            <button
              type="button"
              aria-label="Expand sidebar"
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded hover:bg-surface-muted text-on-surface-muted cursor-pointer flex items-center justify-center min-h-[44px] min-w-[44px]"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </aside>
        )}

        {/* Right content section */}
        <section className="flex-1 overflow-y-auto p-4">
          {/* Execution view when running or done */}
          {(runState === 'running' || runState === 'done') && activeRunId && activeReader && (
            <ExecutionView
              key={activeRunId}
              runId={activeRunId}
              reader={activeReader}
              resourceNames={Object.fromEntries((clientDetail?.resources ?? []).map((r) => [r.id, r.name]))}
              onStreamDone={handleStreamDone}
            />
          )}

          {/* Run history */}
          {runState === 'idle' && showHistory && (
            <RunHistory />
          )}

          {/* Idle placeholder */}
          {runState === 'idle' && !showHistory && (
            <div className="flex flex-col items-center justify-center h-full text-on-surface-muted">
              <Activity size={40} aria-hidden="true" className="mb-4 opacity-30" />
              <p className="text-sm">Select a client and resources, then run AKR.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
