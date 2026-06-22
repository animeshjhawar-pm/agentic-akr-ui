'use client';

/**
 * Artifacts
 *
 * Renders the artifact directory tree for a completed (or in-progress) run.
 * Fetches from GET /api/runs/:runId/artifacts -> { tree: TreeNode[] }.
 * Dirs are expandable; clicking a file fetches its contents.
 * JSON files are pretty-printed inline; others get a download link.
 *
 * When `streaming` is true the tree is polled every ~3-4 s so new substep
 * files appear live. A final fetch fires when streaming flips to false.
 * Expanded dirs and the open FileViewer are preserved across polls.
 *
 * S3 layout note: artifacts mirror s3://<bucket>/<prefix>/clients/<clientId>/<runId>/...
 * and .../<runId>/... on Fly.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import type { TreeNode } from '@/lib/artifacts';

// ---------------------------------------------------------------------------
// File content viewer
// ---------------------------------------------------------------------------

interface FileViewerProps {
  runId: string;
  node: TreeNode;
  onClose: () => void;
}

function FileViewer({ runId, node, onClose }: FileViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [isJson, setIsJson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isJsonFile = node.name.endsWith('.json');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/runs/${runId}/artifacts/file?path=${encodeURIComponent(node.path)}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        if (isJsonFile) {
          const text = await r.text();
          try {
            const parsed = JSON.parse(text);
            if (!cancelled) {
              setContent(JSON.stringify(parsed, null, 2));
              setIsJson(true);
            }
          } catch {
            if (!cancelled) {
              setContent(text);
              setIsJson(false);
            }
          }
        } else {
          const blob = await r.blob();
          const downloadUrl = URL.createObjectURL(blob);
          if (!cancelled) {
            setContent(downloadUrl);
            setIsJson(false);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load file');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [runId, node.path, isJsonFile]);

  return (
    <div className="mt-2 rounded-lg border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-muted border-b border-border">
        <span className="text-xs font-mono text-on-surface truncate">{node.path}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close file viewer for ${node.name}`}
          className="text-xs text-on-surface-muted hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded px-1"
        >
          Close
        </button>
      </div>

      {loading && (
        <div className="px-3 py-4 text-xs text-on-surface-muted" role="status">
          Loading...
        </div>
      )}

      {error && (
        <div className="px-3 py-4 text-xs text-danger" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && content && (
        isJson ? (
          <pre className="overflow-auto max-h-80 px-3 py-2 text-[11px] font-mono text-on-surface whitespace-pre">
            {content}
          </pre>
        ) : isJsonFile ? (
          // Fallback raw text for invalid JSON
          <pre className="overflow-auto max-h-80 px-3 py-2 text-[11px] font-mono text-on-surface whitespace-pre">
            {content}
          </pre>
        ) : (
          <div className="px-3 py-3">
            <a
              href={content}
              download={node.name}
              className="text-xs text-primary underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded"
            >
              Download {node.name}
            </a>
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tree node -- reads expansion state from the shared set
// ---------------------------------------------------------------------------

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  runId: string;
  /** Set of paths that the user has explicitly expanded */
  expandedPaths: Set<string>;
  onToggleDir: (path: string) => void;
  /** Path of the currently open file viewer (null = none) */
  openFilePath: string | null;
  onOpenFile: (path: string | null) => void;
}

