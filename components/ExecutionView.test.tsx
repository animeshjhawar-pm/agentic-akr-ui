// components/ExecutionView.test.tsx
//
// RTL tests for the tabbed ExecutionView:
// - 4 tabs render with role=tab (Commentary, Events, Keywords, Clusters)
//   NOTE: Artifacts tab removed -- hosted UI uses Supabase polling (no local S3).
// - TotalsHeader stays visible across tab switches
// - "Events" tab shows the event log with a Linear/Tree toggle
// - Clicking Commentary tab renders Commentary component
// - Clicking Keywords tab shows Results (or placeholder pre-completion)
// - Clicking Clusters tab shows Clusters component
// - Arrow-key navigation moves focus between tabs (wraps at 4)
// - Default tab is "Events" while running; auto-switches to Keywords when done
// - Linear/Tree toggle: default Tree; toggle switches view; aria-pressed reflects state
//
// ADAPTED from the original test which referenced useRunStream + Artifacts.
// useRunStream mock renamed to useRunPolling; reader prop removed; Artifacts
// tests removed.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import ExecutionView from './ExecutionView';

// ---------------------------------------------------------------------------
// Mock useRunPolling
// ---------------------------------------------------------------------------

const mockUseRunPolling = vi.fn();

vi.mock('@/lib/useRunPolling', () => ({
  useRunPolling: (...args: unknown[]) => mockUseRunPolling(...args),
}));

// ---------------------------------------------------------------------------
// Mock child components -- we only care that ExecutionView wires them up
// ---------------------------------------------------------------------------

vi.mock('./EventLog', () => ({
  default: ({ log, selectedStage }: { log: unknown[]; selectedStage: string | null }) => (
    <div data-testid="event-log" data-stage={String(selectedStage)}>
      EventLog({(log as unknown[]).length} events)
    </div>
  ),
}));

vi.mock('./TreeEventLog', () => ({
  default: ({ log, selectedStage }: { log: unknown[]; selectedStage: string | null }) => (
    <div data-testid="tree-event-log" data-stage={String(selectedStage)}>
      TreeEventLog({(log as unknown[]).length} events)
    </div>
  ),
}));

vi.mock('./Results', () => ({
  default: ({ runId }: { runId: string }) => (
    <div data-testid="results">Results({runId})</div>
  ),
}));

vi.mock('./Clusters', () => ({
  default: ({ runId }: { runId: string }) => (
    <div data-testid="clusters">Clusters({runId})</div>
  ),
}));

