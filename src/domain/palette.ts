import type { Priority, TaskStatus } from './types';

/** Chart/UI palette. Literal hex values so SVG fills work in both themes. */
export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: '#94a3b8',
  todo: '#0ea5e9',
  in_progress: '#f59e0b',
  done: '#10b981',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: '#64748b',
  medium: '#0ea5e9',
  high: '#f97316',
  critical: '#e11d48',
};

export const CHART_SERIES_COLOR = '#5348e0';

/** Tailwind class fragments keyed by priority (used by badges and cards). */
export const PRIORITY_TEXT_CLASSES: Record<Priority, string> = {
  low: 'text-slate-600 dark:text-slate-300',
  medium: 'text-sky-700 dark:text-sky-300',
  high: 'text-orange-700 dark:text-orange-300',
  critical: 'text-rose-700 dark:text-rose-300',
};

export const PRIORITY_BG_CLASSES: Record<Priority, string> = {
  low: 'bg-slate-100 dark:bg-slate-800/70',
  medium: 'bg-sky-100 dark:bg-sky-900/50',
  high: 'bg-orange-100 dark:bg-orange-900/40',
  critical: 'bg-rose-100 dark:bg-rose-900/40',
};

export const STATUS_BG_CLASSES: Record<TaskStatus, string> = {
  backlog: 'bg-slate-100 dark:bg-slate-800/70',
  todo: 'bg-sky-100 dark:bg-sky-900/50',
  in_progress: 'bg-amber-100 dark:bg-amber-900/40',
  done: 'bg-emerald-100 dark:bg-emerald-900/40',
};

export const STATUS_TEXT_CLASSES: Record<TaskStatus, string> = {
  backlog: 'text-slate-700 dark:text-slate-300',
  todo: 'text-sky-800 dark:text-sky-200',
  in_progress: 'text-amber-800 dark:text-amber-200',
  done: 'text-emerald-800 dark:text-emerald-200',
};
