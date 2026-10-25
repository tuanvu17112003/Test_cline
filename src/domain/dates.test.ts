import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildMonthGrid,
  differenceInDays,
  formatDate,
  formatMonthYear,
  getDueState,
  isOverdue,
  isValidDateString,
  isValidTimestamp,
  isValidYearMonth,
  parseISODate,
  shiftMonth,
  toISODate,
  todayISO,
} from './dates';

const TODAY = '2026-03-10';

describe('date validation', () => {
  it('accepts real calendar dates', () => {
    expect(isValidDateString('2026-03-10')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
  });

  it('rejects impossible or malformed dates', () => {
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2025-02-29')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-3-1')).toBe(false);
    expect(isValidDateString('10/03/2026')).toBe(false);
    expect(isValidDateString(null)).toBe(false);
  });

  it('validates timestamps', () => {
    expect(isValidTimestamp('2026-03-10T09:00:00.000Z')).toBe(true);
    expect(isValidTimestamp('not-a-date')).toBe(false);
    expect(isValidTimestamp(12345)).toBe(false);
  });

  it('validates year/month pairs', () => {
    expect(isValidYearMonth(2026, 0)).toBe(true);
    expect(isValidYearMonth(2026, 12)).toBe(false);
    expect(isValidYearMonth(1900, 5)).toBe(false);
  });
});

describe('calendar date arithmetic', () => {
  it('round-trips local dates without timezone drift', () => {
    const iso = '2026-03-10';
    expect(toISODate(parseISODate(iso))).toBe(iso);
    expect(todayISO(new Date(2026, 2, 10, 23, 30))).toBe(iso);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-03-10', 0)).toBe('2026-03-10');
  });

  it('computes whole-day differences', () => {
    expect(differenceInDays('2026-03-11', '2026-03-10')).toBe(1);
    expect(differenceInDays('2026-03-09', '2026-03-10')).toBe(-1);
    expect(differenceInDays('2026-04-09', '2026-03-10')).toBe(30);
  });

  it('shifts months and wraps years', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
  });
});

describe('overdue calculations', () => {
  it('flags past due dates that are not complete', () => {
    expect(isOverdue('2026-03-09', 'todo', TODAY)).toBe(true);
    expect(isOverdue('2026-03-09', 'done', TODAY)).toBe(false);
    expect(isOverdue('2026-03-10', 'todo', TODAY)).toBe(false);
    expect(isOverdue(null, 'todo', TODAY)).toBe(false);
  });

  it('classifies due states used by the UI', () => {
    expect(getDueState(null, 'todo', TODAY)).toBe('none');
    expect(getDueState('2026-03-09', 'todo', TODAY)).toBe('overdue');
    expect(getDueState('2026-03-10', 'todo', TODAY)).toBe('today');
    expect(getDueState('2026-03-11', 'todo', TODAY)).toBe('soon');
    expect(getDueState('2026-03-20', 'todo', TODAY)).toBe('upcoming');
    expect(getDueState('2026-03-09', 'done', TODAY)).toBe('complete');
  });
});

describe('formatting', () => {
  it('formats dates for display', () => {
    expect(formatDate(null)).toBe('No due date');
    expect(formatDate('2026-03-10')).toBe('Mar 10');
    expect(formatDate('2026-03-10', { month: 'long', day: 'numeric', year: 'numeric' })).toBe(
      'March 10, 2026',
    );
    expect(formatDate('2026-03-10', { year: 'numeric' })).toBe('2026');
  });

  it('labels months', () => {
    expect(formatMonthYear(2026, 2)).toBe('March 2026');
  });
});

describe('month grid', () => {
  it('always returns six Monday-first weeks', () => {
    const grid = buildMonthGrid(2026, 2, TODAY);
    expect(grid).toHaveLength(6);
    expect(grid.every((week) => week.length === 7)).toBe(true);
    // March 2026 starts on a Sunday, so the Monday-first grid starts on 23 Feb.
    expect(grid[0][0].date).toBe('2026-02-23');
    expect(grid[0][6].date).toBe('2026-03-01');
    expect(grid[5][6].date).toBe('2026-04-05');
  });

  it('marks today and out-of-month days', () => {
    const grid = buildMonthGrid(2026, 2, TODAY);
    const flat = grid.flat();
    expect(flat.filter((day) => day.isToday)).toHaveLength(1);
    expect(flat.find((day) => day.date === TODAY)?.inMonth).toBe(true);
    expect(flat.find((day) => day.date === '2026-02-23')?.inMonth).toBe(false);
    expect(flat.every((day, index) => index === 0 || day.date > flat[index - 1].date)).toBe(true);
  });
});
