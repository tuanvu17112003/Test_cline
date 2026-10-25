import { createId, type IdFactory } from '../lib/ids';
import type { Subtask, Task, TaskDraft, TaskStatus } from './types';

const nowISO = () => new Date().toISOString();

/** Deterministic ordering: explicit order, then creation time, then id. */
export function sortByOrder(tasks: readonly Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.order - b.order || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function columnTasks(
  tasks: readonly Task[],
  projectId: string,
  status: TaskStatus,
): Task[] {
  return sortByOrder(tasks.filter((task) => task.projectId === projectId && task.status === status));
}

export function nextOrder(tasks: readonly Task[], projectId: string, status: TaskStatus): number {
  const column = columnTasks(tasks, projectId, status);
  return column.length === 0 ? 0 : column[column.length - 1].order + 1;
}

/**
 * Re-numbers every (project, status) column to 0..n-1. Called after each mutation so
 * stored order stays compact and deterministic no matter how tasks arrived.
 */
export function normalizeTaskOrder(tasks: readonly Task[]): Task[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = `${task.projectId}::${task.status}`;
    const group = groups.get(key);
    if (group) group.push(task);
    else groups.set(key, [task]);
  }

  const orderById = new Map<string, number>();
  for (const group of groups.values()) {
    sortByOrder(group).forEach((task, index) => orderById.set(task.id, index));
  }

  let changed = false;
  const normalized = tasks.map((task) => {
    const order = orderById.get(task.id) ?? task.order;
    if (order === task.order) return task;
    changed = true;
    return { ...task, order };
  });
  return changed ? normalized : [...tasks];
}

export interface CreateTaskOptions {
  now?: string;
  idFactory?: IdFactory;
}

export function createTask(
  draft: TaskDraft,
  tasks: readonly Task[],
  options: CreateTaskOptions = {},
): Task {
  const now = options.now ?? nowISO();
  const idFactory = options.idFactory ?? createId;
  const subtasks: Subtask[] = draft.subtasks.map((subtask) => ({
    id: subtask.id || idFactory('sub'),
    title: subtask.title.trim(),
    done: subtask.done === true,
  }));

  return {
    id: idFactory('task'),
    projectId: draft.projectId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    priority: draft.priority,
    dueDate: draft.dueDate,
    labels: [...draft.labels],
    subtasks,
    order: nextOrder(tasks, draft.projectId, draft.status),
    createdAt: now,
    updatedAt: now,
    completedAt: draft.status === 'done' ? now : null,
  };
}

export function createTaskInList(
  tasks: readonly Task[],
  draft: TaskDraft,
  options: CreateTaskOptions = {},
): { task: Task; tasks: Task[] } {
  const task = createTask(draft, tasks, options);
  return { task, tasks: normalizeTaskOrder([...tasks, task]) };
}

export function updateTaskInList(
  tasks: readonly Task[],
  taskId: string,
  draft: TaskDraft,
  now: string = nowISO(),
): Task[] {
  const current = tasks.find((task) => task.id === taskId);
  if (!current) return [...tasks];

  const columnChanged = current.status !== draft.status || current.projectId !== draft.projectId;
  const enteringDone = draft.status === 'done' && current.status !== 'done';
  const leavingDone = draft.status !== 'done' && current.status === 'done';

  const updated: Task = {
    ...current,
    projectId: draft.projectId,
    title: draft.title.trim(),
    description: draft.description.trim(),
    status: draft.status,
    priority: draft.priority,
    dueDate: draft.dueDate,
    labels: [...draft.labels],
    subtasks: draft.subtasks.map((subtask) => ({
      id: subtask.id || createId('sub'),
      title: subtask.title.trim(),
      done: subtask.done === true,
    })),
    order: columnChanged
      ? nextOrder(
          tasks.filter((task) => task.id !== taskId),
          draft.projectId,
          draft.status,
        )
      : current.order,
    updatedAt: now,
    completedAt: enteringDone
      ? now
      : leavingDone
        ? null
        : draft.status === 'done'
          ? (current.completedAt ?? now)
          : null,
  };

  return normalizeTaskOrder(tasks.map((task) => (task.id === taskId ? updated : task)));
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Moves a task to a column and index inside that column, keeping both affected
 * columns densely ordered. Used by drag & drop and by the keyboard "move" controls.
 */
export function moveTask(
  tasks: readonly Task[],
  taskId: string,
  targetStatus: TaskStatus,
  targetIndex: number,
  now: string = nowISO(),
): Task[] {
  const current = tasks.find((task) => task.id === taskId);
  if (!current) return [...tasks];

  const source = columnTasks(tasks, current.projectId, current.status).filter(
    (task) => task.id !== taskId,
  );
  const target =
    current.status === targetStatus
      ? source
      : columnTasks(tasks, current.projectId, targetStatus).filter((task) => task.id !== taskId);

  const moved: Task = {
    ...current,
    status: targetStatus,
    updatedAt: now,
    completedAt:
      targetStatus === 'done'
        ? current.status === 'done'
          ? (current.completedAt ?? now)
          : now
        : null,
  };

  const insertAt = clamp(targetIndex, 0, target.length);
  const targetList = [...target.slice(0, insertAt), moved, ...target.slice(insertAt)];

  const orderById = new Map<string, number>();
  targetList.forEach((task, index) => orderById.set(task.id, index));
  if (current.status !== targetStatus) {
    source.forEach((task, index) => orderById.set(task.id, index));
  }

  return normalizeTaskOrder(
    tasks.map((task) => {
      if (task.id === taskId) return { ...moved, order: orderById.get(taskId) ?? 0 };
      const order = orderById.get(task.id);
      return order === undefined || order === task.order ? task : { ...task, order };
    }),
  );
}

export function reorderTask(
  tasks: readonly Task[],
  taskId: string,
  targetIndex: number,
  now: string = nowISO(),
): Task[] {
  const current = tasks.find((task) => task.id === taskId);
  if (!current) return [...tasks];
  return moveTask(tasks, taskId, current.status, targetIndex, now);
}

export function toggleSubtask(
  tasks: readonly Task[],
  taskId: string,
  subtaskId: string,
  now: string = nowISO(),
): Task[] {
  return tasks.map((task) => {
    if (task.id !== taskId) return task;
    let changed = false;
    const subtasks = task.subtasks.map((subtask) => {
      if (subtask.id !== subtaskId) return subtask;
      changed = true;
      return { ...subtask, done: !subtask.done };
    });
    return changed ? { ...task, subtasks, updatedAt: now } : task;
  });
}

export function deleteTaskFromList(tasks: readonly Task[], taskId: string): Task[] {
  return normalizeTaskOrder(tasks.filter((task) => task.id !== taskId));
}

export function deleteTasksForProject(tasks: readonly Task[], projectId: string): Task[] {
  return normalizeTaskOrder(tasks.filter((task) => task.projectId !== projectId));
}

export function subtaskProgress(task: Pick<Task, 'subtasks'>): {
  done: number;
  total: number;
  percent: number;
} {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((subtask) => subtask.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
