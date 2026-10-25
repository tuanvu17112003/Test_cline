import type { AppData, Project, Task } from '../domain/types';
import { DATA_VERSION } from '../domain/types';

export const TODAY = '2026-03-10';

let sequence = 0;
const nextId = (prefix: string) => {
  sequence += 1;
  return `${prefix}-${sequence}`;
};

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId('project'),
    name: 'Test Project',
    description: 'A project used in tests.',
    color: '#5348e0',
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-01T09:00:00.000Z',
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: nextId('task'),
    projectId: 'project-1',
    title: 'Test task',
    description: 'A task used in tests.',
    status: 'todo',
    priority: 'medium',
    dueDate: null,
    labels: [],
    subtasks: [],
    order: 0,
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-01T09:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

export function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    version: DATA_VERSION,
    projects: [],
    tasks: [],
    activities: [],
    theme: 'light',
    ...overrides,
  };
}
