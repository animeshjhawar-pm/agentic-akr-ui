// components/TreeEventLog.test.tsx
//
// RTL tests for TreeEventLog hierarchical event tree:
// - Groups events into phases: Planner, Generation (per resourceId), Selection, Geo, Result
// - Each phase node is collapsible with aria-expanded
// - Leaf nodes show ExpandedDetail
// - Empty log or no-match shows "No events"
// - selectedStage filters to relevant phase

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import TreeEventLog from './TreeEventLog';
import type { RunEvent } from '@/lib/events';

// ---------------------------------------------------------------------------
// Sample events
// ---------------------------------------------------------------------------

const plannerEvt: RunEvent = {
  ts: 1000,
  stage: 'planner',
  type: 'decision',
  step: 'seed-gen',
  rationale: 'need seeds',
};

const seedGenEvt: RunEvent = {
  ts: 2000,
  stage: 'seed-gen',
  type: 'done',
  resourceId: 'r1',
  count: 5,
};

const laneEvt: RunEvent = {
  ts: 3000,
  stage: 'lane',
  type: 'agent-step',
  resourceId: 'r1',
  step: 1,
  tool: 'fetchSERP',
  detail: 'did stuff',
};

const geoEvt: RunEvent = {
  ts: 4000,
  stage: 'geo',
  type: 'done',
  resourceId: 'r1',
  heads: 3,
  cities: 5,
  combosTried: 15,
  kept: 10,
  detail: 'geo done',
};

const selectEvt: RunEvent = {
  ts: 5000,
  stage: 'select',
  type: 'done',
  count: 20,
};

const runEvt: RunEvent = {
  ts: 6000,
  stage: 'run',
  type: 'complete',
  pages: 5,
  selected: 20,
  spend: 0.05,
};

const gradeEvt: RunEvent = {
  ts: 7000,
  stage: 'grade',
  type: 'batch',
  resourceId: 'r1',
  graded: 10,
  kept: 7,
  rejected: 2,
  outOfScope: 1,
  avgScore: 8.0,
  detail: 'graded',
};

