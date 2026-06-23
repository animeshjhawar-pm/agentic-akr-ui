// components/RunTimer.test.tsx

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import RunTimer from './RunTimer';

describe('RunTimer', () => {
  it('renders a dash when start is null', () => {
    render(<RunTimer startMs={null} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('renders the static total when end is provided (logged duration)', () => {
    const start = 1_000_000;
    render(<RunTimer startMs={start} endMs={start + 65_000} />);
    expect(screen.getByText('1m 5s')).toBeInTheDocument();
  });

  describe('live ticking', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('grows once per second when end is omitted', () => {
      const start = 2_000_000;
      vi.setSystemTime(start); // base clock; render reads Date.now() === start -> 0s

      render(<RunTimer startMs={start} />);
      expect(screen.getByText('0s')).toBeInTheDocument();

      // advanceTimersByTime moves the faked Date too; each tick re-renders and the
      // render reads the advanced Date.now(), so after 3s it shows start + 3000.
      act(() => {
        vi.advanceTimersByTime(3_000);
      });
      expect(screen.getByText('3s')).toBeInTheDocument();
    });
  });
});
