/** Local-calendar date helpers. All due dates are `YYYY-MM-DD` strings. */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** True only for real calendar dates (`2026-02-30` is rejected). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Parses a calendar date into local midnight. Never shifts across timezones. */
export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value: string, amount: number): string {
  const date = parseISODate(value);
  date.setDate(date.getDate() + amount);
  return toISODate(date);
}

/** Whole days from `from` to `to` (positive when `to` is later). DST-safe. */
export function differenceInDays(to: string, from: string): number {
  const a = parseISODate(to);
  const b = parseISODate(from);
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / MS_PER_DAY);
}

export function isValidYearMonth(year: number, monthIndex: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(monthIndex) &&
    monthIndex >= 0 &&
    monthIndex <= 11 &&
    year >= 1970 &&
    year <= 3000
  );
}

export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'upcoming' | 'complete';

export function getDueState(
  dueDate: string | null,
  status: string,
  today: string = todayISO(),
): DueState {
  if (!dueDate) return 'none';
  if (status === 'done') return 'complete';
  const delta = differenceInDays(dueDate, today);
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  if (delta <= 2) return 'soon';
  return 'upcoming';
}

export function isOverdue(
  dueDate: string | null,
  status: string,
  today: string = todayISO(),
): boolean {
  return Boolean(dueDate) && status !== 'done' && differenceInDays(dueDate as string, today) < 0;
}

export function formatDate(
  value: string | null,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  if (!value) return 'No due date';
  if (!isValidDateString(value)) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', options).format(parseISODate(value));
}

export function formatFullDate(value: string | null): string {
  return formatDate(value, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(value: string): string {
  if (!isValidTimestamp(value)) return 'Unknown';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatRelativeTime(value: string, now: Date = new Date()): string {
  if (!isValidTimestamp(value)) return 'Unknown';
  const timestamp = new Date(value).getTime();
  const diffSeconds = Math.round((timestamp - now.getTime()) / 1000);
  const absolute = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (absolute < 45) return 'Just now';
  if (absolute < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute');
  if (absolute < 86_400) return formatter.format(Math.round(diffSeconds / 3600), 'hour');
  if (absolute < 604_800) return formatter.format(Math.round(diffSeconds / 86_400), 'day');
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(timestamp),
  );
}

export function formatMonthYear(year: number, monthIndex: number): string {
  return `${MONTH_LABELS[monthIndex]} ${year}`;
}

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

/**
 * Builds a Monday-first 6x7 month grid so the calendar height never jumps
 * between months.
 */
export function buildMonthGrid(
  year: number,
  monthIndex: number,
  today: string = todayISO(),
): CalendarDay[][] {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const offset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
  const gridStart = new Date(year, monthIndex, 1 - offset);

  const weeks: CalendarDay[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: CalendarDay[] = [];
    for (let day = 0; day < 7; day += 1) {
      const current = new Date(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + week * 7 + day,
      );
      const iso = toISODate(current);
      days.push({
        date: iso,
        dayOfMonth: current.getDate(),
        inMonth: current.getMonth() === monthIndex && current.getFullYear() === year,
        isToday: iso === today,
        isWeekend: day >= 5,
      });
    }
    weeks.push(days);
  }
  return weeks;
}

export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function toMonthInputValue(date: string): string {
  return date.slice(0, 7);
}
