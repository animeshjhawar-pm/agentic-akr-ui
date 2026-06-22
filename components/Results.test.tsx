// components/Results.test.tsx
//
// RTL tests for Results component:
// - given keyword rows (mock fetch), table renders correctly
// - clicking Volume header sorts rows by volume and sets aria-sort
// - clicking again reverses the sort
// - Score is shown as 0-100 rounded integer
// - Download CSV button renders when keywords are present

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import Results from './Results';

const sampleKeywords = [
  { term: 'apple keyword', volume: 500, kd: 20.0, score: 82.4, source: 'broadmatch', resourceId: 'r1' },
  { term: 'banana keyword', volume: 1500, kd: 45.0, score: 41.0, source: 'mine-serp', resourceId: 'r2' },
  { term: 'cherry keyword', volume: 200, kd: 10.0, score: 65.0, source: 'broadmatch', resourceId: 'r1' },
];

const sampleTotals = { spend: 0.0123, selected: 3, pages: 5 };

function mockFetch(keywords: typeof sampleKeywords) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ keywords }),
  } as Response);
}

describe('Results', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders keyword rows from fetched data', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });
    expect(screen.getByText('banana keyword')).toBeInTheDocument();
    expect(screen.getByText('cherry keyword')).toBeInTheDocument();
  });

  it('renders Score column header and rounded score values (0-100)', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: /score/i })).toBeInTheDocument();
    // score: 82.4 -> "82" (rounded integer, not "8.2")
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('41')).toBeInTheDocument();
  });

  it('sorts by score when Score header is clicked', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });

    const scoreHeader = screen.getByRole('columnheader', { name: /score/i });
    fireEvent.click(scoreHeader);

    // After ascending sort by score: banana(41) < cherry(65) < apple(82)
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('banana keyword');
    expect(rows[2]).toHaveTextContent('cherry keyword');
    expect(rows[3]).toHaveTextContent('apple keyword');

    expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  it('renders totals header with selected count and spend', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });
    // totals: 3 selected, $0.0123 spend (the heuristic-v0 pages box was removed)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/0\.0123/)).toBeInTheDocument();
  });

  it('sorts by volume ascending when Volume header is clicked', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });

    const volumeHeader = screen.getByRole('columnheader', { name: /volume/i });
    fireEvent.click(volumeHeader);

    // After ascending sort: cherry(200) < apple(500) < banana(1500)
    const rows = screen.getAllByRole('row');
    // rows[0] = header, rows[1..] = data
    expect(rows[1]).toHaveTextContent('cherry keyword');
    expect(rows[2]).toHaveTextContent('apple keyword');
    expect(rows[3]).toHaveTextContent('banana keyword');

    expect(volumeHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  it('reverses sort to descending when Volume header is clicked again', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });

    const volumeHeader = screen.getByRole('columnheader', { name: /volume/i });
    fireEvent.click(volumeHeader);
    fireEvent.click(volumeHeader);

    // After descending sort: banana(1500) > apple(500) > cherry(200)
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('banana keyword');
    expect(rows[2]).toHaveTextContent('apple keyword');
    expect(rows[3]).toHaveTextContent('cherry keyword');

    expect(volumeHeader).toHaveAttribute('aria-sort', 'descending');
  });

  it('shows aria-sort=none on non-sorted columns', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });

    const termHeader = screen.getByRole('columnheader', { name: /term/i });
    const kdHeader = screen.getByRole('columnheader', { name: /kd/i });

    fireEvent.click(screen.getByRole('columnheader', { name: /volume/i }));

    expect(termHeader).toHaveAttribute('aria-sort', 'none');
    expect(kdHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('shows empty state when no keywords are returned', async () => {
    mockFetch([]);
    render(<Results runId="run-empty" totals={{ spend: 0, selected: 0, pages: 0 }} />);

    await waitFor(() => {
      expect(screen.getByText(/no keywords/i)).toBeInTheDocument();
    });
  });

  it('renders "Download CSV" button when keywords are present', async () => {
    mockFetch(sampleKeywords);
    render(<Results runId="run-1" totals={sampleTotals} />);

    await waitFor(() => {
      expect(screen.getByText('apple keyword')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /download csv/i })).toBeInTheDocument();
  });

  it('does not render "Download CSV" button when keywords list is empty', async () => {
    mockFetch([]);
    render(<Results runId="run-empty" totals={{ spend: 0, selected: 0, pages: 0 }} />);

    await waitFor(() => {
      expect(screen.getByText(/no keywords/i)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /download csv/i })).not.toBeInTheDocument();
  });
});
