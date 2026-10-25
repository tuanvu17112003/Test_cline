import { describe, expect, it } from 'vitest';
import { makeTask } from '../test/fixtures';
import {
  columnTasks,
  createTask,
  createTaskInList,
  deleteTaskFromList,
  deleteTasksForProject,
  moveTask,
  nextOrder,
  normalizeTaskOrder,
  reorderTask,
  sortByOrder,
  subtaskProgress,
  toggleSubtask,
  updateTaskInList,
} from './tasks';
import type { Task, TaskDraft } from './types';

const projectId = 'project-1';

const draft = (overrides: Partial<TaskDraft> = {}): TaskDraft => ({
  title: '  Ship the release  ',
  description: '  Notes about the release.  ',
  projectId,
  status: 'todo',
  priority: 'high',
  dueDate: '2026-03-12',
  labels: ['Release'],
  subtasks: [],
  ...overrides,
});

describe('task ordering', () => {
  it('sorts deterministically by order, then creation time, then id', () => {
    const tasks = [
      makeTask({ id: 'b', order: 1 }),
      makeTask({ id: 'a', order: 0 }),
      makeTask({ id: 'c', order: 1, createdAt: '2026-02-01T09:00:00.000Z' }),
    ];
    expect(sortByOrder(tasks).map((task) => task.id)).toEqual(['a', 'c', 'b']);
  });

  it('re-indexes each column to 0..n-1 independently', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'todo', order: 7 }),
      makeTask({ id: 'b', status: 'todo', order: 3 }),
      makeTask({ id: 'c', status: 'done', order: 5 }),
      makeTask({ id: 'd', status: 'done', order: 1 }),
    ];
    const normalized = normalizeTaskOrder(tasks);
    const todoOrders = normalized.filter((task) => task.status === 'todo').map((task) => task.order);
    expect(todoOrders.sort()).toEqual([0, 1]);
    expect(normalized.find((task) => task.id === 'c')?.order).toBe(1);
    expect(normalized.find((task) => task.id === 'd')?.order).toBe(0);
  });

  it('only returns tasks of the requested project and status', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'todo', projectId: 'p1' }),
      makeTask({ id: 'b', status: 'done', projectId: 'p1' }),
      makeTask({ id: 'c', status: 'todo', projectId: 'p2' }),
    ];
    expect(columnTasks(tasks, 'p1', 'todo').map((task) => task.id)).toEqual(['a']);
    expect(nextOrder(tasks, 'p1', 'todo')).toBe(1);
    expect(nextOrder(tasks, 'p1', 'backlog')).toBe(0);
  });
});

describe('createTask', () => {
  it('normalises the draft and appends the task to its column', () => {
    const existing = [makeTask({ id: 'existing', status: 'todo', order: 0 })];
    const task = createTask(draft(), existing, {
      now: '2026-03-10T10:00:00.000Z',
      idFactory: () => 'new-task',
    });

    expect(task).toMatchObject({
      id: 'new-task',
      title: 'Ship the release',
      description: 'Notes about the release.',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-03-12',
      labels: ['Release'],
      order: 1,
      createdAt: '2026-03-10T10:00:00.000Z',
      updatedAt: '2026-03-10T10:00:00.000Z',
      completedAt: null,
    });
  });

  it('stamps completedAt when a task is created as done', () => {
    const task = createTask(draft({ status: 'done' }), [], {
      now: '2026-03-10T10:00:00.000Z',
      idFactory: () => 'done-task',
    });
    expect(task.completedAt).toBe('2026-03-10T10:00:00.000Z');
  });

  it('gives every subtask a stable id', () => {
    const { task } = createTaskInList(
      [],
      draft({ subtasks: [{ id: '', title: 'One', done: false }] }),
      { idFactory: (prefix) => `${prefix}-generated` },
    );
    expect(task.subtasks).toHaveLength(1);
    expect(task.subtasks[0].id).toBe('sub-generated');
  });
});

describe('updateTaskInList', () => {
  it('keeps the task position when the column does not change', () => {
    const tasks = [
      makeTask({ id: 'a', order: 0, status: 'todo', title: 'First' }),
      makeTask({ id: 'b', order: 1, status: 'todo', title: 'Second' }),
    ];
    const updated = updateTaskInList(
      tasks,
      'b',
      draft({ title: 'Renamed' }),
      '2026-03-11T08:00:00.000Z',
    );
    expect(updated[1]).toMatchObject({
      title: 'Renamed',
      order: 1,
      updatedAt: '2026-03-11T08:00:00.000Z',
    });
  });

  it('sets completedAt when moving into done through the form', () => {
    const tasks = [makeTask({ id: 'a', status: 'todo' })];
    const updated = updateTaskInList(
      tasks,
      'a',
      draft({ status: 'done' }),
      '2026-03-11T08:00:00.000Z',
    );
    expect(updated[0].completedAt).toBe('2026-03-11T08:00:00.000Z');
    expect(updated[0].status).toBe('done');
  });

  it('clears completedAt when moving out of done', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'done', completedAt: '2026-03-01T08:00:00.000Z' }),
    ];
    const updated = updateTaskInList(
      tasks,
      'a',
      draft({ status: 'in_progress' }),
      '2026-03-11T08:00:00.000Z',
    );
    expect(updated[0].completedAt).toBeNull();
  });

  it('appends to the end of the target column and renumbers the source', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'todo', order: 0 }),
      makeTask({ id: 'b', status: 'todo', order: 1 }),
      makeTask({ id: 'c', status: 'done', order: 0 }),
    ];
    const updated = updateTaskInList(
      tasks,
      'a',
      draft({ status: 'done' }),
      '2026-03-11T08:00:00.000Z',
    );
    expect(updated.find((task) => task.id === 'a')?.order).toBe(1);
    expect(updated.find((task) => task.id === 'b')?.order).toBe(0);
    expect(updated.find((task) => task.id === 'c')?.order).toBe(0);
  });

  it('moves a task to another project column', () => {
    const tasks = [makeTask({ id: 'a', status: 'todo', projectId: 'p1', order: 0 })];
    const updated = updateTaskInList(
      tasks,
      'a',
      draft({ projectId: 'p2' }),
      '2026-03-11T08:00:00.000Z',
    );
    expect(updated[0].projectId).toBe('p2');
    expect(updated[0].order).toBe(0);
  });

  it('ignores unknown task ids', () => {
    const tasks = [makeTask({ id: 'a' })];
    expect(updateTaskInList(tasks, 'missing', draft())).toEqual(tasks);
  });
});

