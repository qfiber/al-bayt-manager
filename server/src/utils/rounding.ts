/**
 * Custom rounding: fractional part ≤0.50 → floor, ≥0.51 → ceil
 */
export function customRound(value: number): number {
  const whole = Math.floor(value);
  const frac = value - whole;
  return frac >= 0.51 ? whole + 1 : whole;
}
