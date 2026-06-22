// TEMP: replaced in Phase-4 Task 3/4
'use client';

import type { RunEvent } from './events';
import { makeInitialState, reduceEvents, type RunReducerState } from './runReducer';

export const STALL_TIMEOUT_MS = 90_000;

export function useRunStream(
  _reader: ReadableStreamDefaultReader<Uint8Array> | null,
  _runId: string | null,
): RunReducerState & { streamDone: boolean; stalled: boolean } {
  return { ...makeInitialState(), streamDone: false, stalled: false };
}

export function replayEvents(events: RunEvent[]): RunReducerState {
  return reduceEvents(events);
}