vi.mock('./Commentary', () => ({
  default: ({ events }: { events: unknown[] }) => (
    <div data-testid="commentary">Commentary({(events as unknown[]).length} events)</div>
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_POLL_STATE = {
  stages: {},
  log: [],
  totals: { spend: 0.0042, selected: 7, pages: 3 },
  streamDone: false,
  stalled: false,
  error: null,
};

const DONE_POLL_STATE = {
  ...BASE_POLL_STATE,
  streamDone: true,
};

const STALLED_POLL_STATE = {
  ...BASE_POLL_STATE,
  stalled: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExecutionView (tabbed -- polling)', () => {
  beforeEach(() => {
    mockUseRunPolling.mockReturnValue(BASE_POLL_STATE);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---- Tab structure -------------------------------------------------------

  it('renders 4 tabs with role=tab (no Artifacts in hosted UI)', () => {
    render(<ExecutionView runId="run-1" />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
  });

  it('tabs are labelled Commentary, Events, Keywords, Clusters', () => {
    render(<ExecutionView runId="run-1" />);

    expect(screen.getByRole('tab', { name: /^commentary$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^events$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^keywords$/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^clusters$/i })).toBeInTheDocument();
  });

  it('does not render an Artifacts tab', () => {
    render(<ExecutionView runId="run-1" />);
    expect(screen.queryByRole('tab', { name: /^artifacts$/i })).not.toBeInTheDocument();
  });

  it('has a tablist', () => {
    render(<ExecutionView runId="run-1" />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  // ---- TotalsHeader always visible -----------------------------------------

  it('TotalsHeader is visible on Events tab', () => {
    render(<ExecutionView runId="run-1" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('TotalsHeader stays visible when switching to Clusters tab', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^clusters$/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('TotalsHeader stays visible when switching to Keywords tab', () => {
    mockUseRunPolling.mockReturnValue(DONE_POLL_STATE);
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^keywords$/i }));

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // ---- Default tab = Events while running -----------------------

  it('Events panel is visible by default (running state)', () => {
    render(<ExecutionView runId="run-1" />);

    expect(screen.getByTestId('tree-event-log')).toBeInTheDocument();
  });

  it('Events tab has aria-selected=true by default', () => {
    render(<ExecutionView runId="run-1" />);

    const tab = screen.getByRole('tab', { name: /^events$/i });
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  // ---- Events panel shows event log section (no pipeline grid) --------------

  it('Events tab shows event log section', () => {
    render(<ExecutionView runId="run-1" />);

    // Default view is Tree
    expect(screen.getByTestId('tree-event-log')).toBeInTheDocument();
  });

  it('Events tab does NOT show pipeline-grid', () => {
    render(<ExecutionView runId="run-1" />);

    expect(screen.queryByTestId('pipeline-grid')).not.toBeInTheDocument();
  });

  // ---- Linear/Tree toggle --------------------------------------------------

  it('default event view is Tree (TreeEventLog visible, EventLog hidden)', () => {
    render(<ExecutionView runId="run-1" />);

    expect(screen.getByTestId('tree-event-log')).toBeInTheDocument();
    expect(screen.queryByTestId('event-log')).not.toBeInTheDocument();
  });

  it('Tree toggle button has aria-pressed=true by default', () => {
    render(<ExecutionView runId="run-1" />);

    const treeBtn = screen.getByRole('button', { name: /tree/i });
    expect(treeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('Linear toggle button has aria-pressed=false by default', () => {
    render(<ExecutionView runId="run-1" />);

    const linearBtn = screen.getByRole('button', { name: /linear/i });
    expect(linearBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Linear toggle switches to EventLog', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('button', { name: /linear/i }));

    expect(screen.getByTestId('event-log')).toBeInTheDocument();
    expect(screen.queryByTestId('tree-event-log')).not.toBeInTheDocument();
  });

  it('clicking Linear toggle sets its aria-pressed=true and Tree aria-pressed=false', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('button', { name: /linear/i }));

    expect(screen.getByRole('button', { name: /linear/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /tree/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('clicking Tree toggle after Linear switches back to TreeEventLog', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('button', { name: /linear/i }));
    fireEvent.click(screen.getByRole('button', { name: /tree/i }));

    expect(screen.getByTestId('tree-event-log')).toBeInTheDocument();
    expect(screen.queryByTestId('event-log')).not.toBeInTheDocument();
  });

  // ---- Clicking Keywords tab -----------------------------------------------

  it('clicking Keywords tab shows Results component when run is complete', () => {
    mockUseRunPolling.mockReturnValue(DONE_POLL_STATE);
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^keywords$/i }));

    expect(screen.getByTestId('results')).toBeInTheDocument();
  });

  it('clicking Keywords tab shows placeholder when run is not yet complete', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^keywords$/i }));

    expect(screen.queryByTestId('results')).not.toBeInTheDocument();
    // Placeholder text (no em/en dashes)
    expect(screen.getByText(/results appear when the run completes/i)).toBeInTheDocument();
  });

  // ---- Clicking Commentary tab ---------------------------------------------

  it('clicking Commentary tab shows Commentary component', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^commentary$/i }));

    expect(screen.getByTestId('commentary')).toBeInTheDocument();
  });

  it('clicking Commentary tab hides the events panel', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^commentary$/i }));

    expect(screen.queryByTestId('tree-event-log')).not.toBeInTheDocument();
  });

  // ---- Clicking Clusters tab -----------------------------------------------

  it('clicking Clusters tab shows Clusters component', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^clusters$/i }));

    expect(screen.getByTestId('clusters')).toBeInTheDocument();
  });

  it('Clusters panel passes correct runId', () => {
    render(<ExecutionView runId="run-xyz" />);

    fireEvent.click(screen.getByRole('tab', { name: /^clusters$/i }));

    expect(screen.getByTestId('clusters')).toHaveTextContent('run-xyz');
  });

  // ---- Auto-switch to Keywords when done ------------------------------------

  it('auto-switches to Keywords tab when streamDone becomes true', async () => {
    mockUseRunPolling.mockReturnValue(BASE_POLL_STATE);
    const { rerender } = render(<ExecutionView runId="run-1" />);

    // Initially on Events
    expect(screen.getByRole('tab', { name: /^events$/i })).toHaveAttribute('aria-selected', 'true');

    // Run completes
    mockUseRunPolling.mockReturnValue(DONE_POLL_STATE);
    rerender(<ExecutionView runId="run-1" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^keywords$/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('does not auto-switch back after user manually picks Clusters', async () => {
    mockUseRunPolling.mockReturnValue(DONE_POLL_STATE);
    const { rerender } = render(<ExecutionView runId="run-1" />);

    // Auto-switched to Keywords because done
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^keywords$/i })).toHaveAttribute('aria-selected', 'true');
    });

    // User manually switches to Clusters
    fireEvent.click(screen.getByRole('tab', { name: /^clusters$/i }));
    expect(screen.getByRole('tab', { name: /^clusters$/i })).toHaveAttribute('aria-selected', 'true');

    // Re-render with same done state -- should NOT fight user's choice
    rerender(<ExecutionView runId="run-1" />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /^clusters$/i })).toHaveAttribute('aria-selected', 'true');
    });
  });

  // ---- onStreamDone callback (run lifecycle) -------------------------------

  it('does not call onStreamDone while the run is still running', () => {
    const onStreamDone = vi.fn();
    mockUseRunPolling.mockReturnValue(BASE_POLL_STATE);
    render(<ExecutionView runId="run-1" onStreamDone={onStreamDone} />);
    expect(onStreamDone).not.toHaveBeenCalled();
  });

  it('calls onStreamDone once when the run finishes', async () => {
    const onStreamDone = vi.fn();
    mockUseRunPolling.mockReturnValue(BASE_POLL_STATE);
    const { rerender } = render(
      <ExecutionView runId="run-1" onStreamDone={onStreamDone} />,
    );
    expect(onStreamDone).not.toHaveBeenCalled();

    mockUseRunPolling.mockReturnValue(DONE_POLL_STATE);
    rerender(<ExecutionView runId="run-1" onStreamDone={onStreamDone} />);

    await waitFor(() => expect(onStreamDone).toHaveBeenCalledTimes(1));

    // A further re-render with the same done state must not fire again.
    rerender(<ExecutionView runId="run-1" onStreamDone={onStreamDone} />);
    expect(onStreamDone).toHaveBeenCalledTimes(1);
  });

  // ---- Stall detection indicator -------------------------------------------

  it('shows "Running" status when not stalled', () => {
    mockUseRunPolling.mockReturnValue(BASE_POLL_STATE);
    render(<ExecutionView runId="run-1" />);
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.queryByText('Stalled')).not.toBeInTheDocument();
  });

  it('shows "Stalled" status when polling has stalled', () => {
    mockUseRunPolling.mockReturnValue(STALLED_POLL_STATE);
    render(<ExecutionView runId="run-1" />);
    expect(screen.getByText('Stalled')).toBeInTheDocument();
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });

  it('shows "Complete" (not "Stalled") once done even if stalled flag lingers', () => {
    mockUseRunPolling.mockReturnValue({ ...STALLED_POLL_STATE, streamDone: true });
    render(<ExecutionView runId="run-1" />);
    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.queryByText('Stalled')).not.toBeInTheDocument();
  });

  // ---- Arrow key navigation (4 tabs) --------------------------------------

  it('ArrowRight moves focus from Events to Keywords', () => {
    render(<ExecutionView runId="run-1" />);

    const eventsTab = screen.getByRole('tab', { name: /^events$/i });
    eventsTab.focus();
    fireEvent.keyDown(eventsTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: /^keywords$/i })).toHaveFocus();
  });

  it('ArrowRight moves focus from Keywords to Clusters', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^keywords$/i }));
    const keywordsTab = screen.getByRole('tab', { name: /^keywords$/i });
    keywordsTab.focus();
    fireEvent.keyDown(keywordsTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: /^clusters$/i })).toHaveFocus();
  });

  it('ArrowRight wraps from Clusters back to Commentary (idx 0)', () => {
    render(<ExecutionView runId="run-1" />);

    fireEvent.click(screen.getByRole('tab', { name: /^clusters$/i }));
    const clustersTab = screen.getByRole('tab', { name: /^clusters$/i });
    clustersTab.focus();
    fireEvent.keyDown(clustersTab, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: /^commentary$/i })).toHaveFocus();
  });

  it('ArrowLeft wraps from Commentary (idx 0) to Clusters', () => {
    render(<ExecutionView runId="run-1" />);

    const commentaryTab = screen.getByRole('tab', { name: /^commentary$/i });
    commentaryTab.focus();
    fireEvent.keyDown(commentaryTab, { key: 'ArrowLeft' });

    expect(screen.getByRole('tab', { name: /^clusters$/i })).toHaveFocus();
  });

  it('ArrowLeft wraps from Events to Commentary', () => {
    render(<ExecutionView runId="run-1" />);

    const eventsTab = screen.getByRole('tab', { name: /^events$/i });
    eventsTab.focus();
    fireEvent.keyDown(eventsTab, { key: 'ArrowLeft' });

    expect(screen.getByRole('tab', { name: /^commentary$/i })).toHaveFocus();
  });

  // ---- Tabpanel aria -------------------------------------------------------

  it('visible panel has role=tabpanel', () => {
    render(<ExecutionView runId="run-1" />);

    const panels = screen.getAllByRole('tabpanel');
    expect(panels.length).toBeGreaterThanOrEqual(1);
  });

  // ---- No reader prop (polling model) -------------------------------------

  it('renders without a reader prop (polling model)', () => {
    // This test fails to compile if ExecutionView still requires reader prop
    expect(() => render(<ExecutionView runId="run-1" />)).not.toThrow();
  });
});
