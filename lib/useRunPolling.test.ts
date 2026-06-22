/**
 * useRunPolling tests
 *
 * Tests use fake timers + a mocked fetch to verify:
 * - Two batches of events are folded incrementally and the cursor advances.
 * - When status becomes 'complete', polling stops (fetch is not called again).
 * - Stall detection: if no new events arrive for STALL_TIMEOUT_MS, stalled becomes true.
 * - Null runId: no fetch, initial state returned.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRunPolling, STALL_TIMEOUT_MS } from './useRunPolling';
import type { RunEvent } from './events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(_stage: string, seq: number): RunEvent {
  return {
    ts: 1000 + seq,
    stage: 'planner',
    type: 'decision',
    step: `step-${seq}`,
    rationale: `r${seq}`,
  } as RunEvent;
}

function makeRunCompleteEvent(): RunEvent {
  return {
    ts: 9999,
    stage: 'run',
    type: 'complete',
    pages: 3,
    selected: 10,
    spend: 1.23,
  } as RunEvent;
}

function makeResponse(
  events: RunEvent[],
  maxSeq: number,
  status: string,
): Response {
  const body = JSON.stringify({ runId: 'run-1', events, maxSeq, status });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useRunPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ---- null runId: no fetch, returns initial state -------------------------

  it('returns initial state and does not fetch when runId is null', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRunPolling(null));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.streamDone).toBe(false);
    expect(result.current.stalled).toBe(false);
    expect(result.current.log).toEqual([]);
  });

  // ---- Two batches: cursor advances, events fold incrementally ------------

  it('folds two batches incrementally and advances cursor to 6', async () => {
    const batch1Events = [makeEvent('planner', 1), makeEvent('planner', 2), makeEvent('planner', 3)];
    const batch2Events = [makeEvent('planner', 4), makeEvent('planner', 5), makeEvent('planner', 6)];

    let callCount = 0;
    const fetchMock = vi.fn(async (url: string) => {
      callCount++;
      if (callCount === 1) {
        expect(String(url)).toContain('since=0');
        return makeResponse(batch1Events, 3, 'running');
      }
      if (callCount === 2) {
        expect(String(url)).toContain('since=3');
        return makeResponse(batch2Events, 6, 'complete');
      }
      return makeResponse([], 6, 'complete');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRunPolling('run-1'));

    // First poll fires immediately on mount -- advance 0ms with async handling
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.log).toHaveLength(3);
    expect(result.current.streamDone).toBe(false);

    // Advance clock past poll interval to trigger second poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001);
    });

    expect(result.current.log).toHaveLength(6);
    expect(result.current.streamDone).toBe(true);

    // Capture call count at completion
    const callsAtCompletion = fetchMock.mock.calls.length;

    // Advance clock another two intervals; fetch should NOT be called again
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(fetchMock.mock.calls.length).toBe(callsAtCompletion);
  });

  // ---- RunComplete event in batch stops polling ----------------------------

  it('stops polling when a RunComplete event arrives even if status is not terminal', async () => {
    const runCompleteEvent = makeRunCompleteEvent();

    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return makeResponse([runCompleteEvent], 1, 'running');
      }
      return makeResponse([], 1, 'running');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRunPolling('run-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.streamDone).toBe(true);
    expect(result.current.totals.spend).toBe(1.23);
    expect(result.current.totals.selected).toBe(10);
    expect(result.current.totals.pages).toBe(3);

    const callsAfterDone = fetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(fetchMock.mock.calls.length).toBe(callsAfterDone);
  });

  // ---- Stall detection: no new events for STALL_TIMEOUT_MS ---------------

  it('sets stalled=true when no new events arrive for STALL_TIMEOUT_MS', async () => {
    const fetchMock = vi.fn(async () => makeResponse([], 0, 'running'));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRunPolling('run-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.stalled).toBe(false);

    // Advance past the stall timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS + 100);
    });

    expect(result.current.stalled).toBe(true);
    expect(result.current.streamDone).toBe(false);
  }, 10000);

  // ---- Stall clears when new events arrive --------------------------------

  it('clears stalled when new events arrive after stall', async () => {
    let hasEvents = false;

    const fetchMock = vi.fn(async () => {
      if (hasEvents) {
        return makeResponse([makeEvent('planner', 7)], 7, 'running');
      }
      return makeResponse([], 0, 'running');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useRunPolling('run-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Advance past stall
    await act(async () => {
      await vi.advanceTimersByTimeAsync(STALL_TIMEOUT_MS + 100);
    });

    expect(result.current.stalled).toBe(true);

    // New events arrive on next poll
    hasEvents = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2001);
    });

    expect(result.current.stalled).toBe(false);
  }, 10000);

  // ---- Cleanup on unmount -------------------------------------------------

  it('stops polling on unmount', async () => {
    const fetchMock = vi.fn(async () => makeResponse([], 0, 'running'));
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useRunPolling('run-1'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const callsBeforeUnmount = fetchMock.mock.calls.length;

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    // No additional calls after unmount
    expect(fetchMock.mock.calls.length).toBe(callsBeforeUnmount);
  });

  // ---- runId change resets state ------------------------------------------

  it('resets state and restarts polling when runId changes', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('run-A')) {
        return makeResponse([makeEvent('planner', 1)], 1, 'running');
      }
      return makeResponse([makeEvent('planner', 2), makeEvent('planner', 3)], 3, 'running');
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useRunPolling(id),
      { initialProps: { id: 'run-A' } },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.log).toHaveLength(1);

    // Change runId -- state resets to initial, new runId starts polling
    rerender({ id: 'run-B' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // State resets on runId change; run-B returns 2 events
    expect(result.current.log).toHaveLength(2);
  });
});
