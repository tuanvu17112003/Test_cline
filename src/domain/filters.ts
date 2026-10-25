import { addDays, isOverdue, todayISO } from './dates';
import { PRIORITY_RANK, type Priority, type Task, type TaskStatus } from './types';

export const DUE_FILTERS = ['all', 'overdue', 'today', 'week', 'none'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const DUE_FILTER_LABELS: Record<DueFilter, string> = {
  all: 'Any due date',
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Next 7 days',
  none: 'No due date',
};

export interface TaskFilters {
  search: string;
  status: TaskStatus | 'all';
  priority: Priority | 'all';
  projectId: string | 'all';
  due: DueFilter;
}

export const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  status: 'all',
  priority: 'all',
  projectId: 'all',
  due: 'all',
};

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.projectId !== 'all' ||
    filters.due !== 'all'
  );
}

export function activeFilterCount(filters: TaskFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.status !== 'all') count += 1;
  if (filters.priority !== 'all') count += 1;
  if (filters.projectId !== 'all') count += 1;
  if (filters.due !== 'all') count += 1;
  return count;
}

/** Every whitespace-separated term must appear in the title, description or labels. */
export function matchesSearch(task: Task, query: string): boolean {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const haystack = `${task.title} ${task.description} ${task.labels.join(' ')}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function matchesDueFilter(
  task: Task,
  due: DueFilter,
  today: string = todayISO(),
): boolean {
  switch (due) {
    case 'all':
      return true;
    case 'overdue':
      return isOverdue(task.dueDate, task.status, today);
    case 'today':
      return task.dueDate === today;
    case 'week': {
      if (!task.dueDate) return false;
      const horizon = addDays(today, 7);
      return task.dueDate >= today && task.dueDate <= horizon;
    }
    case 'none':
      return task.dueDate === null;
    default:
      return true;
  }
}

export function filterTasks(
  tasks: readonly Task[],
  filters: TaskFilters,
  today: string = todayISO(),
): Task[] {
  return tasks.filter((task) => {
    if (filters.status !== 'all' && task.status !== filters.status) return false;
    if (filters.priority !== 'all' && task.priority !== filters.priority) return false;
    if (filters.projectId !== 'all' && task.projectId !== filters.projectId) return false;
    if (!matchesDueFilter(task, filters.due, today)) return false;
    return matchesSearch(task, filters.search);
  });
}

/** Planning order: unfinished first, soonest due date, then priority. */
export function sortTasksForList(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0;
    const bDone = b.status === 'done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    const priorityDelta = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return a.order - b.order || a.title.localeCompare(b.title);
  });
}
