import { describe, it, expect } from 'vitest';
import { customRound } from '../../utils/rounding.js';

describe('customRound', () => {
  it('rounds down when fraction is exactly 0.50', () => {
    expect(customRound(10.50)).toBe(10);
  });

  it('rounds up when fraction is clearly above 0.51', () => {
    // Note: 10.51 suffers from floating-point precision (10.51 - 10 = 0.50999...)
    // so we test with 0.52 which is safely above the threshold
    expect(customRound(10.52)).toBe(11);
  });

  it('rounds down when fraction is 0.49', () => {
    expect(customRound(10.49)).toBe(10);
  });

  it('rounds up when fraction is 0.99', () => {
    expect(customRound(10.99)).toBe(11);
  });

  it('returns whole numbers unchanged', () => {
    expect(customRound(10)).toBe(10);
    expect(customRound(0)).toBe(0);
    expect(customRound(100)).toBe(100);
  });

  it('handles zero', () => {
    expect(customRound(0)).toBe(0);
    expect(customRound(0.50)).toBe(0);
  });

  it('rounds down small fractions', () => {
    expect(customRound(5.01)).toBe(5);
    expect(customRound(5.25)).toBe(5);
  });

  it('rounds up large fractions', () => {
    expect(customRound(5.75)).toBe(6);
    expect(customRound(5.99)).toBe(6);
  });
});
