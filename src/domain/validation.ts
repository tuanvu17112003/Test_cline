import { isValidDateString } from './dates';
import {
  isPriority,
  isTaskStatus,
  type Priority,
  type Project,
  type ProjectDraft,
  type Subtask,
  type TaskDraft,
  type TaskStatus,
} from './types';

export const LIMITS = {
  title: 120,
  description: 2000,
  projectName: 80,
  projectDescription: 500,
  label: 24,
  labels: 8,
  subtasks: 30,
  subtaskTitle: 120,
  maxImportBytes: 5 * 1024 * 1024,
} as const;

export type FieldErrors = Record<string, string>;
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const ok = <T>(value: T): ValidationResult<T> => ({ ok: true, value });
const fail = <T>(errors: FieldErrors): ValidationResult<T> => ({ ok: false, errors });

const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function normalizeLabels(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const entry of input) {
    if (typeof entry !== 'string') continue;
    const label = entry.trim().replace(/\s+/g, ' ');
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

export function parseLabelInput(input: string): string[] {
  return normalizeLabels(input.split(','));
}

export function normalizeSubtasks(input: unknown): Subtask[] {
  if (!Array.isArray(input)) return [];
  const result: Subtask[] = [];
  for (const entry of input) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<Subtask>;
    const title = asTrimmedString(candidate.title);
    if (!title) continue;
    result.push({
      id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `sub_${result.length}`,
      title,
      done: candidate.done === true,
    });
  }
  return result;
}

export interface TaskValidationContext {
  projectIds: readonly string[];
}

/** Validates and normalises a task form payload. */
export function validateTaskDraft(
  input: unknown,
  context: TaskValidationContext,
): ValidationResult<TaskDraft> {
  const errors: FieldErrors = {};
  const raw = (input ?? {}) as Record<string, unknown>;

  const title = asTrimmedString(raw.title);
  if (!title) errors.title = 'Title is required.';
  else if (title.length > LIMITS.title)
    errors.title = `Title must be ${LIMITS.title} characters or fewer.`;

  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (description.length > LIMITS.description)
    errors.description = `Description must be ${LIMITS.description} characters or fewer.`;

  const projectId = asTrimmedString(raw.projectId);
  if (!projectId) errors.projectId = 'Select a project.';
  else if (!context.projectIds.includes(projectId))
    errors.projectId = 'That project no longer exists. Pick another one.';

  const status: TaskStatus = isTaskStatus(raw.status) ? raw.status : 'todo';
  if (raw.status !== undefined && !isTaskStatus(raw.status))
    errors.status = 'Choose a valid status.';

  const priority: Priority = isPriority(raw.priority) ? raw.priority : 'medium';
  if (raw.priority !== undefined && !isPriority(raw.priority))
    errors.priority = 'Choose a valid priority.';

  let dueDate: string | null = null;
  if (raw.dueDate !== null && raw.dueDate !== undefined && raw.dueDate !== '') {
    const candidate = asTrimmedString(raw.dueDate);
    if (!isValidDateString(candidate)) errors.dueDate = 'Enter a valid date (YYYY-MM-DD).';
    else dueDate = candidate;
  }

  const labels = normalizeLabels(raw.labels);
  if (labels.length > LIMITS.labels) errors.labels = `Use at most ${LIMITS.labels} labels.`;
  else if (labels.some((label) => label.length > LIMITS.label))
    errors.labels = `Labels must be ${LIMITS.label} characters or fewer.`;

  const subtasks = normalizeSubtasks(raw.subtasks);
  if (subtasks.length > LIMITS.subtasks)
    errors.subtasks = `Use at most ${LIMITS.subtasks} subtasks.`;
  else if (subtasks.some((subtask) => subtask.title.length > LIMITS.subtaskTitle))
    errors.subtasks = `Subtask titles must be ${LIMITS.subtaskTitle} characters or fewer.`;
  else if (Array.isArray(raw.subtasks) && subtasks.length !== raw.subtasks.length)
    errors.subtasks = 'Every subtask needs a title.';

  if (Object.keys(errors).length > 0) return fail(errors);

  return ok({ title, description, projectId, status, priority, dueDate, labels, subtasks });
}

export interface ProjectValidationContext {
  projects: readonly Pick<Project, 'id' | 'name'>[];
  currentId?: string;
}

/** Validates and normalises a project form payload. */
export function validateProjectDraft(
  input: unknown,
  context: ProjectValidationContext,
): ValidationResult<ProjectDraft> {
  const errors: FieldErrors = {};
  const raw = (input ?? {}) as Record<string, unknown>;

  const name = asTrimmedString(raw.name).replace(/\s+/g, ' ');
  if (!name) errors.name = 'Project name is required.';
  else if (name.length > LIMITS.projectName)
    errors.name = `Project name must be ${LIMITS.projectName} characters or fewer.`;
  else if (
    context.projects.some(
      (project) =>
        project.id !== context.currentId && project.name.toLowerCase() === name.toLowerCase(),
    )
  )
    errors.name = 'A project with that name already exists.';

  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (description.length > LIMITS.projectDescription)
    errors.description = `Description must be ${LIMITS.projectDescription} characters or fewer.`;

  const color = asTrimmedString(raw.color).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) errors.color = 'Choose a valid project colour.';

  if (Object.keys(errors).length > 0) return fail(errors);
  return ok({ name, description, color });
}

