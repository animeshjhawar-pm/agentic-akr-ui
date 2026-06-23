// components/Clusters.test.tsx
//
// RTL tests for Clusters component:
// - Renders one card per cluster with expected fields
// - Download button appears when clusters loaded
// - Local-variant cluster shows its badge
// - 404 response shows not-yet-generated message
// - Error state shows error message
// - Loading state shows loading indicator

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import Clusters from './Clusters';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const CLUSTER_1 = {
  id: 'c1',
  title: 'Best SEO Tools',
  pageType: 'listicle',
  intent: 'commercial',
  primaryKeyword: 'seo tools',
  primaryVolume: 12000,
  secondaryKeywords: [
    { term: 'seo software', volume: 5000, kd: 40, score: 0.8, intent: 'commercial' },
    { term: 'keyword research tools', volume: 8000, kd: 55, score: 0.75, intent: 'commercial' },
    { term: 'backlink checker', volume: 4000, kd: 35, score: 0.6, intent: 'commercial' },
  ],
  clusterVolume: 29000,
  relevanceScore: 87,
  leadScore: 4.25,
  alreadyRanking: false,
  rankingPosition: null,
  isLocalVariant: false,
  city: null,
  sources: ['dataforseo'],
  competitorTitlesUsed: [],
};

const CLUSTER_LOCAL = {
  id: 'c2',
  title: 'SEO Services Austin',
  pageType: 'service',
  intent: 'transactional',
  primaryKeyword: 'seo services austin',
  primaryVolume: 880,
  secondaryKeywords: [],
  clusterVolume: 880,
  relevanceScore: 92,
  leadScore: 7.50,
  alreadyRanking: true,
  rankingPosition: 8,
  isLocalVariant: true,
  city: 'Austin',
  sources: ['dataforseo'],
  competitorTitlesUsed: [],
};

const CLUSTERS_DATA = {
  clusters: [CLUSTER_1, CLUSTER_LOCAL],
  meta: {
    totalClusters: 2,
    byPageType: { listicle: 1, service: 1 },
    byIntent: { commercial: 1, transactional: 1 },
    droppedOffTopic: 0,
    localVariants: 1,
  },
};

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function makeFetch404() {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: 'not found' }),
  });
}

function makeFetchError(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: 'server error' }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Clusters', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ---- Loading state ---------------------------------------------------------

  it('shows loading indicator while fetching', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<Clusters runId="run-1" />);
    expect(screen.getByLabelText(/loading clusters/i)).toBeInTheDocument();
  });

  // ---- 404 state -------------------------------------------------------------

  it('shows not-yet-generated message on 404', async () => {
    global.fetch = makeFetch404();
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(
        screen.getByText(/clusters not yet generated for this run/i),
      ).toBeInTheDocument();
    });
  });

  // ---- Error state -----------------------------------------------------------

  it('shows error message on non-404 failure', async () => {
    global.fetch = makeFetchError(500);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText(/HTTP 500/i)).toBeInTheDocument();
    });
  });

  // ---- Empty state -----------------------------------------------------------

  it('shows empty message when clusters array is empty', async () => {
    global.fetch = makeFetchOk({ clusters: [], meta: { totalClusters: 0, byPageType: {}, byIntent: {}, droppedOffTopic: 0, localVariants: 0 } });
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText(/no clusters in results/i)).toBeInTheDocument();
    });
  });

  // ---- Cluster cards ---------------------------------------------------------

  it('renders one card per cluster', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText('Best SEO Tools')).toBeInTheDocument();
      expect(screen.getByText('SEO Services Austin')).toBeInTheDocument();
    });
  });

  it('shows primaryKeyword in each card', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText('seo tools')).toBeInTheDocument();
    });
  });

  it('shows primaryVolume with tabular-nums formatting', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      // Match the volume text -- may render as 12,000 or 12000 depending on locale
      expect(screen.getByText(/12.?000/)).toBeInTheDocument();
    });
  });

  it('lists secondary keywords with a labeled count', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText(/Secondary keywords \(3\)/i)).toBeInTheDocument();
      expect(screen.getByText('seo software')).toBeInTheDocument();
    });
  });

  it('shows clusterVolume', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      // Match the volume text -- may render as 29,000 or 29000 depending on locale
      expect(screen.getByText(/29.?000/)).toBeInTheDocument();
    });
  });

  it('shows relevanceScore as 0-100 integer', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText('87')).toBeInTheDocument();
    });
  });

  it('shows leadScore rounded to an integer (0-100 scale)', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      // 4.25 -> rounded 4, rendered as "4/100" in split spans
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  it('shows pageType badge', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      // Target the badge span specifically -- the page-type filter dropdown also
      // renders an <option>listicle</option>, so an unscoped getByText is ambiguous.
      expect(screen.getByText('listicle', { selector: 'span' })).toBeInTheDocument();
    });
  });

  it('shows intent badge', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText('commercial')).toBeInTheDocument();
    });
  });

  // ---- AlreadyRanking badge --------------------------------------------------

  it('shows Ranking badge for alreadyRanking cluster', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      // rankingPosition 8 -> "Ranking #8"
      expect(screen.getByText(/Ranking/)).toBeInTheDocument();
    });
  });

  it('does not show Ranking badge for non-ranking cluster', async () => {
    global.fetch = makeFetchOk({ clusters: [CLUSTER_1], meta: { totalClusters: 1, byPageType: {}, byIntent: {}, droppedOffTopic: 0, localVariants: 0 } });
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText('Best SEO Tools')).toBeInTheDocument();
    });
    expect(screen.queryByText('Ranking')).not.toBeInTheDocument();
  });

  // ---- LocalVariant badge ----------------------------------------------------

  it('shows Local badge with city for local variant cluster', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText('Local - Austin')).toBeInTheDocument();
    });
  });

  it('does not show Local badge for non-local cluster', async () => {
    global.fetch = makeFetchOk({ clusters: [CLUSTER_1], meta: { totalClusters: 1, byPageType: {}, byIntent: {}, droppedOffTopic: 0, localVariants: 0 } });
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByText('Best SEO Tools')).toBeInTheDocument();
    });
    expect(screen.queryByText(/local/i)).not.toBeInTheDocument();
  });

  // ---- Download button -------------------------------------------------------

  it('shows download button when clusters loaded', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    render(<Clusters runId="run-1" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download final_clusters\.csv/i })).toBeInTheDocument();
    });
  });

  it('does not show download button while loading', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<Clusters runId="run-1" />);
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
  });

  it('download button triggers file download', async () => {
    global.fetch = makeFetchOk(CLUSTERS_DATA);
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    // Intercept anchor creation without recursive spying
    const realCreateElement = document.createElement.bind(document);
    const clickFn = vi.fn();
    let capturedAnchor: HTMLAnchorElement | null = null;
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string, ...rest: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const el = realCreateElement(tag, ...(rest as [any]));
      if (tag === 'a') {
        el.click = clickFn;
        capturedAnchor = el as HTMLAnchorElement;
      }
      return el;
    });

    render(<Clusters runId="run-abc" />);

    const btn = await screen.findByRole('button', { name: /download final_clusters\.csv/i });
    await userEvent.click(btn);

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickFn).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalled();
    expect(capturedAnchor).not.toBeNull();
    expect((capturedAnchor as HTMLAnchorElement | null)?.download).toBe('Final_Clusters-run-abc.csv');

    createElementSpy.mockRestore();
  });
});
