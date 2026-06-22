// components/Artifacts.test.tsx
//
// RTL tests for Artifacts component:
// - renders file nodes from a mocked fetch
// - clicking a file node fetches content and shows it inline (JSON pretty-printed)
// - non-JSON file shows a download link
// - nested substep dirs render and are expandable
// - with streaming=true the tree re-fetches on an advanced timer
// - expanded dir stays expanded after a refresh
// - no polling when streaming is false

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import Artifacts from './Artifacts';
import type { TreeNode } from '@/lib/artifacts';

const sampleTree: TreeNode[] = [
  {
    name: 'result.json',
    path: 'result.json',
    type: 'file',
    size: 120,
  },
  {
    name: 'lanes',
    path: 'lanes',
    type: 'dir',
    size: 0,
    children: [
      {
        name: 'checkpoint.json',
        path: 'lanes/checkpoint.json',
        type: 'file',
        size: 88,
      },
    ],
  },
  {
    name: 'akr.sqlite',
    path: 'db/akr.sqlite',
    type: 'file',
    size: 4096,
  },
];

// Deeper substep tree: lanes/r1/grade/0.json
const substepTree: TreeNode[] = [
  {
    name: 'lanes',
    path: 'lanes',
    type: 'dir',
    size: 0,
    children: [
      {
        name: 'r1',
        path: 'lanes/r1',
        type: 'dir',
        size: 0,
        children: [
          {
            name: 'grade',
            path: 'lanes/r1/grade',
            type: 'dir',
            size: 0,
            children: [
              {
                name: '0.json',
                path: 'lanes/r1/grade/0.json',
                type: 'file',
                size: 42,
              },
            ],
          },
        ],
      },
    ],
  },
];

function mockFetchTree(tree: TreeNode[]) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('/artifacts/file')) {
      const u = new URL(String(url), 'http://localhost');
      const path = u.searchParams.get('path') ?? '';
      if (path.endsWith('.json')) {
        return Promise.resolve({
          ok: true,
          text: async () => JSON.stringify({ hello: 'world' }),
        } as Response);
      }
      // Binary file
      return Promise.resolve({
        ok: true,
        blob: async () => new Blob([new Uint8Array([1, 2, 3])]),
      } as Response);
    }
    // Tree endpoint
    return Promise.resolve({
      ok: true,
      json: async () => ({ tree }),
    } as Response);
  });
}

