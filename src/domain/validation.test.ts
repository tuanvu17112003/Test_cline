import { describe, expect, it } from 'vitest';
import { makeProject } from '../test/fixtures';
import {
  normalizeLabels,
  normalizeSubtasks,
  parseLabelInput,
  validateProjectDraft,
  validateTaskDraft,
} from './validation';

const projects = [makeProject({ id: 'p1', name: 'Alpha' })];
const context = { projectIds: projects.map((project) => project.id) };

const validDraft = {
  title: 'Write the spec',
  description: 'Notes',
  projectId: 'p1',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-03-20',
  labels: ['docs'],
  subtasks: [],
};

describe('validateTaskDraft', () => {
  it('accepts and trims a valid draft', () => {
    const result = validateTaskDraft(
      { ...validDraft, title: '  Write the spec  ', description: '  Notes  ' },
      context,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Write the spec');
      expect(result.value.description).toBe('Notes');
      expect(result.value.dueDate).toBe('2026-03-20');
    }
  });

  it('requires a title and rejects whitespace-only titles', () => {
    const missing = validateTaskDraft({ ...validDraft, title: '' }, context);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.title).toMatch(/required/i);

    const blank = validateTaskDraft({ ...validDraft, title: '   ' }, context);
    expect(blank.ok).toBe(false);
  });

  it('enforces the title length limit', () => {
    const result = validateTaskDraft({ ...validDraft, title: 'a'.repeat(121) }, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.title).toMatch(/120 characters/);
  });

  it('rejects tasks assigned to a missing project', () => {
    const result = validateTaskDraft({ ...validDraft, projectId: 'nope' }, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.projectId).toMatch(/no longer exists/i);
  });

  it('rejects invalid enum values', () => {
    const result = validateTaskDraft(
      { ...validDraft, status: 'archived', priority: 'urgent' },
      context,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.status).toBeDefined();
      expect(result.errors.priority).toBeDefined();
    }
  });

  it('rejects impossible due dates and accepts an empty one', () => {
    const invalid = validateTaskDraft({ ...validDraft, dueDate: '2026-02-30' }, context);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.errors.dueDate).toMatch(/valid date/i);

    const empty = validateTaskDraft({ ...validDraft, dueDate: '' }, context);
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.value.dueDate).toBeNull();
  });

  it('normalises and validates labels', () => {
    const result = validateTaskDraft(
      { ...validDraft, labels: ['  docs ', 'Docs', 'front end', ''] },
      context,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.labels).toEqual(['docs', 'front end']);

    const tooMany = validateTaskDraft(
      { ...validDraft, labels: Array.from({ length: 9 }, (_, index) => `label-${index}`) },
      context,
    );
    expect(tooMany.ok).toBe(false);

    const tooLong = validateTaskDraft({ ...validDraft, labels: ['x'.repeat(25)] }, context);
    expect(tooLong.ok).toBe(false);
  });

  it('validates subtasks', () => {
    const blank = validateTaskDraft(
      { ...validDraft, subtasks: [{ id: 's1', title: '   ', done: false }] },
      context,
    );
    expect(blank.ok).toBe(false);
    if (!blank.ok) expect(blank.errors.subtasks).toMatch(/needs a title/i);

    const tooMany = validateTaskDraft(
      {
        ...validDraft,
        subtasks: Array.from({ length: 31 }, (_, index) => ({
          id: `s${index}`,
          title: `Sub ${index}`,
          done: false,
        })),
      },
      context,
    );
    expect(tooMany.ok).toBe(false);
  });

  it('enforces the description limit', () => {
    const result = validateTaskDraft({ ...validDraft, description: 'x'.repeat(2001) }, context);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.description).toBeDefined();
  });
});

describe('validateProjectDraft', () => {
  const projectContext = { projects };

  it('accepts a valid project', () => {
    const result = validateProjectDraft(
      { name: '  Beta  ', description: ' Details ', color: '#0EA5E9' },
      projectContext,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ name: 'Beta', description: 'Details', color: '#0ea5e9' });
    }
  });

  it('requires a unique name', () => {
    const duplicate = validateProjectDraft(
      { name: 'alpha', description: '', color: '#5348e0' },
      projectContext,
    );
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.errors.name).toMatch(/already exists/i);
  });

  it('allows a project to keep its own name while editing', () => {
    const result = validateProjectDraft(
      { name: 'Alpha', description: '', color: '#5348e0' },
      { ...projectContext, currentId: 'p1' },
    );
    expect(result.ok).toBe(true);
  });

  it('rejects invalid colours and empty names', () => {
    const badColor = validateProjectDraft({ name: 'Gamma', color: 'blue' }, projectContext);
    expect(badColor.ok).toBe(false);
    if (!badColor.ok) expect(badColor.errors.color).toBeDefined();

    const emptyName = validateProjectDraft({ name: ' ', color: '#5348e0' }, projectContext);
    expect(emptyName.ok).toBe(false);
  });
});

describe('label helpers', () => {
  it('parses comma separated label input', () => {
    expect(parseLabelInput('design, frontend ,, Design, ')).toEqual(['design', 'frontend']);
    expect(parseLabelInput('')).toEqual([]);
  });

  it('normalises untrusted label arrays', () => {
    expect(normalizeLabels(['a', 3, null, ' a ', 'b'])).toEqual(['a', 'b']);
    expect(normalizeLabels('not-an-array')).toEqual([]);
  });

  it('normalises untrusted subtask arrays', () => {
    expect(
      normalizeSubtasks([
        { title: 'A', done: true },
        { title: '  ', done: false },
        'nope',
        { id: 'keep', title: 'B', done: 1 },
      ]),
    ).toEqual([
      { id: 'sub_0', title: 'A', done: true },
      { id: 'keep', title: 'B', done: false },
    ]);
  });
});
