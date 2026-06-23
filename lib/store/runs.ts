/**
 * lib/store/runs.ts
 *
 * Read/write helpers for the run-store tables:
 *   run_requests, runs, run_events, run_clusters, run_keywords
 *
 * All functions accept a QueryClient as the first arg so tests can inject a
 * fake pool. Column names match the engine schema exactly (snake_case); return
 * shapes use camelCase JS conventions.
 *
 * No secrets are logged or interpolated. All values go through parameterized
 * queries ($1, $2, ...).
 */

import type { QueryClient } from './pg';
import type { RunEvent } from '../events';

// ---------------------------------------------------------------------------
// run_requests
// ---------------------------------------------------------------------------

export interface InsertRunRequestArgs {
  id: string;
  clientId: string;
  resourceIds: string[];
  runInput: unknown;
  params?: Record<string, unknown>;
}

/**
 * Inserts a new queued run_request row.
 *
 * status MUST be 'queued' -- the engine's claimNextRunRequest only claims rows
 * WHERE status = 'queued'. Any other literal (e.g. 'pending') leaves the request
 * permanently unclaimed and the run stalls.
 *
 * params_json is built as `{ ...params, runInput }` so the engine's
 * claimNextRunRequest can surface runInput alongside any extra parameters.
 *
 * Returns the inserted id.
 */
export async function insertRunRequest(
  pool: QueryClient,
  { id, clientId, resourceIds, runInput, params }: InsertRunRequestArgs,
): Promise<string> {
  const paramsJson = { ...(params ?? {}), runInput };
  const text =
    'INSERT INTO run_requests (id, client_id, resource_ids, params_json, status) VALUES ($1,$2,$3,$4,$5) RETURNING id';
  const values = [id, clientId, resourceIds, JSON.stringify(paramsJson), 'queued'];
  const result = await pool.query(text, values);
  return result.rows[0].id as string;
}

// ---------------------------------------------------------------------------
// runs
// ---------------------------------------------------------------------------

export interface RunRow {
  runId: string;
  clientId: string;
  status: string;
  spend: number | null;
  selected: number | null;
  clusters: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

function mapRunRow(row: Record<string, unknown>): RunRow {
  return {
    runId: row.run_id as string,
    clientId: row.client_id as string,
    status: row.status as string,
    spend: row.spend != null ? (row.spend as number) : null,
    selected: row.selected != null ? (row.selected as number) : null,
    clusters: row.clusters != null ? (row.clusters as number) : null,
    startedAt: row.started_at != null ? new Date(row.started_at as string) : null,
    finishedAt: row.finished_at != null ? new Date(row.finished_at as string) : null,
  };
}

/**
 * Returns all runs ordered by started_at DESC (most recent first).
 * Runs that have not started yet sort last (NULLS LAST).
 */
export async function listRuns(pool: QueryClient): Promise<RunRow[]> {
  const text =
    'SELECT run_id, client_id, status, spend, selected, clusters, started_at, finished_at FROM runs ORDER BY started_at DESC NULLS LAST';
  const result = await pool.query(text);
  return result.rows.map(mapRunRow);
}

/**
 * Returns a single run row, or null if not found.
 */
export async function getRun(pool: QueryClient, runId: string): Promise<RunRow | null> {
  const text =
    'SELECT run_id, client_id, status, spend, selected, clusters, started_at, finished_at FROM runs WHERE run_id=$1';
  const result = await pool.query(text, [runId]);
  if (result.rows.length === 0) return null;
  return mapRunRow(result.rows[0]);
}

// ---------------------------------------------------------------------------
// run_events
// ---------------------------------------------------------------------------

export interface RunEventRow {
  seq: number;
  ts: number;
  event: RunEvent;
}

/**
 * Returns run_events for a given run where seq > sinceSeq, ordered by seq ASC.
 * sinceSeq defaults to 0 so the first call without a cursor gets everything.
 *
 * The event_json column stores the full RunEvent object; it is returned as the
 * parsed `event` field so the UI reducer can consume it directly.
 */
export async function getRunEventsSince(
  pool: QueryClient,
  runId: string,
  sinceSeq = 0,
): Promise<RunEventRow[]> {
  const text =
    'SELECT seq, ts, event_json FROM run_events WHERE run_id=$1 AND seq > $2 ORDER BY seq ASC';
  const result = await pool.query(text, [runId, sinceSeq]);
  return result.rows.map((row) => ({
    seq: row.seq as number,
    ts: row.ts as number,
    event: (typeof row.event_json === 'string'
      ? JSON.parse(row.event_json)
      : row.event_json) as RunEvent,
  }));
}

// ---------------------------------------------------------------------------
// run_clusters
// ---------------------------------------------------------------------------

export interface ClustersResult {
  clusters: unknown[];
  meta: Record<string, unknown>;
}

/**
 * Returns the parsed clusters_json for a run, or null if no row exists yet.
 */
export async function getRunClusters(
  pool: QueryClient,
  runId: string,
): Promise<ClustersResult | null> {
  const text = 'SELECT clusters_json FROM run_clusters WHERE run_id=$1';
  const result = await pool.query(text, [runId]);
  if (result.rows.length === 0) return null;
  const raw = result.rows[0].clusters_json;
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as ClustersResult;
}

// ---------------------------------------------------------------------------
// run_keywords
// ---------------------------------------------------------------------------

export interface KeywordRow {
  term: string;
  volume: number | null;
  kd: number | null;
  score: number | null;
  intent: string | null;
  source: string | null;
}

/**
 * Returns keywords for a run ordered by score DESC (highest-scoring first).
 * Keywords without a score sort last (NULLS LAST).
 */
export async function getRunKeywords(
  pool: QueryClient,
  runId: string,
): Promise<KeywordRow[]> {
  const text =
    'SELECT term, volume, kd, score, intent, source FROM run_keywords WHERE run_id=$1 ORDER BY score DESC NULLS LAST';
  const result = await pool.query(text, [runId]);
  return result.rows.map((row) => ({
    term: row.term as string,
    volume: row.volume != null ? (row.volume as number) : null,
    kd: row.kd != null ? (row.kd as number) : null,
    score: row.score != null ? (row.score as number) : null,
    intent: row.intent != null ? (row.intent as string) : null,
    source: row.source != null ? (row.source as string) : null,
  }));
}
