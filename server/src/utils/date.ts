/**
 * Format date from DB (yyyy-mm-dd) to UI (dd/mm/yyyy)
 */
export function formatDateForUI(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Format date from UI (dd/mm/yyyy) to DB (yyyy-mm-dd)
 */
export function formatDateForDB(date: string): string {
  const [d, m, y] = date.split('/');
  return `${y}-${m}-${d}`;
}

/**
 * Get current month as YYYY-MM
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get days in a month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