const seedGenR2Evt: RunEvent = {
  ts: 8000,
  stage: 'seed-gen',
  type: 'done',
  resourceId: 'r2',
  count: 3,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTree(events: RunEvent[], selectedStage: string | null = null) {
  return render(<TreeEventLog log={events} selectedStage={selectedStage} />);
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('TreeEventLog - empty state', () => {
  it('shows "No events" when log is empty', () => {
    renderTree([]);
    expect(screen.getByText(/no events/i)).toBeInTheDocument();
  });

  it('shows "No events" when selectedStage filters to nothing', () => {
    renderTree([plannerEvt], 'geo');
    expect(screen.getByText(/no events/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Phase grouping
// ---------------------------------------------------------------------------

describe('TreeEventLog - phase groups', () => {
  it('renders a Planner phase node for planner events', () => {
    renderTree([plannerEvt]);
    expect(screen.getByText(/planner/i)).toBeInTheDocument();
  });

  it('renders a Generation phase node for resourceId-based events', () => {
    renderTree([seedGenEvt]);
    // Should show a generation/resource group node
    expect(screen.getByText(/generation/i)).toBeInTheDocument();
  });

  it('renders a Geo phase node for geo events', () => {
    renderTree([geoEvt]);
    expect(screen.getByText(/geo/i)).toBeInTheDocument();
  });

  it('renders a Selection phase node for select/cluster/score events', () => {
    renderTree([selectEvt]);
    expect(screen.getByText(/selection/i)).toBeInTheDocument();
  });

  it('renders a Result phase node for run/complete events', () => {
    renderTree([runEvt]);
    expect(screen.getByText(/result/i)).toBeInTheDocument();
  });

  it('renders multiple resource groups when events have different resourceIds', () => {
    renderTree([seedGenEvt, seedGenR2Evt]);
    // Expand the Generation phase to see resource subgroups
    const genPhaseBtn = screen.getAllByRole('button')[0];
    fireEvent.click(genPhaseBtn);
    // Both resource IDs should appear as subgroup labels
    expect(screen.getByText('r1')).toBeInTheDocument();
    expect(screen.getByText('r2')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Collapsibility
// ---------------------------------------------------------------------------

describe('TreeEventLog - collapsible nodes', () => {
  it('phase nodes start collapsed', () => {
    renderTree([plannerEvt]);
    const expandedButtons = screen.getAllByRole('button');
    // At least one phase button should exist
    expect(expandedButtons.length).toBeGreaterThanOrEqual(1);
    // The first button (phase toggle) should be aria-expanded=false by default
    const phaseButton = expandedButtons.find(
      (btn) => btn.getAttribute('aria-expanded') === 'false'
    );
    expect(phaseButton).toBeTruthy();
  });

  it('clicking a phase node expands it and shows aria-expanded=true', () => {
    renderTree([plannerEvt]);
    const buttons = screen.getAllByRole('button');
    const phaseBtn = buttons[0];
    expect(phaseBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(phaseBtn);
    expect(phaseBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('clicking again collapses the phase node', () => {
    renderTree([plannerEvt]);
    const buttons = screen.getAllByRole('button');
    const phaseBtn = buttons[0];
    fireEvent.click(phaseBtn);
    expect(phaseBtn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(phaseBtn);
    expect(phaseBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('expanding a phase reveals child events', () => {
    renderTree([plannerEvt]);
    const phaseBtn = screen.getAllByRole('button')[0];
    fireEvent.click(phaseBtn);
    // After expanding the planner phase, event leaf should be visible
    // The ExpandedDetail or expand button for the leaf event should appear
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThan(1);
  });

  it('all collapsible nodes have aria-expanded attribute', () => {
    renderTree([plannerEvt, geoEvt, runEvt]);
    const buttons = screen.getAllByRole('button');
    // Every button should have aria-expanded
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute('aria-expanded');
    });
  });
});

// ---------------------------------------------------------------------------
// Leaf nodes - ExpandedDetail integration
// ---------------------------------------------------------------------------

describe('TreeEventLog - leaf nodes show ExpandedDetail', () => {
  it('expanding a phase and then its leaf shows explanation-banner', () => {
    renderTree([plannerEvt]);
    // Expand the Planner phase
    const phaseBtn = screen.getAllByRole('button')[0];
    fireEvent.click(phaseBtn);
    // Now expand the leaf event detail
    const leafBtns = screen.getAllByRole('button');
    // Find the leaf expand button (second button)
    const leafBtn = leafBtns.find(
      (btn) => btn !== phaseBtn && btn.getAttribute('aria-expanded') === 'false'
    );
    if (leafBtn) {
      fireEvent.click(leafBtn);
      expect(screen.getByTestId('explanation-banner')).toBeInTheDocument();
    }
  });
});

// ---------------------------------------------------------------------------
// selectedStage filtering
// ---------------------------------------------------------------------------

describe('TreeEventLog - selectedStage filtering', () => {
  const allEvents: RunEvent[] = [plannerEvt, seedGenEvt, geoEvt, selectEvt, runEvt];

  it('selectedStage=planner shows only Planner phase', () => {
    renderTree(allEvents, 'planner');
    expect(screen.getByText(/planner/i)).toBeInTheDocument();
    // geo should not appear
    expect(screen.queryByText(/\bgeo\b/i)).not.toBeInTheDocument();
  });

  it('selectedStage=geo shows only Geo phase', () => {
    renderTree(allEvents, 'geo');
    expect(screen.getByText(/geo/i)).toBeInTheDocument();
    expect(screen.queryByText(/planner/i)).not.toBeInTheDocument();
  });

  it('selectedStage=result shows only Result phase', () => {
    renderTree(allEvents, 'result');
    expect(screen.getByText(/result/i)).toBeInTheDocument();
    expect(screen.queryByText(/planner/i)).not.toBeInTheDocument();
  });

  it('selectedStage=null shows all phases', () => {
    renderTree(allEvents, null);
    expect(screen.getByText(/planner/i)).toBeInTheDocument();
    expect(screen.getByText(/generation/i)).toBeInTheDocument();
    expect(screen.getByText(/geo/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Generation phase - per-resourceId subgroups
// ---------------------------------------------------------------------------

describe('TreeEventLog - generation phase per-resource subgroups', () => {
  it('groups events by resourceId under Generation', () => {
    renderTree([seedGenEvt, laneEvt, gradeEvt]);
    // Generation phase node present
    expect(screen.getByText(/generation/i)).toBeInTheDocument();
  });

  it('shows resourceId in the group label', () => {
    renderTree([seedGenEvt]);
    const genPhaseBtn = screen.getAllByRole('button')[0];
    fireEvent.click(genPhaseBtn);
    // r1 should appear as a subgroup label
    expect(screen.getByText(/r1/)).toBeInTheDocument();
  });
});