describe('moveTask', () => {
  const tasks = (): Task[] => [
    makeTask({ id: 'a', status: 'backlog', order: 0, createdAt: '2026-03-01T10:00:00.000Z' }),
    makeTask({ id: 'b', status: 'backlog', order: 1, createdAt: '2026-03-02T10:00:00.000Z' }),
    makeTask({ id: 'c', status: 'todo', order: 0 }),
    makeTask({ id: 'd', status: 'todo', order: 1 }),
  ];

  it('moves a task between columns at the requested index', () => {
    const moved = moveTask(tasks(), 'a', 'todo', 1, '2026-03-10T12:00:00.000Z');
    expect(columnTasks(moved, projectId, 'todo').map((task) => task.id)).toEqual(['c', 'a', 'd']);
    expect(columnTasks(moved, projectId, 'backlog').map((task) => task.id)).toEqual(['b']);
    expect(moved.find((task) => task.id === 'a')?.status).toBe('todo');
  });

  it('reorders within the same column', () => {
    const moved = moveTask(tasks(), 'd', 'todo', 0);
    expect(columnTasks(moved, projectId, 'todo').map((task) => task.id)).toEqual(['d', 'c']);
  });

  it('appends when the target index is beyond the column', () => {
    const moved = moveTask(tasks(), 'a', 'todo', 99);
    expect(columnTasks(moved, projectId, 'todo').map((task) => task.id)).toEqual(['c', 'd', 'a']);
  });

  it('sets completedAt when landing in done and clears it when leaving', () => {
    const done = moveTask(tasks(), 'a', 'done', 0, '2026-03-10T12:00:00.000Z');
    expect(done.find((task) => task.id === 'a')?.completedAt).toBe('2026-03-10T12:00:00.000Z');
    const back = moveTask(done, 'a', 'todo', 0, '2026-03-11T12:00:00.000Z');
    expect(back.find((task) => task.id === 'a')?.completedAt).toBeNull();
  });

  it('keeps the original completion timestamp when only reordering inside done', () => {
    const initial = [
      makeTask({ id: 'a', status: 'done', completedAt: '2026-03-01T10:00:00.000Z' }),
    ];
    const moved = moveTask(initial, 'a', 'done', 0, '2026-03-10T12:00:00.000Z');
    expect(moved[0].completedAt).toBe('2026-03-01T10:00:00.000Z');
  });

  it('is a no-op for unknown tasks', () => {
    expect(moveTask(tasks(), 'nope', 'done', 0)).toEqual(tasks());
  });

  it('reorderTask keeps the current status', () => {
    const reordered = reorderTask(tasks(), 'c', 1);
    expect(columnTasks(reordered, projectId, 'todo').map((task) => task.id)).toEqual(['d', 'c']);
  });
});

describe('subtasks and deletion', () => {
  it('toggles a subtask and bumps updatedAt', () => {
    const tasks = [
      makeTask({
        id: 'a',
        subtasks: [
          { id: 's1', title: 'One', done: false },
          { id: 's2', title: 'Two', done: true },
        ],
      }),
    ];
    const toggled = toggleSubtask(tasks, 'a', 's1', '2026-03-10T12:00:00.000Z');
    expect(toggled[0].subtasks[0].done).toBe(true);
    expect(toggled[0].updatedAt).toBe('2026-03-10T12:00:00.000Z');
    expect(toggleSubtask(tasks, 'a', 'missing')).toEqual(tasks);
  });

  it('computes subtask progress', () => {
    expect(
      subtaskProgress({
        subtasks: [
          { id: '1', title: 'a', done: true },
          { id: '2', title: 'b', done: false },
        ],
      }),
    ).toEqual({ done: 1, total: 2, percent: 50 });
    expect(subtaskProgress({ subtasks: [] })).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('deletes a task and renumbers the column', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'todo', order: 0 }),
      makeTask({ id: 'b', status: 'todo', order: 1 }),
      makeTask({ id: 'c', status: 'todo', order: 2 }),
    ];
    const remaining = deleteTaskFromList(tasks, 'b');
    expect(remaining.map((task) => task.id)).toEqual(['a', 'c']);
    expect(remaining.map((task) => task.order)).toEqual([0, 1]);
  });

  it('deletes every task that belongs to a project', () => {
    const tasks = [
      makeTask({ id: 'a', projectId: 'p1' }),
      makeTask({ id: 'b', projectId: 'p2' }),
      makeTask({ id: 'c', projectId: 'p1' }),
    ];
    expect(deleteTasksForProject(tasks, 'p1').map((task) => task.id)).toEqual(['b']);
  });
});
