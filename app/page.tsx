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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, User, ListChecks, MousePointerClick, ArrowLeft } from 'lucide-react';
import type { ClientRow, ClientProfile, ResourceRow } from '@/lib/queries';
import ClientPicker from '@/components/ClientPicker';
import ProfilePanel from '@/components/ProfilePanel';
import ResourceSelect from '@/components/ResourceSelect';
import RunConfig from '@/components/RunConfig';
import RunHistory, { type OptimisticRun } from '@/components/RunHistory';
import ExecutionView from '@/components/ExecutionView';

interface ClientDetail {
  profile: ClientProfile;
  resources: ResourceRow[];
}

export default function HomePage() {
  // --- Primary state (lifted for Tasks 11/12) ---
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [clientDetail, setClientDetail] = useState<ClientDetail | null>(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());

  // --- Run dashboard state (multi-run) ---
  // selectedRunId: which run's detail is expanded in the dashboard.
  // optimisticRuns: runs triggered this session, shown immediately as 'queued'
  // until the engine claims them and the server list catches up.
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [optimisticRuns, setOptimisticRuns] = useState<OptimisticRun[]>([]);

  // --- Client list state ---
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);

  // --- Per-client detail state ---
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // --- UI state ---
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Right pane shows the landing prompt until the user opens "All Runs" or starts a run.
  const [showRuns, setShowRuns] = useState(false);

  // Right content pane -- scrolled to top when a run is triggered.
  const contentRef = useRef<HTMLElement>(null);

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

  // Handle run started: a new run was enqueued. Show it optimistically as
  // 'queued' and open its detail. RunConfig stays enabled, so multiple runs
  // can be triggered; the engine executes up to 5 in parallel.
  const handleRunStarted = useCallback(
    (runId: string) => {
      const clientId = selectedClient?.id ?? '';
      setOptimisticRuns((prev) =>
        prev.some((r) => r.runId === runId)
          ? prev
          : [
              { runId, clientId, resourceCount: selectedResourceIds.size, triggeredAt: Date.now() },
              ...prev,
            ],
      );
      setSelectedRunId(runId);
      setShowRuns(true);
      // Scroll the content pane (and window) to the top so the new run is visible.
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [selectedClient, selectedResourceIds],
  );

  // clientId -> name map for the run dashboard labels.
  const clientNames = React.useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients],
  );

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
      {/* Header -- sticky on top */}
      <header className="sticky top-0 z-30 bg-surface border-b border-border h-14 px-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center">
          <img src="/gush_logo.svg" width="22" height="22" alt="Gushwork" />
          <span className="ml-3 text-sm font-semibold text-on-surface">Agentic AKR</span>
          <span className="ml-2 text-xs text-on-surface-muted">Keyword Research Pipeline</span>
        </div>
        <button
          type="button"
          aria-label="Show all runs"
          onClick={() => { setShowRuns(true); setSelectedRunId(null); }}
          className="bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-xs text-on-surface hover:bg-border cursor-pointer flex items-center gap-2 min-h-[44px]"
        >
          <ListChecks size={14} aria-hidden="true" />
          All Runs
        </button>
      </header>

      {/* Main grid */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left aside */}
        {sidebarOpen ? (
          <aside className="w-[372px] flex-shrink-0 border-r border-border bg-surface flex flex-col overflow-y-auto relative">
            {/* ClientPicker card -- collapse button is aligned to the search bar */}
            <div className="rounded-xl bg-surface border border-border mx-3 mt-3 mb-2 p-4">
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
                rightAction={
                  <button
                    type="button"
                    aria-label="Collapse sidebar"
                    onClick={() => setSidebarOpen(false)}
                    className="shrink-0 p-2 rounded-lg border border-border hover:bg-surface-muted text-on-surface-muted cursor-pointer flex items-center justify-center h-[38px] w-[38px]"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                  </button>
                }
              />
            </div>

            {/* Client workspace -- one cohesive panel (profile + resources + run
                config) with a SINGLE loading/empty state, so picking a client
                reads as one step instead of three sequential cards. */}
            <div className="rounded-xl bg-surface border border-border mx-3 my-2 overflow-hidden">
              {!selectedClient ? (
                <p className="p-4 text-sm text-on-surface-muted">
                  Select a client above to view its profile, choose resources, and run AKR.
                </p>
              ) : detailError ? (
                <div
                  role="alert"
                  className="m-4 flex items-center gap-2 rounded-md bg-danger-surface px-3 py-2 text-sm text-danger"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  {detailError}
                </div>
              ) : detailLoading || !clientDetail ? (
                /* Single unified skeleton covering profile + resources */
                <div className="p-4 animate-pulse space-y-3" aria-label="Loading client">
                  <div className="h-4 bg-surface-muted rounded w-3/4" />
                  <div className="h-4 bg-surface-muted rounded w-1/2" />
                  <div className="h-px bg-border my-2" />
                  <div className="h-8 bg-surface-muted rounded w-full" />
                  <div className="h-10 bg-surface-muted rounded w-full" />
                  <div className="h-10 bg-surface-muted rounded w-full" />
                </div>
              ) : (
                <>
                  {/* Profile */}
                  <section className="p-4">
                    <div className="flex items-center gap-1.5 mb-3">
                      <User size={14} aria-hidden="true" className="text-on-surface-muted" />
                      <span className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider">Profile</span>
                    </div>
                    <ProfilePanel profile={clientDetail.profile} />
                  </section>

                  <div className="border-t border-border" />

                  {/* Resources */}
                  <section className="p-4">
                    <ResourceSelect
                      resources={clientDetail.resources}
                      value={selectedResourceIds}
                      onChange={setSelectedResourceIds}
                    />
                  </section>

                  <div className="border-t border-border" />

                  {/* Run config */}
                  <section className="p-4">
                    <RunConfig
                      clientId={selectedClient.id}
                      selectedResourceIds={selectedResourceIds}
                      targetGeoDefault={clientDetail.profile.geo.targetGeographies[0] ?? ''}
                      onRunStarted={handleRunStarted}
                      disabled={false}
                    />
                  </section>
                </>
              )}
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

        {/* Right content section -- three distinct views:
            1. Run View: a single run's live/replay detail (when a run is selected)
            2. Past Runs View: the run list (when "All Runs" is open)
            3. Landing prompt (default) */}
        <section ref={contentRef} className="flex-1 overflow-y-auto p-4">
          {selectedRunId ? (
            /* --- Run View (dedicated, full pane) --- */
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setSelectedRunId(null)}
                className="self-start inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-on-surface hover:bg-surface-muted cursor-pointer"
              >
                <ArrowLeft size={13} aria-hidden="true" />
                All Runs
              </button>
              <ExecutionView
                key={selectedRunId}
                runId={selectedRunId}
                resourceNames={Object.fromEntries(
                  (clientDetail?.resources ?? []).map((r) => [r.id, r.name]),
                )}
              />
            </div>
          ) : showRuns ? (
            /* --- Past Runs View (list) --- */
            <RunHistory
              selectedRunId={null}
              onSelectRun={setSelectedRunId}
              optimisticRuns={optimisticRuns}
              clientNames={clientNames}
              scopeClientId={selectedClient?.id ?? null}
            />
          ) : (
            /* --- Landing prompt --- */
            <div className="flex flex-col items-center justify-center h-full text-center text-on-surface-muted px-6">
              <MousePointerClick size={40} aria-hidden="true" className="mb-4 opacity-30" />
              <p className="text-base font-medium text-on-surface">Choose a client to initiate runs</p>
              <p className="text-sm mt-1 max-w-sm">
                Select a client and resources on the left, then Run AKR. View past runs anytime via &ldquo;All Runs&rdquo;.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