function TreeNodeRow({
  node,
  depth,
  runId,
  expandedPaths,
  onToggleDir,
  openFilePath,
  onOpenFile,
}: TreeNodeRowProps) {
  const isOpen = expandedPaths.has(node.path);
  const isViewing = openFilePath === node.path;
  const indent = depth * 16;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (node.type === 'dir') {
          onToggleDir(node.path);
        } else {
          onOpenFile(isViewing ? null : node.path);
        }
      }
    },
    [node.type, node.path, isViewing, onToggleDir, onOpenFile],
  );

  if (node.type === 'dir') {
    return (
      <li>
        <button
          type="button"
          onClick={() => onToggleDir(node.path)}
          onKeyDown={handleKeyDown}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? 'Collapse' : 'Expand'} directory ${node.name}`}
          className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-on-surface hover:bg-surface-muted rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          {isOpen
            ? <ChevronDown size={12} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />
            : <ChevronRight size={12} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />
          }
          {isOpen
            ? <FolderOpen size={14} aria-hidden="true" className="text-warning flex-shrink-0" />
            : <Folder size={14} aria-hidden="true" className="text-warning flex-shrink-0" />
          }
          <span className="font-medium truncate">{node.name}</span>
        </button>
        {isOpen && node.children && node.children.length > 0 && (
          <ul role="group" aria-label={`Contents of ${node.name}`}>
            {node.children.map((child) => (
              <TreeNodeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                runId={runId}
                expandedPaths={expandedPaths}
                onToggleDir={onToggleDir}
                openFilePath={openFilePath}
                onOpenFile={onOpenFile}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // File node
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpenFile(isViewing ? null : node.path)}
        onKeyDown={handleKeyDown}
        aria-expanded={isViewing}
        aria-label={`${isViewing ? 'Close' : 'View'} file ${node.name} (${formatSize(node.size)})`}
        className="w-full flex items-center gap-1.5 py-1 px-2 text-xs text-on-surface hover:bg-surface-muted rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        <File size={12} aria-hidden="true" className="text-on-surface-muted flex-shrink-0" />
        <span className="truncate flex-1 text-left">{node.name}</span>
        <span className="tabular-nums text-on-surface-muted font-mono text-[10px] flex-shrink-0 ml-auto">
          {formatSize(node.size)}
        </span>
      </button>
      {isViewing && (
        <FileViewer runId={runId} node={node} onClose={() => onOpenFile(null)} />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 3500;

interface ArtifactsProps {
  runId: string;
  /** Pass true while the run is still in progress to enable live polling */
  streaming?: boolean;
}

export default function Artifacts({ runId, streaming = false }: ArtifactsProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default open: Artifacts is now its own tab, so the tree should be visible
  // immediately (the collapse toggle stays available for users who want it).
  const [expanded, setExpanded] = useState(true);
  const [polling, setPolling] = useState(false);

  // Expansion state keyed by node path -- persisted across polls
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Path of the file currently open in FileViewer -- persisted across polls
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);

  // Refs so the interval closure always sees the latest values
  const streamingRef = useRef(streaming);
  useEffect(() => { streamingRef.current = streaming; }, [streaming]);

  const fetchTree = useCallback(async (isPoll: boolean) => {
    if (isPoll) setPolling(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await fetch(`/api/runs/${runId}/artifacts`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { tree: TreeNode[] };
      setTree(data.tree ?? []);
      if (!isPoll) setLoading(false);
    } catch (err: unknown) {
      if (!isPoll) {
        setError(err instanceof Error ? err.message : 'Failed to load artifacts');
        setLoading(false);
      }
      // Silently ignore poll errors -- they will retry on the next tick
    } finally {
      if (isPoll) setPolling(false);
    }
  }, [runId]);

  // Initial fetch -- fetchTree is async so setState calls happen asynchronously
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchTree(false); }, [fetchTree]);

  // Polling interval -- active only while streaming is true
  useEffect(() => {
    if (!streaming) return;
    const id = setInterval(() => {
      void fetchTree(true);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [streaming, fetchTree]);

  // Final fetch when streaming flips to false
  const prevStreamingRef = useRef(streaming);
  useEffect(() => {
    if (prevStreamingRef.current && !streaming) {
      void fetchTree(true);
    }
    prevStreamingRef.current = streaming;
  }, [streaming, fetchTree]);

  const handleToggleDir = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    void fetchTree(true);
  }, [fetchTree]);

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Collapsible header */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="artifacts-panel"
          className="flex-1 flex items-center justify-between px-4 py-3 bg-surface-muted hover:bg-surface-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <span className="text-xs font-semibold text-on-surface-muted uppercase tracking-wider flex items-center gap-2">
            Artifacts
            {polling && (
              <span className="text-[10px] font-normal text-on-surface-muted normal-case tracking-normal" aria-live="polite">
                updating...
              </span>
            )}
          </span>
          <ChevronRight
            size={14}
            aria-hidden="true"
            className={`text-on-surface-muted motion-safe:transition-transform motion-safe:duration-150 ${expanded ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Manual refresh button */}
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refresh artifacts"
          title="Refresh artifacts"
          className="px-3 py-3 bg-surface-muted hover:bg-surface-muted/80 text-on-surface-muted hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset border-l border-border"
        >
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div id="artifacts-panel" role="region" aria-label="Run artifacts">
          {/* S3 layout note */}
          <p className="px-4 py-2 text-[11px] text-on-surface-muted border-b border-border">
            These artifacts mirror the S3 layout on Fly: s3://&lt;bucket&gt;/&lt;prefix&gt;/clients/&lt;clientId&gt;/&lt;runId&gt;/... and .../ &lt;runId&gt;/...
          </p>

          {loading && (
            <div className="px-4 py-4 text-xs text-on-surface-muted" role="status" aria-live="polite">
              Loading artifacts...
            </div>
          )}

          {error && (
            <div className="px-4 py-4 text-xs text-danger" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && tree.length === 0 && (
            <div className="px-4 py-4 text-xs text-on-surface-muted">
              No artifacts found for this run.
            </div>
          )}

          {!loading && !error && tree.length > 0 && (
            <ul
              role="tree"
              aria-label="Artifact file tree"
              className="py-2 px-2"
            >
              {tree.map((node) => (
                <TreeNodeRow
                  key={node.path}
                  node={node}
                  depth={0}
                  runId={runId}
                  expandedPaths={expandedPaths}
                  onToggleDir={handleToggleDir}
                  openFilePath={openFilePath}
                  onOpenFile={setOpenFilePath}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
