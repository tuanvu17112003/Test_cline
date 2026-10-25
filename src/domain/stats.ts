import { addDays, differenceInDays, isOverdue, toISODate, todayISO } from './dates';
import { PRIORITY_COLORS, STATUS_COLORS } from './palette';
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_RANK,
  STATUS_LABELS,
  TASK_STATUSES,
  type Activity,
  type Priority,
  type Project,
  type Task,
} from './types';

export interface DashboardStats {
  projectCount: number;
  taskCount: number;
  completedCount: number;
  openCount: number;
  overdueCount: number;
  dueTodayCount: number;
  upcomingCount: number;
  completionRate: number;
}

export function completionRate(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function getDashboardStats(
  projects: readonly Project[],
  tasks: readonly Task[],
  today: string = todayISO(),
): DashboardStats {
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const horizon = addDays(today, 7);
  return {
    projectCount: projects.length,
    taskCount: tasks.length,
    completedCount,
    openCount: tasks.length - completedCount,
    overdueCount: tasks.filter((task) => isOverdue(task.dueDate, task.status, today)).length,
    dueTodayCount: tasks.filter((task) => task.status !== 'done' && task.dueDate === today).length,
    upcomingCount: tasks.filter(
      (task) =>
        task.status !== 'done' &&
        task.dueDate !== null &&
        task.dueDate > today &&
        task.dueDate <= horizon,
    ).length,
    completionRate: completionRate(completedCount, tasks.length),
  };
}

export interface DistributionEntry {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export function statusDistribution(tasks: readonly Task[]): DistributionEntry[] {
  const total = tasks.length;
  return TASK_STATUSES.map((status) => {
    const count = tasks.filter((task) => task.status === status).length;
    return {
      key: status,
      label: STATUS_LABELS[status],
      count,
      percent: completionRate(count, total),
      color: STATUS_COLORS[status],
    };
  });
}

export function priorityDistribution(tasks: readonly Task[]): DistributionEntry[] {
  const total = tasks.length;
  return PRIORITIES.map((priority) => {
    const count = tasks.filter((task) => task.priority === priority).length;
    return {
      key: priority,
      label: PRIORITY_LABELS[priority],
      count,
      percent: completionRate(count, total),
      color: PRIORITY_COLORS[priority],
    };
  });
}

export interface ProjectProgress {
  project: Project;
  total: number;
  completed: number;
  open: number;
  overdue: number;
  percent: number;
}

export function projectProgressList(
  projects: readonly Project[],
  tasks: readonly Task[],
  today: string = todayISO(),
): ProjectProgress[] {
  return projects
    .map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const completed = projectTasks.filter((task) => task.status === 'done').length;
      return {
        project,
        total: projectTasks.length,
        completed,
        open: projectTasks.length - completed,
        overdue: projectTasks.filter((task) => isOverdue(task.dueDate, task.status, today)).length,
        percent: completionRate(completed, projectTasks.length),
      };
    })
    .sort((a, b) => a.project.name.localeCompare(b.project.name));
}

export function completedOverTime(
  tasks: readonly Task[],
  today: string = todayISO(),
  days = 14,
): { date: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.completedAt) continue;
    const date = toISODate(new Date(task.completedAt));
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  const start = addDays(today, -(days - 1));
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    return { date, count: counts.get(date) ?? 0 };
  });
}

export function upcomingDeadlines(
  tasks: readonly Task[],
  today: string = todayISO(),
  days = 7,
): Task[] {
  const horizon = addDays(today, days);
  return tasks
    .filter(
      (task) =>
        task.status !== 'done' &&
        task.dueDate !== null &&
        task.dueDate >= today &&
        task.dueDate <= horizon,
    )
    .sort(
      (a, b) =>
        (a.dueDate as string).localeCompare(b.dueDate as string) ||
        PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority],
    );
}

export function overdueTasks(tasks: readonly Task[], today: string = todayISO()): Task[] {
  return tasks
    .filter((task) => isOverdue(task.dueDate, task.status, today))
    .sort(
      (a, b) =>
        differenceInDays(today, a.dueDate as string) - differenceInDays(today, b.dueDate as string),
    );
}

export function tasksDueOn(tasks: readonly Task[], date: string): Task[] {
  return tasks
    .filter((task) => task.dueDate === date)
    .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.order - b.order);
}

export function unscheduledTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter((task) => task.dueDate === null && task.status !== 'done');
}

export function recentActivities(activities: readonly Activity[], limit = 6): Activity[] {
  return [...activities].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export interface PriorityBreakdown {
  priority: Priority;
  total: number;
  open: number;
  done: number;
}

export function priorityBreakdown(tasks: readonly Task[]): PriorityBreakdown[] {
  return PRIORITIES.map((priority) => {
    const matching = tasks.filter((task) => task.priority === priority);
    const done = matching.filter((task) => task.status === 'done').length;
    return { priority, total: matching.length, done, open: matching.length - done };
  });
}

export function averageCompletionDays(tasks: readonly Task[]): number | null {
  const completed = tasks.filter((task) => task.completedAt && task.status === 'done');
  if (completed.length === 0) return null;
  const totalDays = completed.reduce((sum, task) => {
    const created = toISODate(new Date(task.createdAt));
    const finished = toISODate(new Date(task.completedAt as string));
    return sum + Math.max(0, differenceInDays(finished, created));
  }, 0);
  return Math.round((totalDays / completed.length) * 10) / 10;
}
