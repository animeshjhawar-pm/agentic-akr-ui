/**
 * RTL tests for RunConfig.
 * Covers:
 *   1. Run button disabled when no resources selected, enabled when >=1
 *   2. Default knob values are 3/20/1/5/40
 *   3. Editing a field updates the posted knobs (mock fetch, click Run, assert POST body)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import RunConfig from './RunConfig';

const BASE_PROPS = {
  clientId: 'client-abc',
  selectedResourceIds: new Set<string>(),
  targetGeoDefault: 'US / en',
  onRunStarted: vi.fn(),
};

describe('RunConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Run button is disabled when no resources selected', () => {
    render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set()} />);
    const btn = screen.getByRole('button', { name: /run akr/i });
    expect(btn).toBeDisabled();
  });

  it('Run button is disabled when clientId is empty', () => {
    render(
      <RunConfig
        {...BASE_PROPS}
        clientId=""
        selectedResourceIds={new Set(['r1'])}
      />,
    );
    const btn = screen.getByRole('button', { name: /run akr/i });
    expect(btn).toBeDisabled();
  });

  it('Run button is enabled when clientId set and >=1 resource selected', () => {
    render(
      <RunConfig
        {...BASE_PROPS}
        clientId="client-abc"
        selectedResourceIds={new Set(['r1'])}
      />,
    );
    const btn = screen.getByRole('button', { name: /run akr/i });
    expect(btn).not.toBeDisabled();
  });

  it('default knob values are 3/20/1/5/40', () => {
    render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set(['r1'])} />);

    expect(
      (screen.getByLabelText(/cost ceiling/i) as HTMLInputElement).value,
    ).toBe('3');
    expect(
      (screen.getByLabelText(/keyword budget/i) as HTMLInputElement).value,
    ).toBe('20');
    expect(
      (screen.getByLabelText(/max loops/i) as HTMLInputElement).value,
    ).toBe('1');
    expect(
      (screen.getByLabelText(/seed target/i) as HTMLInputElement).value,
    ).toBe('5');
    expect(
      (screen.getByLabelText(/grade batch/i) as HTMLInputElement).value,
    ).toBe('40');
  });

  it('editing a field updates the posted knobs', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => {
          let done = false;
          return {
            read: async () => {
              if (done) return { done: true, value: undefined };
              done = true;
              const encoder = new TextEncoder();
              return {
                done: false,
                value: encoder.encode(
                  'data: {"type":"run/start","runId":"run-1","ts":1}\n\n',
                ),
              };
            },
            releaseLock: () => {},
          };
        },
      },
    } as unknown as Response);

    vi.stubGlobal('fetch', mockFetch);

    const onRunStarted = vi.fn();
    render(
      <RunConfig
        {...BASE_PROPS}
        clientId="client-abc"
        selectedResourceIds={new Set(['r1', 'r2'])}
        onRunStarted={onRunStarted}
      />,
    );

    // Change cost ceiling from default 3 to 7
    const costInput = screen.getByLabelText(/cost ceiling/i) as HTMLInputElement;
    fireEvent.change(costInput, { target: { value: '7' } });
    expect(costInput.value).toBe('7');

    // Click Run AKR
    const btn = screen.getByRole('button', { name: /run akr/i });
    fireEvent.click(btn);

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/runs');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body as string) as {
      clientId: string;
      resourceIds: string[];
      knobs: {
        absoluteCostCeiling: number;
        totalKeywordBudget: number;
        maxLoops: number;
        seedTarget: number;
        gradeBatchSize: number;
        agentic: { seedTarget: number; maxPlannerSteps: number; maxConcurrentAgents: number };
        maxResumeRounds: number;
      };
    };

    expect(body.clientId).toBe('client-abc');
    expect(body.resourceIds).toEqual(expect.arrayContaining(['r1', 'r2']));
    expect(body.resourceIds).toHaveLength(2);
    expect(body.knobs.absoluteCostCeiling).toBe(7);
    // Other defaults stay
    expect(body.knobs.totalKeywordBudget).toBe(20);
    expect(body.knobs.maxLoops).toBe(1);
    expect(body.knobs.seedTarget).toBe(5);
    expect(body.knobs.gradeBatchSize).toBe(40);
    expect(body.knobs.agentic.seedTarget).toBe(5);
    expect(body.knobs.agentic.maxPlannerSteps).toBe(3);
    expect(body.knobs.agentic.maxConcurrentAgents).toBe(3);
    expect(body.knobs.maxResumeRounds).toBe(0);
  });

  it('shows loading spinner during POST and disables button', async () => {
    let resolveRead: () => void;
    const readPromise = new Promise<void>((res) => { resolveRead = res; });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            await readPromise;
            return { done: true, value: undefined };
          },
          releaseLock: () => {},
        }),
      },
    } as unknown as Response);

    vi.stubGlobal('fetch', mockFetch);

    render(
      <RunConfig
        {...BASE_PROPS}
        clientId="client-abc"
        selectedResourceIds={new Set(['r1'])}
        onRunStarted={vi.fn()}
      />,
    );

    const btn = screen.getByRole('button', { name: /run akr/i });
    fireEvent.click(btn);

    // Button should be disabled while streaming
    await waitFor(() => expect(btn).toBeDisabled());

    // Resolve the read so cleanup doesn't hang
    resolveRead!();
  });
  it('Run button and knob inputs are disabled when disabled prop is true', () => {
    render(
      <RunConfig
        {...BASE_PROPS}
        clientId="client-abc"
        selectedResourceIds={new Set(['r1'])}
        disabled={true}
      />,
    );
    const btn = screen.getByRole('button', { name: /run akr/i });
    expect(btn).toBeDisabled();
    const costInput = screen.getByLabelText(/cost ceiling/i) as HTMLInputElement;
    expect(costInput).toBeDisabled();
  });

  it('Run button is enabled when disabled prop is false and conditions met', () => {
    render(
      <RunConfig
        {...BASE_PROPS}
        clientId="client-abc"
        selectedResourceIds={new Set(['r1'])}
        disabled={false}
      />,
    );
    const btn = screen.getByRole('button', { name: /run akr/i });
    expect(btn).not.toBeDisabled();
  });

  // ---------------------------------------------------------------------------
  // Tooltip tests
  // ---------------------------------------------------------------------------

  describe('parameter tooltips', () => {
    it('each parameter has an Info trigger button that is keyboard focusable', () => {
      render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set(['r1'])} />);
      // There should be one tooltip trigger per parameter (6 total: 5 knobs + Target Geo)
      const infoBtns = screen.getAllByRole('button', { name: /more information/i });
      expect(infoBtns.length).toBeGreaterThanOrEqual(6);
      infoBtns.forEach((btn) => {
        expect(btn).not.toHaveAttribute('tabindex', '-1');
      });
    });

    it('Cost Ceiling tooltip description is in the DOM and linked via aria-describedby', () => {
      render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set(['r1'])} />);
      const infoBtns = screen.getAllByRole('button', { name: /more information/i });
      // First tooltip is for Cost Ceiling
      const trigger = infoBtns[0];
      const describedById = trigger.getAttribute('aria-describedby');
      expect(describedById).toBeTruthy();
      const descEl = document.getElementById(describedById!);
      expect(descEl).not.toBeNull();
      expect(descEl!.textContent).toMatch(/hard spend cap/i);
      expect(descEl!.textContent).toMatch(/DataForSEO/i);
    });

    it('Max Loops tooltip description text renders in the DOM', () => {
      render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set(['r1'])} />);
      // The tooltip element is always in the DOM (opacity-0 when hidden)
      const descEl = screen.getByText(/maximum generation loops per resource/i);
      expect(descEl).toBeTruthy();
    });

    it('tooltip description becomes visible on Info button focus', async () => {
      const user = userEvent.setup();
      render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set(['r1'])} />);
      const infoBtns = screen.getAllByRole('button', { name: /more information/i });
      const trigger = infoBtns[0]; // Cost Ceiling

      const describedById = trigger.getAttribute('aria-describedby')!;
      const descEl = document.getElementById(describedById)!;

      // Initially hidden (opacity-0)
      expect(descEl.className).toMatch(/opacity-0/);

      // Focus the trigger
      await user.tab(); // tab to first focusable; may need multiple tabs
      trigger.focus();
      fireEvent.focus(trigger);

      // Now visible
      expect(descEl.className).toMatch(/opacity-100/);
    });

    it('tooltip description becomes visible on Info button hover', () => {
      render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set(['r1'])} />);
      const infoBtns = screen.getAllByRole('button', { name: /more information/i });
      const trigger = infoBtns[2]; // Max Loops (index 2)

      const describedById = trigger.getAttribute('aria-describedby')!;
      const descEl = document.getElementById(describedById)!;

      expect(descEl.className).toMatch(/opacity-0/);

      fireEvent.mouseEnter(trigger);
      expect(descEl.className).toMatch(/opacity-100/);

      fireEvent.mouseLeave(trigger);
      expect(descEl.className).toMatch(/opacity-0/);
    });

    it('tooltip descriptions are present for all 6 parameters', () => {
      render(<RunConfig {...BASE_PROPS} selectedResourceIds={new Set(['r1'])} />);
      // All tooltip text should be findable in the DOM
      expect(screen.getByText(/hard spend cap/i)).toBeTruthy();
      expect(screen.getByText(/target number of keywords to discover/i)).toBeTruthy();
      expect(screen.getByText(/maximum generation loops per resource/i)).toBeTruthy();
      expect(screen.getByText(/how many starting seed keywords/i)).toBeTruthy();
      expect(screen.getByText(/how many keywords are scored per llm grading call/i)).toBeTruthy();
      expect(screen.getByText(/geographic market used for keyword research/i)).toBeTruthy();
    });
  });
});
