/**
 * Domain models for FlowBoard.
 *
 * Dates come in two flavours and are never mixed accidentally:
 *  - Calendar dates (task due dates) are `YYYY-MM-DD` strings interpreted in the
 *    user's local timezone. Storing them as plain dates avoids the off-by-one-day
 *    bugs that `Date` <-> UTC serialisation introduces.
 *  - Timestamps (createdAt / updatedAt / completedAt / activity.at) are full
 *    ISO-8601 strings produced by `new Date().toISOString()`.
 */

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export const STATUS_HINTS: Record<TaskStatus, string> = {
  backlog: 'Ideas and unscheduled work',
  todo: 'Ready to be picked up',
  in_progress: 'Actively being worked on',
  done: 'Shipped and verified',
};

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

/** Higher number = more urgent. Used for sorting. */
export const PRIORITY_RANK: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export const PROJECT_COLORS = [
  '#5348e0',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0];

export type Theme = 'light' | 'dark';
export const THEMES: Theme[] = ['light', 'dark'];

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  /** Local calendar date (`YYYY-MM-DD`) or null when the task is unscheduled. */
  dueDate: string | null;
  labels: string[];
  subtasks: Subtask[];
  /** Position inside its (project, status) column. Re-indexed on every mutation. */
  order: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** True when the record came from the bundled demo dataset. */
  demo?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  demo?: boolean;
}

export type ActivityKind =
  | 'project-created'
  | 'project-updated'
  | 'project-deleted'
  | 'task-created'
  | 'task-updated'
  | 'task-moved'
  | 'task-completed'
  | 'task-deleted'
  | 'data-imported'
  | 'data-reset'
  | 'demo-loaded'
  | 'demo-removed';

export interface Activity {
  id: string;
  kind: ActivityKind;
  message: string;
  at: string;
  projectId?: string;
  taskId?: string;
}

export interface AppData {
  version: number;
  projects: Project[];
  tasks: Task[];
  activities: Activity[];
  theme: Theme;
}

export interface TaskDraft {
  title: string;
  description: string;
  projectId: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  labels: string[];
  subtasks: Subtask[];
}

export interface ProjectDraft {
  name: string;
  description: string;
  color: string;
}

export const DATA_VERSION = 1;

export const emptyTaskDraft = (projectId: string): TaskDraft => ({
  title: '',
  description: '',
  projectId,
  status: 'backlog',
  priority: 'medium',
  dueDate: null,
  labels: [],
  subtasks: [],
});

export const emptyProjectDraft = (): ProjectDraft => ({
  name: '',
  description: '',
  color: DEFAULT_PROJECT_COLOR,
});

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isPriority(value: unknown): value is Priority {
  return typeof value === 'string' && (PRIORITIES as readonly string[]).includes(value);
}
