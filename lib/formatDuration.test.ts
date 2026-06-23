// lib/formatDuration.test.ts

import { describe, it, expect } from 'vitest';
import { formatDuration, isoToMs } from './formatDuration';

describe('formatDuration', () => {
  it('formats sub-minute as seconds', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(5_000)).toBe('5s');
    expect(formatDuration(59_999)).toBe('59s');
  });

  it('formats minutes + seconds', () => {
    expect(formatDuration(60_000)).toBe('1m 0s');
    expect(formatDuration(65_000)).toBe('1m 5s');
    expect(formatDuration(599_000)).toBe('9m 59s');
  });

  it('formats hours + minutes + seconds', () => {
    expect(formatDuration(3_600_000)).toBe('1h 0m 0s');
    expect(formatDuration(3_661_000)).toBe('1h 1m 1s');
  });

  it('clamps negative / non-finite to 0s', () => {
    expect(formatDuration(-1)).toBe('0s');
    expect(formatDuration(NaN)).toBe('0s');
    expect(formatDuration(Infinity)).toBe('0s');
  });
});

describe('isoToMs', () => {
  it('parses an ISO string to epoch ms', () => {
    expect(isoToMs('2026-06-23T10:00:00.000Z')).toBe(Date.parse('2026-06-23T10:00:00.000Z'));
  });

  it('returns null for null/undefined/invalid', () => {
    expect(isoToMs(null)).toBeNull();
    expect(isoToMs(undefined)).toBeNull();
    expect(isoToMs('not a date')).toBeNull();
  });
});
