// components/EventLog.test.tsx
//
// RTL tests for EventLog expandable rows:
// - mine-serp/patterns (triggered) expands to show modifiers + candidateTerms
// - mine-serp/patterns (not triggered) expands to "not triggered" message
// - mine-serp/keyword expands to show titlesSeen
// - Clicking row toggles aria-expanded
// - geo/done expands to show heads x cities / combosTried / kept
// - grade/batch expands to show graded/kept/rejected/outOfScope/avgScore
// - lane/agent-step expands to show tool + produced/kept

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import EventLog from './EventLog';
import type { RunEvent } from '@/lib/events';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLog(events: RunEvent[]) {
  return render(<EventLog log={events} selectedStage={null} />);
}

// ---------------------------------------------------------------------------
// mine-serp/patterns - triggered
// ---------------------------------------------------------------------------

describe('EventLog - mine-serp/patterns (triggered)', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'mine-serp',
    type: 'patterns',
    resourceId: 'r1',
    triggered: true,
    modifiers: ['best', 'top'],
    candidateTerms: ['crm', 'saas tool'],
    detail: 'patterns detected',
  };

  it('renders collapsed by default', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands on click to show modifiers and candidateTerms', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/best, top/)).toBeInTheDocument();
    expect(screen.getByText(/crm, saas tool/)).toBeInTheDocument();
  });

  it('collapses again on second click', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/best, top/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// mine-serp/patterns - not triggered
// ---------------------------------------------------------------------------

describe('EventLog - mine-serp/patterns (not triggered)', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'mine-serp',
    type: 'patterns',
    resourceId: 'r1',
    triggered: false,
    modifiers: [],
    candidateTerms: [],
    detail: 'trends not triggered',
  };

  it('expands to show "SERP trends sub-agent did not run this step"', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/serp trends sub-agent did not run this step/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// mine-serp/patterns - triggered but empty
// ---------------------------------------------------------------------------

describe('EventLog - mine-serp/patterns (triggered, no patterns)', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'mine-serp',
    type: 'patterns',
    resourceId: 'r1',
    triggered: true,
    modifiers: [],
    candidateTerms: [],
    detail: 'triggered but empty',
  };

  it('expands to show "Triggered, no patterns found"', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    fireEvent.click(btn);
    expect(screen.getByText(/triggered, no patterns found/i)).toBeInTheDocument();
  });

  it('mine-serp/patterns triggered-but-empty shows modifiers mention', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    fireEvent.click(btn);
    expect(screen.getByText(/modifiers/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// mine-serp/keyword
// ---------------------------------------------------------------------------

describe('EventLog - mine-serp/keyword', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'mine-serp',
    type: 'keyword',
    resourceId: 'r1',
    keyword: 'best crm software',
    titlesSeen: 15,
    competitorDomains: 4,
    rankedPulled: true,
    detail: 'keyword analysed',
  };

  it('expands to show titlesSeen', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('best crm software')).toBeInTheDocument();
  });

  it('shows competitor domains in expanded view', () => {
    renderLog([evt]);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// geo/done
// ---------------------------------------------------------------------------

describe('EventLog - geo/done', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'geo',
    type: 'done',
    resourceId: 'r1',
    heads: 3,
    cities: 10,
    combosTried: 30,
    kept: 8,
    detail: 'geo done',
  };

  it('expands to show heads x cities', () => {
    renderLog([evt]);
    const btn = screen.getByRole('button', { name: /expand event details/i });
    fireEvent.click(btn);
    expect(screen.getByText(/3 x 10/)).toBeInTheDocument();
  });

  it('expands to show combosTried and kept', () => {
    renderLog([evt]);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// grade/batch
// ---------------------------------------------------------------------------

describe('EventLog - grade/batch', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'grade',
    type: 'batch',
    resourceId: 'r1',
    graded: 20,
    kept: 10,
    rejected: 7,
    outOfScope: 3,
    avgScore: 7.5,
    detail: 'batch graded',
  };

  it('expands to show all grade stats', () => {
    renderLog([evt]);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText('20')).toBeInTheDocument(); // graded
    expect(screen.getByText('7.50')).toBeInTheDocument(); // avgScore
  });
});

// ---------------------------------------------------------------------------
// lane/agent-step
// ---------------------------------------------------------------------------

describe('EventLog - lane/agent-step', () => {
  const evt: RunEvent = {
    ts: Date.now(),
    stage: 'lane',
    type: 'agent-step',
    resourceId: 'r1',
    step: 2,
    tool: 'fetchSERP',
    produced: 50,
    kept: 30,
    detail: 'fetched serp results',
  };

  it('expands to show tool name', () => {
    renderLog([evt]);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText('fetchSERP')).toBeInTheDocument();
  });

  it('expands to show produced and kept', () => {
    renderLog([evt]);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Multiple rows - independent expand state
// ---------------------------------------------------------------------------

describe('EventLog - multiple rows independent expansion', () => {
  const events: RunEvent[] = [
    {
      ts: 1000,
      stage: 'mine-serp',
      type: 'keyword',
      resourceId: 'r1',
      keyword: 'kw1',
      titlesSeen: 5,
      competitorDomains: 1,
      rankedPulled: false,
      detail: 'kw1',
    },
    {
      ts: 2000,
      stage: 'mine-serp',
      type: 'keyword',
      resourceId: 'r1',
      keyword: 'kw2',
      titlesSeen: 9,
      competitorDomains: 2,
      rankedPulled: true,
      detail: 'kw2',
    },
  ];

  it('expanding row 0 does not expand row 1', () => {
    renderLog(events);
    const btns = screen.getAllByRole('button', { name: /expand event details/i });
    expect(btns).toHaveLength(2);
    fireEvent.click(btns[0]!);
    expect(btns[0]).toHaveAttribute('aria-expanded', 'true');
    expect(btns[1]).toHaveAttribute('aria-expanded', 'false');
  });
});

// ---------------------------------------------------------------------------
// ExplanationBanner - one test per event type
// ---------------------------------------------------------------------------

describe('EventLog - ExplanationBanner per event type', () => {
  function expand(events: RunEvent[]) {
    renderLog(events);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
  }

  it('planner/decision shows planner banner', () => {
    expand([{ ts: 1, stage: 'planner', type: 'decision', step: '1', rationale: 'r' }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Orchestrator decided to run: 1. r');
  });

  it('seed-gen/done shows seed-gen done banner', () => {
    expand([{ ts: 1, stage: 'seed-gen', type: 'done', resourceId: 'r1', count: 5 }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Generated 5 brand-free seed keywords for this offering (the starting points for expansion).');
  });

  it('broad-match/expand shows broad-match expand banner', () => {
    expand([{ ts: 1, stage: 'broad-match', type: 'expand', resourceId: 'r1', seed: 'crm', produced: 10 }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('A seed keyword was expanded into broad-match variants.');
  });

  it('mine-serp/keyword shows keyword banner', () => {
    expand([{ ts: 1, stage: 'mine-serp', type: 'keyword', resourceId: 'r1', keyword: 'crm', titlesSeen: 5, competitorDomains: 2, rankedPulled: false, detail: 'd' }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent("A keyword's SERP was analysed for competitor signals.");
  });

  it('mine-serp/patterns shows patterns banner', () => {
    expand([{ ts: 1, stage: 'mine-serp', type: 'patterns', resourceId: 'r1', triggered: true, modifiers: ['best'], candidateTerms: [], detail: 'd' }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Trend patterns were extracted from SERP titles.');
  });

  it('lane/agent-step shows lane banner', () => {
    expand([{ ts: 1, stage: 'lane', type: 'agent-step', resourceId: 'r1', step: 1, tool: 'fetchSERP', detail: 'd' }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('The lane agent executed a tool call.');
  });

  it('grade/batch shows grade banner', () => {
    expand([{ ts: 1, stage: 'grade', type: 'batch', resourceId: 'r1', graded: 10, kept: 7, rejected: 2, outOfScope: 1, avgScore: 8.0, detail: 'd' }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Scored 10 keywords 0-100 for relevance + buyer intent against the offering; kept 7 (avg 8.00), rejected 2, out-of-scope 1. Kept terms have score >= the keep threshold.');
  });

  it('pre-gate/done shows pre-gate banner', () => {
    expand([{ ts: 1, stage: 'pre-gate', type: 'done', resourceId: 'r1', kept: 5, dropped: 2, detail: 'd' }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Pre-grade filtering removed low-signal keywords.');
  });

  it('geo/done shows geo banner', () => {
    expand([{ ts: 1, stage: 'geo', type: 'done', resourceId: 'r1', heads: 3, cities: 5, combosTried: 15, kept: 10, detail: 'd' }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Geo keyword generation completed.');
  });

  it('run/complete shows run banner', () => {
    expand([{ ts: 1, stage: 'run', type: 'complete', pages: 5, selected: 20, spend: 0.05 }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Run complete: 20 keywords selected across 5 candidate pages, total spend $0.0500.');
  });

  it('cluster/done shows cluster banner', () => {
    expand([{ ts: 1, stage: 'cluster', type: 'done', count: 10 }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Keywords were clustered into topic groups.');
  });

  it('score/done shows score banner', () => {
    expand([{ ts: 1, stage: 'score', type: 'done', count: 10 }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Keywords were assigned final scores.');
  });

  it('select/done shows select banner', () => {
    expand([{ ts: 1, stage: 'select', type: 'done', count: 10 }]);
    expect(screen.getByTestId('explanation-banner')).toHaveTextContent('Top keywords were selected for the final output.');
  });
});

// ---------------------------------------------------------------------------
// Explanatory copy correctness
// ---------------------------------------------------------------------------

describe('EventLog - explanatory copy correctness', () => {
  it('grade/batch expanded detail contains "Scored" and "relevance"', () => {
    const evt: RunEvent = {
      ts: Date.now(), stage: 'grade', type: 'batch', resourceId: 'r1',
      graded: 20, kept: 10, rejected: 7, outOfScope: 3, avgScore: 7.5, detail: 'batch graded',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/scored/i)).toBeInTheDocument();
    expect(screen.getByText(/relevance/i)).toBeInTheDocument();
  });

  it('seed-gen/done expanded detail mentions "brand-free seed keywords"', () => {
    const evt: RunEvent = { ts: Date.now(), stage: 'seed-gen', type: 'done', resourceId: 'r1', count: 12 };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/brand-free seed keywords/i)).toBeInTheDocument();
  });

  it('planner/decision expanded detail mentions "Orchestrator"', () => {
    const evt: RunEvent = { ts: Date.now(), stage: 'planner', type: 'decision', step: 'broad-match', rationale: 'Need coverage' };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/orchestrator/i)).toBeInTheDocument();
  });

  it('run/complete expanded detail says "Run complete"', () => {
    const evt: RunEvent = { ts: Date.now(), stage: 'run', type: 'complete', pages: 5, selected: 42, spend: 0.0123 };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/run complete/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NEW: traceId display on grade/batch
// ---------------------------------------------------------------------------

describe('EventLog - traceId in grade/batch expanded detail', () => {
  it('shows "Portkey trace: tr_abc" when traceId is present', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'grade',
      type: 'batch',
      resourceId: 'r1',
      graded: 10,
      kept: 7,
      rejected: 2,
      outOfScope: 1,
      avgScore: 8.0,
      traceId: 'tr_abc',
      detail: 'batch graded',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/portkey trace:/i)).toBeInTheDocument();
    expect(screen.getByText(/tr_abc/)).toBeInTheDocument();
  });

  it('does not show "Portkey trace:" when traceId is absent', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'grade',
      type: 'batch',
      resourceId: 'r1',
      graded: 10,
      kept: 7,
      rejected: 2,
      outOfScope: 1,
      avgScore: 8.0,
      detail: 'batch graded',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.queryByText(/portkey trace:/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NEW: traceId display on lane/agent-step
// ---------------------------------------------------------------------------

describe('EventLog - traceId in lane/agent-step expanded detail', () => {
  it('shows "Portkey trace: tr_lane_xyz" when traceId is present', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'lane',
      type: 'agent-step',
      resourceId: 'r1',
      step: 1,
      tool: 'fetchSERP',
      traceId: 'tr_lane_xyz',
      detail: 'did stuff',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/portkey trace:/i)).toBeInTheDocument();
    expect(screen.getByText(/tr_lane_xyz/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NEW: traceId display on mine-serp/patterns
// ---------------------------------------------------------------------------

describe('EventLog - traceId in mine-serp/patterns expanded detail', () => {
  it('shows "Portkey trace: tr_serp_1" when traceId is present', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'mine-serp',
      type: 'patterns',
      resourceId: 'r1',
      triggered: true,
      modifiers: ['custom', 'design'],
      candidateTerms: ['custom pantry design'],
      traceId: 'tr_serp_1',
      detail: 'patterns found',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/portkey trace:/i)).toBeInTheDocument();
    expect(screen.getByText(/tr_serp_1/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NEW: mine-serp/patterns lists exact modifiers and candidateTerms
// ---------------------------------------------------------------------------

describe('EventLog - mine-serp/patterns lists exact detected patterns', () => {
  it('shows "Detected modifiers: custom, design" in expanded detail', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'mine-serp',
      type: 'patterns',
      resourceId: 'r1',
      triggered: true,
      modifiers: ['custom', 'design'],
      candidateTerms: ['custom pantry design'],
      detail: 'patterns found',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/detected modifiers:/i)).toBeInTheDocument();
    expect(screen.getByText(/custom, design/)).toBeInTheDocument();
  });

  it('shows "Synthesized candidate keywords: custom pantry design" in expanded detail', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'mine-serp',
      type: 'patterns',
      resourceId: 'r1',
      triggered: true,
      modifiers: ['custom', 'design'],
      candidateTerms: ['custom pantry design'],
      detail: 'patterns found',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/synthesized candidate keywords:/i)).toBeInTheDocument();
    expect(screen.getByText(/custom pantry design/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NEW: mine-serp/done re-feed counts
// ---------------------------------------------------------------------------

describe('EventLog - mine-serp/done re-feed counts', () => {
  it('shows patternKept > 0 re-feed linkage text', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'mine-serp',
      type: 'done',
      resourceId: 'r1',
      serperQueries: 5,
      competitorDomains: 3,
      rankedKeywordPulls: 2,
      rankedTermsPulled: 10,
      trendsSpawned: 1,
      trendsPatterns: 4,
      patternKept: 4,
      competitorKept: 2,
      detail: 'mine-serp done',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/4 were kept and re-fed into broad-match/i)).toBeInTheDocument();
    expect(screen.getByText(/2 competitor keywords kept/i)).toBeInTheDocument();
  });

  it('shows "0 novel pattern keywords survived dedup" when patternKept is 0', () => {
    const evt: RunEvent = {
      ts: Date.now(),
      stage: 'mine-serp',
      type: 'done',
      resourceId: 'r1',
      serperQueries: 5,
      competitorDomains: 3,
      rankedKeywordPulls: 2,
      rankedTermsPulled: 10,
      trendsSpawned: 1,
      trendsPatterns: 4,
      patternKept: 0,
      competitorKept: 0,
      detail: 'mine-serp done',
    };
    render(<EventLog log={[evt]} selectedStage={null} />);
    fireEvent.click(screen.getByRole('button', { name: /expand event details/i }));
    expect(screen.getByText(/0 novel pattern keywords survived dedup/i)).toBeInTheDocument();
  });
});