describe('Artifacts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders file nodes after expanding the panel', async () => {
    mockFetchTree(sampleTree);
    render(<Artifacts runId="run-1" />);

    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    await waitFor(() => {
      expect(screen.getByText('result.json')).toBeInTheDocument();
    });

    expect(screen.getByText('lanes')).toBeInTheDocument();
    expect(screen.getByText('akr.sqlite')).toBeInTheDocument();
  });

  it('shows file size in tabular format', async () => {
    mockFetchTree(sampleTree);
    render(<Artifacts runId="run-1" />);

    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    await waitFor(() => {
      expect(screen.getByText('result.json')).toBeInTheDocument();
    });

    // 120 B for result.json
    expect(screen.getByText('120 B')).toBeInTheDocument();
  });

  it('clicking a JSON file shows pretty-printed content', async () => {
    mockFetchTree(sampleTree);
    render(<Artifacts runId="run-1" />);

    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    await waitFor(() => {
      expect(screen.getByText('result.json')).toBeInTheDocument();
    });

    // Click on result.json file button
    const fileBtn = screen.getByRole('button', { name: /view file result\.json/i });
    fireEvent.click(fileBtn);

    await waitFor(() => {
      // Pretty-printed JSON should appear
      expect(screen.getByText(/"hello": "world"/)).toBeInTheDocument();
    });
  });

  it('clicking a non-JSON file shows a download link', async () => {
    mockFetchTree(sampleTree);
    render(<Artifacts runId="run-1" />);

    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    await waitFor(() => {
      expect(screen.getByText('akr.sqlite')).toBeInTheDocument();
    });

    const fileBtn = screen.getByRole('button', { name: /view file akr\.sqlite/i });
    fireEvent.click(fileBtn);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /download akr\.sqlite/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('download', 'akr.sqlite');
    });
  });

  it('expanding a directory shows nested files', async () => {
    mockFetchTree(sampleTree);
    render(<Artifacts runId="run-1" />);

    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    await waitFor(() => {
      expect(screen.getByText('lanes')).toBeInTheDocument();
    });

    // Expand the lanes dir
    const dirBtn = screen.getByRole('button', { name: /expand directory lanes/i });
    fireEvent.click(dirBtn);

    await waitFor(() => {
      expect(screen.getByText('checkpoint.json')).toBeInTheDocument();
    });
  });

  it('shows S3 layout note when expanded', async () => {
    mockFetchTree(sampleTree);
    render(<Artifacts runId="run-1" />);

    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    await waitFor(() => {
      expect(screen.getByText(/s3:\/\//i)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Nested substep dirs
  // ---------------------------------------------------------------------------

  it('renders nested substep dirs (lanes/r1/grade/0.json) and they are expandable', async () => {
    mockFetchTree(substepTree);
    render(<Artifacts runId="run-2" />);

    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    await waitFor(() => {
      expect(screen.getByText('lanes')).toBeInTheDocument();
    });

    // Expand lanes
    fireEvent.click(screen.getByRole('button', { name: /expand directory lanes/i }));
    await waitFor(() => expect(screen.getByText('r1')).toBeInTheDocument());

    // Expand r1
    fireEvent.click(screen.getByRole('button', { name: /expand directory r1/i }));
    await waitFor(() => expect(screen.getByText('grade')).toBeInTheDocument());

    // Expand grade
    fireEvent.click(screen.getByRole('button', { name: /expand directory grade/i }));
    await waitFor(() => expect(screen.getByText('0.json')).toBeInTheDocument());
  });

  // ---------------------------------------------------------------------------
  // Polling: streaming=true causes re-fetch on timer
  // ---------------------------------------------------------------------------

  it('polls tree when streaming is true', async () => {
    vi.useFakeTimers();
    mockFetchTree(sampleTree);

    render(<Artifacts runId="run-3" streaming={true} />);

    // Expand panel
    await act(async () => {
      // Artifacts panel is open by default (it is its own tab) -- no expand click needed.
    });

    // Wait for initial fetch to resolve
    await act(async () => {
      await Promise.resolve();
    });

    const callsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // Advance timer by 4 seconds to trigger poll
    await act(async () => {
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
    });

    const callsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it('does not poll when streaming is false', async () => {
    vi.useFakeTimers();
    mockFetchTree(sampleTree);

    render(<Artifacts runId="run-4" streaming={false} />);

    await act(async () => {
      // Artifacts panel is open by default (it is its own tab) -- no expand click needed.
    });
    await act(async () => { await Promise.resolve(); });

    const callsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(8000);
      await Promise.resolve();
    });

    const callsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  // ---------------------------------------------------------------------------
  // Expanded dir stays expanded after a refresh
  // ---------------------------------------------------------------------------

  it('expanded dir stays expanded after a refresh', async () => {
    // Use real timers for this test -- manually trigger a refresh via the button
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/artifacts/file')) {
        return Promise.resolve({ ok: true, text: async () => '{}' } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ tree: substepTree }),
      } as Response);
    });

    render(<Artifacts runId="run-5" streaming={true} />);

    // Expand the panel
    // Artifacts panel is open by default (it is its own tab) -- no expand click needed.

    // Wait for lanes to appear from the initial fetch
    await waitFor(() => expect(screen.getByText('lanes')).toBeInTheDocument());

    // Expand the lanes dir
    fireEvent.click(screen.getByRole('button', { name: /expand directory lanes/i }));
    await waitFor(() => expect(screen.getByText('r1')).toBeInTheDocument());

    // Trigger a manual refresh
    fireEvent.click(screen.getByRole('button', { name: /refresh artifacts/i }));

    // After the refresh, r1 should still be visible (lanes dir stayed expanded)
    await waitFor(() => expect(screen.getByText('r1')).toBeInTheDocument());
  });

  // ---------------------------------------------------------------------------
  // Final fetch when streaming flips to false
  // ---------------------------------------------------------------------------

  it('does a final fetch when streaming flips from true to false', async () => {
    vi.useFakeTimers();
    mockFetchTree(sampleTree);

    const { rerender } = render(<Artifacts runId="run-6" streaming={true} />);

    await act(async () => {
      // Artifacts panel is open by default (it is its own tab) -- no expand click needed.
    });
    await act(async () => { await Promise.resolve(); });

    const callsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // Flip streaming to false
    await act(async () => {
      rerender(<Artifacts runId="run-6" streaming={false} />);
      await Promise.resolve();
    });

    const callsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);
  });
});
