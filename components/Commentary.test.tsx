// components/Commentary.test.tsx
//
// RTL + Vitest tests for the Commentary component:
// 1. Empty events -> renders waiting message
// 2. seed-gen/done count=5 -> "Generated 5 seed keywords."
// 3. grade/batch -> "Graded N keywords -- kept K (avg score S), dropped R."
// 4. clustering/stage start name=05-titles -> correct stage sentence
// 5. run/complete -> correct complete sentence
// 6. All items have data-testid="commentary-item"
// 7. Timestamps are rendered in HH:MM:SS format

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import Commentary from './Commentary';
import type { RunEvent } from '@/lib/events';

// ---------------------------------------------------------------------------
// 1. Empty events
// ---------------------------------------------------------------------------

describe('Commentary - empty events', () => {
  it('renders "Waiting for the run to start..." when events is empty', () => {
    render(<Commentary events={[]} />);
    expect(screen.getByText(/waiting for the run to start/i)).toBeInTheDocument();
  });

  it('does not render any commentary-item when events is empty', () => {
    render(<Commentary events={[]} />);
    expect(screen.queryAllByTestId('commentary-item')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. seed-gen/done count=5
// ---------------------------------------------------------------------------

describe('Commentary - seed-gen/done', () => {
  const evt: RunEvent = {
    ts: new Date('2024-01-01T10:05:30Z').getTime(),
    stage: 'seed-gen',
    type: 'done',
    resourceId: 'r1',
    count: 5,
  };

  it('renders "Generated 5 seed keywords."', () => {
    render(<Commentary events={[evt]} />);
    expect(screen.getByText('Generated 5 seed keywords.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. grade/batch
// ---------------------------------------------------------------------------

describe('Commentary - grade/batch', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'grade',
    type: 'batch',
    resourceId: 'r1',
    graded: 20,
    kept: 12,
    rejected: 6,
    outOfScope: 2,
    avgScore: 7.3,
    detail: 'batch graded',
  };

  it('reports true dropped = graded - kept, with out-of-scope split', () => {
    render(<Commentary events={[evt]} />);
    // graded 20, kept 12 -> dropped 8 (rejected 6 + out-of-scope 2)
    expect(
      screen.getByText('Graded 20 keywords -- kept 12 (avg score 7.3), dropped 8 (2 out-of-scope).'),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 4. clustering/stage start name=05-titles
// ---------------------------------------------------------------------------

describe('Commentary - clustering/stage 05-titles', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'clustering',
    type: 'stage',
    name: '05-titles',
    status: 'start',
    detail: 'titles stage',
  };

  it('renders "Clustering 5/10: writing SEO titles for each topic."', () => {
    render(<Commentary events={[evt]} />);
    expect(screen.getByText('Clustering 5/10: writing SEO titles for each topic.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. run/complete
// ---------------------------------------------------------------------------

describe('Commentary - run/complete', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'run',
    type: 'complete',
    pages: 8,
    selected: 42,
    spend: 0.0312,
  };

  it('renders "Run complete: 42 keywords, 8 candidate pages, $0.0312."', () => {
    render(<Commentary events={[evt]} />);
    expect(screen.getByText('Run complete: 42 keywords, 8 candidate pages, $0.0312.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 6. All items have data-testid="commentary-item"
// ---------------------------------------------------------------------------

describe('Commentary - data-testid on all items', () => {
  const events: RunEvent[] = [
    { ts: 1000, stage: 'seed-gen', type: 'done', resourceId: 'r1', count: 3 },
    { ts: 2000, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 7, rejected: 2, outOfScope: 1, avgScore: 8.0, detail: 'graded' },
    { ts: 3000, stage: 'run', type: 'complete', pages: 5, selected: 20, spend: 0.05 },
  ];

  it('each rendered item has data-testid="commentary-item"', () => {
    render(<Commentary events={events} />);
    const items = screen.getAllByTestId('commentary-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 7. Timestamps rendered in HH:MM:SS format
// ---------------------------------------------------------------------------

describe('Commentary - timestamps', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'seed-gen',
    type: 'start',
    resourceId: 'r1',
  };

  it('renders a timestamp matching HH:MM:SS', () => {
    render(<Commentary events={[evt]} />);
    // Find the commentary item and check for a time string
    const items = screen.getAllByTestId('commentary-item');
    expect(items.length).toBeGreaterThan(0);
    // Each item contains a monospace timestamp span with HH:MM:SS
    const tsPattern = /^\d{2}:\d{2}:\d{2}$/;
    const found = items.some((item) => {
      const text = item.textContent ?? '';
      // Extract the first HH:MM:SS-like substring
      return tsPattern.test(text.substring(0, 8));
    });
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Additional: planner/decision runResourceLanes
// ---------------------------------------------------------------------------

describe('Commentary - planner/decision runResourceLanes', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'planner',
    type: 'decision',
    step: 'runResourceLanes',
    rationale: 'launching all lanes',
  };

  it('renders the parallel launch sentence', () => {
    render(<Commentary events={[evt]} />);
    expect(screen.getByText(/launching keyword generation for all selected offerings in parallel/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Additional: clustering/stage done produces no item
// ---------------------------------------------------------------------------

describe('Commentary - clustering/stage done is suppressed', () => {
  const events: RunEvent[] = [
    {
      ts: 1000,
      stage: 'clustering',
      type: 'stage',
      name: '01-classify',
      status: 'start',
      detail: 'start classify',
    },
    {
      ts: 2000,
      stage: 'clustering',
      type: 'stage',
      name: '01-classify',
      status: 'done',
      detail: 'done classify',
    },
  ];

  it('renders only 1 item (start, not done)', () => {
    render(<Commentary events={events} />);
    const items = screen.getAllByTestId('commentary-item');
    expect(items).toHaveLength(1);
    expect(screen.getByText('Clustering 1/10: classifying keywords by topic.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Additional: mine-serp/patterns triggered with modifiers
// ---------------------------------------------------------------------------

describe('Commentary - mine-serp/patterns triggered with modifiers', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'mine-serp',
    type: 'patterns',
    resourceId: 'r1',
    triggered: true,
    modifiers: ['best', 'top'],
    candidateTerms: [],
    detail: 'patterns',
  };

  it('renders found recurring competitor modifiers sentence', () => {
    render(<Commentary events={[evt]} />);
    expect(screen.getByText(/found recurring competitor modifiers: best, top/i)).toBeInTheDocument();
  });
});
