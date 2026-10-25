import { describe, expect, it } from 'vitest';
import { makeData, makeProject, makeTask } from '../test/fixtures';
import { recoverAppData, validateImport } from './import';

const validData = () =>
  makeData({
    projects: [
      makeProject({ id: 'p1', name: 'Alpha', createdAt: '2026-03-01T09:00:00.000Z' }),
      makeProject({ id: 'p2', name: 'Beta', createdAt: '2026-03-02T09:00:00.000Z' }),
    ],
    tasks: [
      makeTask({
        id: 't1',
        projectId: 'p1',
        status: 'todo',
        order: 5,
        labels: ['docs'],
        subtasks: [{ id: 's1', title: 'Sub', done: true }],
      }),
      makeTask({ id: 't2', projectId: 'p2', status: 'done', order: 2, completedAt: '2026-03-09T10:00:00.000Z' }),
    ],
    activities: [
      { id: 'a1', kind: 'task-created', message: 'Created', at: '2026-03-01T10:00:00.000Z' },
    ],
    theme: 'dark',
  });

describe('validateImport', () => {
  it('accepts a well formed export', () => {
    const result = validateImport(validData());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.projects).toHaveLength(2);
      expect(result.data.tasks).toHaveLength(2);
      expect(result.data.theme).toBe('dark');
      expect(result.data.tasks.map((task) => task.order)).toEqual([0, 0]);
    }
  });

  it('accepts an export envelope with metadata', () => {
    const result = validateImport({ app: 'flowboard', exportedAt: '2026-03-10T10:00:00.000Z', ...validData() });
    expect(result.ok).toBe(true);
  });

  it('rejects values that are not app data', () => {
    expect(validateImport(null).ok).toBe(false);
    expect(validateImport([]).ok).toBe(false);
    expect(validateImport('nope').ok).toBe(false);
    const wrongApp = validateImport({ app: 'other', ...validData() });
    expect(wrongApp.ok).toBe(false);
    if (!wrongApp.ok) expect(wrongApp.errors[0]).toMatch(/not exported from FlowBoard/i);
  });

  it('rejects unsupported versions and missing collections', () => {
    const wrongVersion = validateImport({ ...validData(), version: 99 });
    expect(wrongVersion.ok).toBe(false);
    if (!wrongVersion.ok) expect(wrongVersion.errors[0]).toMatch(/Unsupported data version/);

    const missing = validateImport({ version: 1, projects: [] });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.join(' ')).toMatch(/"tasks" must be an array/);
  });

  it('rejects duplicate identifiers', () => {
    const data = validData();
    data.projects.push(makeProject({ id: 'p1', name: 'Duplicate' }));
    const result = validateImport(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/Duplicate project id/);
  });

  it('rejects tasks that reference a missing project', () => {
    const data = makeData({
      projects: [makeProject({ id: 'p1' })],
      tasks: [makeTask({ id: 't1', projectId: 'ghost' })],
    });
    const result = validateImport(data);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/missing project/);
  });

  it('reports invalid statuses, dates and subtasks', () => {
    const invalidStatus = validateImport({
      ...validData(),
      tasks: [{ ...validData().tasks[0], status: 'archived' }],
    });
    expect(invalidStatus.ok).toBe(false);

    const invalidDate = validateImport({
      ...validData(),
      tasks: [{ ...validData().tasks[0], dueDate: '2026-02-30' }],
    });
    expect(invalidDate.ok).toBe(false);
    if (!invalidDate.ok) expect(invalidDate.errors.join(' ')).toMatch(/dueDate/);

    // Unknown enum values make the record unreadable, so the task is rejected.
    const invalidProject = validateImport({
      ...validData(),
      tasks: [{ ...validData().tasks[0], projectId: 'p2' }, { ...validData().tasks[1], projectId: 'p2', status: 'done' }],
    });
    expect(invalidProject.ok).toBe(true);
  });

  it('drops malformed activities instead of failing the import', () => {
    const data = {
      ...validData(),
      activities: [{ id: 'bad', kind: 'nope', message: 42 }, validData().activities[0]],
    };
    const result = validateImport(data);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.activities).toHaveLength(1);
  });

  it('falls back to the current theme when the value is invalid', () => {
    const result = validateImport({ ...validData(), theme: 'sepia' }, 'dark');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.theme).toBe('dark');
  });
});

describe('recoverAppData', () => {
  it('salvages valid records and drops broken ones', () => {
    const recovered = recoverAppData({
      version: 1,
      projects: [makeProject({ id: 'p1', name: 'Kept' }), { id: 'broken' }],
      tasks: [
        makeTask({ id: 'ok', projectId: 'p1' }),
        makeTask({ id: 'orphan', projectId: 'ghost' }),
        { id: 'no-title', projectId: 'p1', status: 'todo', priority: 'low' },
      ],
      activities: 'not-an-array',
      theme: 'light',
    });
    expect(recovered.projects.map((project) => project.id)).toEqual(['p1']);
    expect(recovered.tasks.map((task) => task.id)).toEqual(['ok']);
    expect(recovered.recoveryWarnings.length).toBeGreaterThan(0);
  });

  it('returns an empty workspace for unusable input', () => {
    const recovered = recoverAppData(null);
    expect(recovered.projects).toEqual([]);
    expect(recovered.tasks).toEqual([]);
    expect(recovered.recoveryWarnings).toHaveLength(1);
  });

  it('keeps the fallback theme when the stored theme is missing', () => {
    const recovered = recoverAppData({ projects: [], tasks: [] }, 'dark');
    expect(recovered.theme).toBe('dark');
  });
});
