// lib/csv.ts
//
// Pure CSV builder for keyword results.
// Extracted so it can be unit-tested independently of the React component.

export interface CsvKeyword {
  term: string;
  volume: number | null;
  kd: number | null;
  score: number;
  intent: string;
  source: string;
  resourceId: string;
}

/**
 * Escape a single CSV field value.
 * Wraps the field in double quotes if it contains a comma, double-quote, or newline.
 * Embedded double-quotes are doubled.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Build a CSV string from an array of keyword rows.
 *
 * Columns: Term, Volume, KD, Score, Intent, Source, Resource
 *   - Volume/KD null -> empty cell
 *   - Score -> rounded integer (0-100)
 *   - Intent -> raw intent label string
 *   - Resource -> resourceNames[resourceId] if provided, else raw resourceId
 *
 * @param rows       Keyword rows to serialize
 * @param resourceNames  Optional map of resourceId -> display name
 */
export function toKeywordsCsv(
  rows: CsvKeyword[],
  resourceNames?: Record<string, string>,
): string {
  const header = 'Term,Volume,KD,Score,Intent,Source,Resource';
  const dataLines = rows.map((row) => {
    const term = escapeCsvField(row.term);
    const volume = row.volume != null ? String(row.volume) : '';
    const kd = row.kd != null ? row.kd.toFixed(1) : '';
    const score = String(Math.round(row.score));
    const intent = escapeCsvField(row.intent ?? 'other');
    const source = escapeCsvField(row.source ?? '');
    const resourceLabel = resourceNames?.[row.resourceId] ?? row.resourceId ?? '';
    const resource = escapeCsvField(resourceLabel);
    return [term, volume, kd, score, intent, source, resource].join(',');
  });
  return [header, ...dataLines].join('\n');
}
