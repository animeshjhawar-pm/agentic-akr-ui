// lib/csv.test.ts

import { describe, it, expect } from 'vitest';
import { toKeywordsCsv, type CsvKeyword } from './csv';

const baseRow: CsvKeyword = {
  term: 'best seo tool',
  volume: 1200,
  kd: 45.7,
  score: 82.4,
  intent: 'commercial',
  source: 'broadmatch',
  resourceId: 'r1',
};

describe('toKeywordsCsv', () => {
  it('produces 7-column header with Intent', () => {
    const csv = toKeywordsCsv([]);
    expect(csv).toBe('Term,Volume,KD,Score,Intent,Source,Resource');
  });

  it('produces a data row with correct values including intent', () => {
    const csv = toKeywordsCsv([baseRow]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    // Score should be rounded integer; intent right after score
    expect(lines[1]).toBe('best seo tool,1200,45.7,82,commercial,broadmatch,r1');
  });

  it('rounds score to nearest integer', () => {
    const row: CsvKeyword = { ...baseRow, score: 74.6 };
    const csv = toKeywordsCsv([row]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine).toContain(',75,');
  });

  it('escapes a term containing a comma', () => {
    const row: CsvKeyword = { ...baseRow, term: 'best, cheapest tool' };
    const csv = toKeywordsCsv([row]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine.startsWith('"best, cheapest tool"')).toBe(true);
  });

  it('escapes a term containing a double-quote', () => {
    const row: CsvKeyword = { ...baseRow, term: 'best "seo" tool' };
    const csv = toKeywordsCsv([row]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine.startsWith('"best ""seo"" tool"')).toBe(true);
  });

  it('outputs empty cells for null volume and kd', () => {
    const row: CsvKeyword = { ...baseRow, volume: null, kd: null };
    const csv = toKeywordsCsv([row]);
    const dataLine = csv.split('\n')[1];
    // term,<empty>,<empty>,score,intent,source,resource
    const parts = dataLine.split(',');
    expect(parts[1]).toBe('');
    expect(parts[2]).toBe('');
  });

  it('maps resourceId to name when resourceNames provided', () => {
    const csv = toKeywordsCsv([baseRow], { r1: 'My Blog' });
    const dataLine = csv.split('\n')[1];
    expect(dataLine.endsWith('My Blog')).toBe(true);
  });

  it('falls back to raw resourceId when resourceNames not provided', () => {
    const csv = toKeywordsCsv([baseRow]);
    const dataLine = csv.split('\n')[1];
    expect(dataLine.endsWith('r1')).toBe(true);
  });

  it('handles multiple rows', () => {
    const rows: CsvKeyword[] = [
      baseRow,
      { ...baseRow, term: 'second keyword', score: 60.0, resourceId: 'r2' },
    ];
    const csv = toKeywordsCsv(rows);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
  });
});
