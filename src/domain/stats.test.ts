import { describe, expect, it } from 'vitest';
import { makeProject, makeTask } from '../test/fixtures';
import {
  averageCompletionDays,
  completedOverTime,
  completionRate,
  getDashboardStats,
  overdueTasks,
  priorityBreakdown,
  priorityDistribution,
  projectProgressList,
  recentActivities,
  statusDistribution,
  tasksDueOn,
  unscheduledTasks,
  upcomingDeadlines,
} from './stats';
import type { Activity } from './types';

const TODAY = '2026-03-10';

const projects = [
  makeProject({ id: 'p1', name: 'Zeta', createdAt: '2026-01-01T00:00:00.000Z' }),
  makeProject({ id: 'p2', name: 'Alpha', createdAt: '2026-01-02T00:00:00.000Z' }),
];

const tasks = [
  makeTask({
    id: 'done-1',
    projectId: 'p1',
    status: 'done',
    priority: 'high',
    dueDate: '2026-03-01',
    completedAt: '2026-03-09T12:00:00.000Z',
    createdAt: '2026-03-05T12:00:00.000Z',
  }),
  makeTask({
    id: 'done-2',
    projectId: 'p2',
    status: 'done',
    priority: 'low',
    dueDate: null,
    completedAt: '2026-03-10T08:00:00.000Z',
    createdAt: '2026-03-08T08:00:00.000Z',
  }),
  makeTask({
    id: 'overdue',
    projectId: 'p1',
    status: 'todo',
    priority: 'critical',
    dueDate: '2026-03-02',
  }),
  makeTask({
    id: 'today',
    projectId: 'p1',
    status: 'in_progress',
    priority: 'medium',
    dueDate: TODAY,
  }),
  makeTask({
    id: 'soon',
    projectId: 'p2',
    status: 'backlog',
    priority: 'low',
    dueDate: '2026-03-12',
  }),
  makeTask({
    id: 'later',
    projectId: 'p2',
    status: 'todo',
    priority: 'high',
    dueDate: '2026-03-30',
  }),
  makeTask({ id: 'unscheduled', projectId: 'p1', status: 'todo', priority: 'medium', dueDate: null }),
];

describe('getDashboardStats', () => {
  it('derives every dashboard number from real data', () => {
    const stats = getDashboardStats(projects, tasks, TODAY);
    expect(stats).toEqual({
      projectCount: 2,
      taskCount: 7,
      completedCount: 2,
      openCount: 5,
      overdueCount: 1,
      dueTodayCount: 1,
      upcomingCount: 1,
      completionRate: 29,
    });
  });

  it('handles an empty workspace', () => {
    expect(getDashboardStats([], [], TODAY)).toEqual({
      projectCount: 0,
      taskCount: 0,
      completedCount: 0,
      openCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      upcomingCount: 0,
      completionRate: 0,
    });
  });

  it('rounds completion rate and guards division by zero', () => {
    expect(completionRate(1, 3)).toBe(33);
    expect(completionRate(2, 3)).toBe(67);
    expect(completionRate(0, 0)).toBe(0);
    expect(completionRate(5, 0)).toBe(0);
  });
});

describe('distributions', () => {
  it('always reports all four statuses', () => {
    const distribution = statusDistribution(tasks);
    expect(distribution.map((entry) => entry.count)).toEqual([1, 3, 1, 2]);
    expect(distribution.map((entry) => entry.key)).toEqual([
      'backlog',
      'todo',
      'in_progress',
      'done',
    ]);
    expect(distribution.find((entry) => entry.key === 'done')?.percent).toBe(29);
  });

  it('always reports all four priorities', () => {
    const distribution = priorityDistribution(tasks);
    expect(distribution.map((entry) => entry.count)).toEqual([2, 2, 2, 1]);
    expect(distribution.every((entry) => entry.color.startsWith('#'))).toBe(true);
  });

  it('breaks priorities down by open and done', () => {
    const breakdown = priorityBreakdown(tasks);
    expect(breakdown.find((entry) => entry.priority === 'high')).toEqual({
      priority: 'high',
      total: 2,
      done: 1,
      open: 1,
    });
  });

  it('returns zeroed percentages when there are no tasks', () => {
    expect(statusDistribution([]).every((entry) => entry.percent === 0)).toBe(true);
  });
});

describe('project progress', () => {
  it('calculates completion per project and sorts by name', () => {
    const progress = projectProgressList(projects, tasks, TODAY);
    expect(progress.map((entry) => entry.project.name)).toEqual(['Alpha', 'Zeta']);
    const alpha = progress[0];
    expect(alpha.total).toBe(3);
    expect(alpha.completed).toBe(1);
    expect(alpha.percent).toBe(33);
    const zeta = progress[1];
    expect(zeta.total).toBe(4);
    expect(zeta.completed).toBe(1);
    expect(zeta.overdue).toBe(1);
  });

  it('handles projects without tasks', () => {
    const progress = projectProgressList([makeProject({ id: 'p3', name: 'Empty' })], tasks, TODAY);
    expect(progress[0]).toMatchObject({ total: 0, completed: 0, percent: 0 });
  });
});

describe('time based analytics', () => {
  it('builds a 14 day completion series ending today', () => {
    const series = completedOverTime(tasks, TODAY, 14);
    expect(series).toHaveLength(14);
    expect(series[0].date).toBe('2026-02-25');
    expect(series[13].date).toBe(TODAY);
    expect(series.reduce((sum, point) => sum + point.count, 0)).toBe(2);
    expect(series.find((point) => point.date === '2026-03-09')?.count).toBe(1);
    expect(series.find((point) => point.date === TODAY)?.count).toBe(1);
  });

  it('lists upcoming deadlines inside the window only', () => {
    expect(upcomingDeadlines(tasks, TODAY).map((task) => task.id)).toEqual(['today', 'soon']);
    expect(upcomingDeadlines(tasks, TODAY, 0).map((task) => task.id)).toEqual(['today']);
  });

  it('lists overdue tasks oldest first', () => {
    expect(overdueTasks(tasks, TODAY).map((task) => task.id)).toEqual(['overdue']);
  });

  it('lists tasks due on a specific date by priority', () => {
    expect(tasksDueOn(tasks, TODAY).map((task) => task.id)).toEqual(['today']);
    expect(tasksDueOn(tasks, '2026-01-01')).toEqual([]);
  });

  it('finds unscheduled open tasks', () => {
    expect(unscheduledTasks(tasks).map((task) => task.id)).toEqual(['unscheduled']);
  });

  it('averages completion time in days', () => {
    expect(averageCompletionDays(tasks)).toBe(3);
    expect(averageCompletionDays([])).toBeNull();
  });
});

describe('activity feed', () => {
  it('returns newest activities first and honours the limit', () => {
    const activities: Activity[] = [
      { id: 'a', kind: 'task-created', message: 'Old', at: '2026-03-01T10:00:00.000Z' },
      { id: 'b', kind: 'task-updated', message: 'New', at: '2026-03-09T10:00:00.000Z' },
      { id: 'c', kind: 'task-deleted', message: 'Mid', at: '2026-03-05T10:00:00.000Z' },
    ];
    expect(recentActivities(activities).map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
    expect(recentActivities(activities, 1)).toHaveLength(1);
  });
});
