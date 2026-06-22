'use client';

/**
 * useRunPolling -- polls GET /api/runs/<runId>?since=<cursor> every
 * POLL_INTERVAL_MS and feeds each batch through applyEvents (incremental fold).
 *
 * Returns the same shape as the old useRunStream hook so ExecutionView needs
 * only a one-line import swap.
 *
 * Stall detection: if no new event arrives for 90 s while the run is still
 * active, `stalled` is set to true.
 *
 * Polling stops when:
 *   - the server reports a terminal status (complete/done/failed/error), OR
 *   - a RunComplete event (stage 'run', type 'complete') arrives in a batch.
 */

import { useEffect, useReducer, useRef } from 'react';
import type { RunEvent } from './events';
import { applyEvents, makeInitialState, reduceEvents, type RunReducerState } from './runReducer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STALL_TIMEOUT_MS = 90_000;

const POLL_INTERVAL_MS =
  typeof process !== 'undefined' &&
  typeof process.env.NEXT_PUBLIC_POLL_INTERVAL_MS === 'string' &&
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS.length > 0
    ? parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS, 10)
    : 2_000;

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type PollAction =
  | { type: 'reset' }
  | { type: 'append'; events: RunEvent[] }
  | { type: 'stalled' }
  | { type: 'done' }
  | { type: 'error'; message: string };

interface PollState {
  reduced: RunReducerState;
  streamDone: boolean;
  stalled: boolean;
  error: string | null;
}

function makeInitialPollState(): PollState {
  return {
    reduced: makeInitialState(),
    streamDone: false,
    stalled: false,
    error: null,
  };
}

function pollReducer(state: PollState, action: PollAction): PollState {
  switch (action.type) {
    case 'reset':
      return makeInitialPollState();
    case 'append':
      return {
        ...state,
        reduced: applyEvents(state.reduced, action.events),
        stalled: false,
        error: null,
      };
    case 'stalled':
      if (state.streamDone) return state;
      return { ...state, stalled: true };
    case 'done':
      return { ...state, streamDone: true, stalled: false };
    case 'error':
      return { ...state, error: action.message };
  }
}

const INITIAL_POLL_STATE: PollState = makeInitialPollState();

// ---------------------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------------------

export type UseRunPollingResult = RunReducerState & {
  streamDone: boolean;
  stalled: boolean;
  error: string | null;
};

// ---------------------------------------------------------------------------
// Terminal status helpers
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(['complete', 'done', 'failed', 'error']);

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

function hasRunCompleteEvent(events: RunEvent[]): boolean {
  return events.some((e) => e.stage === 'run' && e.type === 'complete');
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Replay a full set of events from scratch (same reducer, full history).
 * Kept here so RunHistory can import from one place.
 */
export function replayEvents(events: RunEvent[]): RunReducerState {
  return reduceEvents(events);
}

export function useRunPolling(runId: string | null): UseRunPollingResult {
  const [pollState, dispatch] = useReducer(pollReducer, INITIAL_POLL_STATE);

  // Mutable refs that live outside React state (no re-render needed)
  const cursorRef = useRef<number>(0);
  const doneRef = useRef<boolean>(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!runId) return;

    // Reset for each new runId
    dispatch({ type: 'reset' });
    cursorRef.current = 0;
    doneRef.current = false;

    const clearStallTimer = () => {
      if (stallTimerRef.current !== null) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };

    const armStallTimer = () => {
      clearStallTimer();
      stallTimerRef.current = setTimeout(() => {
        if (!doneRef.current) {
          dispatch({ type: 'stalled' });
        }
      }, STALL_TIMEOUT_MS);
    };

    // Arm stall timer immediately when polling starts
    armStallTimer();

    // Box holds the interval id so poll() can clear it immediately on terminal
    // without triggering prefer-const (the box itself is const; its field is mutated).
    const intervalBox: { id: ReturnType<typeof setInterval> | undefined } = { id: undefined };

    const poll = async () => {
      if (doneRef.current) return;

      try {
        const url = `/api/runs/${runId}?since=${cursorRef.current}`;
        const res = await fetch(url);

        if (!res.ok) {
          dispatch({ type: 'error', message: `Poll failed: HTTP ${res.status}` });
          return;
        }

        const data = (await res.json()) as {
          runId: string;
          events: RunEvent[];
          maxSeq: number;
          status: string;
        };

        const newEvents: RunEvent[] = Array.isArray(data.events) ? data.events : [];
        const maxSeq: number = typeof data.maxSeq === 'number' ? data.maxSeq : cursorRef.current;
        const status: string = typeof data.status === 'string' ? data.status : 'pending';

        // Advance cursor
        if (maxSeq > cursorRef.current) {
          cursorRef.current = maxSeq;
        }

        // Apply new events
        if (newEvents.length > 0) {
          dispatch({ type: 'append', events: newEvents });
          armStallTimer();
        }

        // Check for terminal condition
        const terminal =
          isTerminalStatus(status) || hasRunCompleteEvent(newEvents);

        if (terminal) {
          doneRef.current = true;
          clearStallTimer();
          // Clear immediately -- do not wait for the next interval tick's guard.
          clearInterval(intervalBox.id);
          dispatch({ type: 'done' });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Poll error';
        dispatch({ type: 'error', message });
      }
    };

    // First poll immediately
    void poll();

    intervalBox.id = setInterval(() => {
      if (!doneRef.current) {
        void poll();
      } else {
        clearInterval(intervalBox.id);
      }
    }, POLL_INTERVAL_MS);

    return () => {
      doneRef.current = true;
      clearInterval(intervalBox.id);
      clearStallTimer();
    };
  }, [runId]);

  return {
    ...pollState.reduced,
    streamDone: pollState.streamDone,
    stalled: pollState.stalled,
    error: pollState.error,
  };
}
