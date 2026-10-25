import { describe, expect, it } from 'vitest';
import { makeTask } from '../test/fixtures';
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  filterTasks,
  hasActiveFilters,
  matchesSearch,
  sortTasksForList,
} from './filters';
import type { Task } from './types';

const TODAY = '2026-03-10';

const tasks: Task[] = [
  makeTask({
    id: 't1',
    title: 'Design landing page',
    description: 'Hero section and pricing table',
    projectId: 'p1',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-03-11',
    labels: ['design'],
    order: 0,
  }),
  makeTask({
    id: 't2',
    title: 'Fix login bug',
    description: 'Session expires too early on Safari',
    projectId: 'p1',
    status: 'in_progress',
    priority: 'critical',
    dueDate: '2026-03-05',
    labels: ['bug', 'auth'],
    order: 0,
  }),
  makeTask({
    id: 't3',
    title: 'Write documentation',
    description: 'API reference for the public endpoints',
    projectId: 'p2',
    status: 'done',
    priority: 'low',
    dueDate: null,
    labels: ['docs'],
    order: 0,
  }),
  makeTask({
    id: 't4',
    title: 'Plan roadmap',
    description: 'Quarterly planning with stakeholders',
    projectId: 'p2',
    status: 'backlog',
    priority: 'medium',
    dueDate: TODAY,
    labels: ['planning'],
    order: 0,
  }),
  makeTask({
    id: 't5',
    title: 'Tune database indexes',
    description: 'Reduce query time on the activity feed',
    projectId: 'p1',
    status: 'todo',
    priority: 'medium',
    dueDate: '2026-03-14',
    labels: ['performance'],
    order: 1,
  }),
];

const ids = (result: Task[]) => result.map((task) => task.id);

describe('search', () => {
  it('matches titles and descriptions case-insensitively', () => {
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, search: 'DESIGN' }, TODAY))).toEqual(['t1']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, search: 'safari' }, TODAY))).toEqual([
      't2',
    ]);
  });

  it('requires every term to match', () => {
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, search: 'plan quarterly' }, TODAY))).toEqual(
      ['t4'],
    );
    expect(filterTasks(tasks, { ...DEFAULT_FILTERS, search: 'plan missing' }, TODAY)).toEqual([]);
  });

  it('ignores extra whitespace and searches labels', () => {
    expect(filterTasks(tasks, { ...DEFAULT_FILTERS, search: '   ' }, TODAY)).toHaveLength(5);
    expect(matchesSearch(tasks[1], 'auth')).toBe(true);
  });

  it('returns nothing for unknown terms', () => {
    expect(filterTasks(tasks, { ...DEFAULT_FILTERS, search: 'zzz' }, TODAY)).toEqual([]);
  });
});

describe('filters', () => {
  it('filters by status, priority and project', () => {
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, status: 'todo' }, TODAY))).toEqual([
      't1',
      't5',
    ]);
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, priority: 'critical' }, TODAY))).toEqual([
      't2',
    ]);
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, projectId: 'p2' }, TODAY))).toEqual([
      't3',
      't4',
    ]);
  });

  it('filters by due date buckets', () => {
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, due: 'overdue' }, TODAY))).toEqual(['t2']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, due: 'today' }, TODAY))).toEqual(['t4']);
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, due: 'week' }, TODAY))).toEqual([
      't1',
      't4',
      't5',
    ]);
    expect(ids(filterTasks(tasks, { ...DEFAULT_FILTERS, due: 'none' }, TODAY))).toEqual(['t3']);
  });

  it('combines every filter at once', () => {
    const result = filterTasks(
      tasks,
      {
        search: 'page',
        status: 'todo',
        priority: 'high',
        projectId: 'p1',
        due: 'week',
      },
      TODAY,
    );
    expect(ids(result)).toEqual(['t1']);

    const impossible = filterTasks(
      tasks,
      { ...DEFAULT_FILTERS, status: 'done', priority: 'high' },
      TODAY,
    );
    expect(impossible).toEqual([]);
  });

  it('clearing filters restores every task', () => {
    const filters = { ...DEFAULT_FILTERS, search: 'design', status: 'todo' as const };
    expect(hasActiveFilters(filters)).toBe(true);
    expect(activeFilterCount(filters)).toBe(2);
    expect(filterTasks(tasks, DEFAULT_FILTERS, TODAY)).toHaveLength(tasks.length);
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, search: '   ' })).toBe(0);
  });
});

describe('sortTasksForList', () => {
  it('puts open tasks first, then sorts by due date and priority', () => {
    const sorted = sortTasksForList(tasks);
    expect(sorted.map((task) => task.id)).toEqual(['t2', 't4', 't1', 't5', 't3']);
  });

  it('breaks ties with priority and keeps the result stable', () => {
    const tied = [
      makeTask({ id: 'low', dueDate: TODAY, priority: 'low', order: 0 }),
      makeTask({ id: 'critical', dueDate: TODAY, priority: 'critical', order: 1 }),
      makeTask({ id: 'medium', dueDate: TODAY, priority: 'medium', order: 2 }),
    ];
    expect(sortTasksForList(tied).map((task) => task.id)).toEqual(['critical', 'medium', 'low']);
  });
});
