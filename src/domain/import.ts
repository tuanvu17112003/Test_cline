import { isValidDateString, isValidTimestamp } from './dates';
import { normalizeTaskOrder } from './tasks';
import { normalizeLabels } from './validation';
import {
  DATA_VERSION,
  isPriority,
  isTaskStatus,
  DEFAULT_PROJECT_COLOR,
  type Activity,
  type ActivityKind,
  type AppData,
  type Project,
  type Subtask,
  type Task,
  type Theme,
} from './types';

export interface ImportSuccess {
  ok: true;
  data: AppData;
  warnings: string[];
}
export interface ImportFailure {
  ok: false;
  errors: string[];
}
export type ImportResult = ImportSuccess | ImportFailure;

const MAX_ACTIVITIES = 100;
const MAX_REPORTED_ERRORS = 12;

type Parsed<T> = { value: T | null; issues: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const OPTIONAL_DEFAULTS = {
  now: () => new Date().toISOString(),
};

function parseSubtask(raw: unknown, path: string): Parsed<Subtask> {
  if (!isRecord(raw)) return { value: null, issues: [`${path} must be an object.`] };
  if (!nonEmptyString(raw.title))
    return { value: null, issues: [`${path}.title must be a non-empty string.`] };
  return {
    value: {
      id: nonEmptyString(raw.id) ? raw.id : `${path.replace(/[^\w-]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`,
      title: raw.title.trim(),
      done: raw.done === true,
    },
    issues: [],
  };
}

function parseProjectRecord(raw: unknown, path: string): Parsed<Project> {
  if (!isRecord(raw)) return { value: null, issues: [`${path} must be an object.`] };
  const id = nonEmptyString(raw.id) ? raw.id.trim() : '';
  if (!id) return { value: null, issues: [`${path}.id must be a non-empty string.`] };
  const name = nonEmptyString(raw.name) ? raw.name.trim() : '';
  if (!name) return { value: null, issues: [`${path}.name must be a non-empty string.`] };

  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : OPTIONAL_DEFAULTS.now();
  const updatedAt = isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt;
  const color =
    typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color)
      ? raw.color.toLowerCase()
      : DEFAULT_PROJECT_COLOR;

  return {
    value: {
      id,
      name,
      description: typeof raw.description === 'string' ? raw.description : '',
      color,
      createdAt,
      updatedAt,
      ...(raw.demo === true ? { demo: true } : {}),
    },
    issues: [],
  };
}

function parseTaskRecord(raw: unknown, path: string): Parsed<Task> {
  if (!isRecord(raw)) return { value: null, issues: [`${path} must be an object.`] };
  const id = nonEmptyString(raw.id) ? raw.id.trim() : '';
  if (!id) return { value: null, issues: [`${path}.id must be a non-empty string.`] };
  const title = nonEmptyString(raw.title) ? raw.title.trim() : '';
  if (!title) return { value: null, issues: [`${path}.title must be a non-empty string.`] };
  const projectId = nonEmptyString(raw.projectId) ? raw.projectId.trim() : '';
  if (!projectId)
    return { value: null, issues: [`${path}.projectId must be a non-empty string.`] };

  const status = raw.status;
  if (!isTaskStatus(status)) {
    return {
      value: null,
      issues: [`${path}.status must be one of backlog, todo, in_progress, done.`],
    };
  }
  const priority = raw.priority;
  if (!isPriority(priority)) {
    return {
      value: null,
      issues: [`${path}.priority must be one of low, medium, high, critical.`],
    };
  }

  const issues: string[] = [];
  if (!Array.isArray(raw.labels) && raw.labels !== undefined)
    issues.push(`${path}.labels must be an array of strings.`);
  if (!Array.isArray(raw.subtasks) && raw.subtasks !== undefined)
    issues.push(`${path}.subtasks must be an array.`);

  const subtasks: Subtask[] = [];
  if (Array.isArray(raw.subtasks)) {
    raw.subtasks.forEach((entry, index) => {
      const parsed = parseSubtask(entry, `${path}.subtasks[${index}]`);
      issues.push(...parsed.issues);
      if (parsed.value) subtasks.push(parsed.value);
    });
  }

  let dueDate: string | null = null;
  if (raw.dueDate !== null && raw.dueDate !== undefined && raw.dueDate !== '') {
    if (isValidDateString(raw.dueDate)) dueDate = raw.dueDate;
    else issues.push(`${path}.dueDate must be a YYYY-MM-DD calendar date or null.`);
  }

  const createdAt = isValidTimestamp(raw.createdAt) ? raw.createdAt : OPTIONAL_DEFAULTS.now();
  const order = typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 0;

  return {
    value: {
      id,
      projectId,
      title,
      description: typeof raw.description === 'string' ? raw.description : '',
      status,
      priority,
      dueDate,
      labels: normalizeLabels(raw.labels),
      subtasks,
      order,
      createdAt,
      updatedAt: isValidTimestamp(raw.updatedAt) ? raw.updatedAt : createdAt,
      completedAt: isValidTimestamp(raw.completedAt) ? raw.completedAt : null,
      ...(raw.demo === true ? { demo: true } : {}),
    },
    issues,
  };
}

const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'project-created',
  'project-updated',
  'project-deleted',
  'task-created',
  'task-updated',
  'task-moved',
  'task-completed',
  'task-deleted',
  'data-imported',
  'data-reset',
  'demo-loaded',
  'demo-removed',
];

function parseActivityRecord(raw: unknown): Activity | null {
  if (!isRecord(raw)) return null;
  if (!nonEmptyString(raw.id) || !nonEmptyString(raw.message)) return null;
  if (!isValidTimestamp(raw.at)) return null;
  if (typeof raw.kind !== 'string' || !ACTIVITY_KINDS.includes(raw.kind as ActivityKind)) return null;
  return {
    id: raw.id,
    kind: raw.kind as ActivityKind,
    message: raw.message,
    at: raw.at,
    ...(nonEmptyString(raw.projectId) ? { projectId: raw.projectId } : {}),
    ...(nonEmptyString(raw.taskId) ? { taskId: raw.taskId } : {}),
  };
}

function resolveTheme(value: unknown, fallback: Theme): Theme {
  return value === 'light' || value === 'dark' ? value : fallback;
}

interface Extracted {
  data: AppData;
  errors: string[];
}

function extract(raw: unknown, strict: boolean, fallbackTheme: Theme): Extracted {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return {
      data: { version: DATA_VERSION, projects: [], tasks: [], activities: [], theme: fallbackTheme },
      errors: ['The file must contain a JSON object.'],
    };
  }

  if (strict) {
    if (raw.app !== undefined && raw.app !== 'flowboard')
      errors.push('This file was not exported from FlowBoard.');
    const version = typeof raw.version === 'string' ? Number(raw.version) : raw.version;
    if (version !== DATA_VERSION)
      errors.push(`Unsupported data version "${String(raw.version)}". Expected ${DATA_VERSION}.`);
    if (!Array.isArray(raw.projects)) errors.push('"projects" must be an array.');
    if (!Array.isArray(raw.tasks)) errors.push('"tasks" must be an array.');
    if (errors.length > 0) {
      return {
        data: {
          version: DATA_VERSION,
          projects: [],
          tasks: [],
          activities: [],
          theme: fallbackTheme,
        },
        errors,
      };
    }
  }

  const projects: Project[] = [];
  const projectIds = new Set<string>();
  const rawProjects = Array.isArray(raw.projects) ? raw.projects : [];
  if (!Array.isArray(raw.projects) && !strict)
    errors.push('No project list found; starting with an empty workspace.');

  rawProjects.forEach((entry, index) => {
    const parsed = parseProjectRecord(entry, `projects[${index}]`);
    if (!parsed.value) {
      if (strict) errors.push(...parsed.issues);
      else errors.push(`Skipped an invalid project at projects[${index}].`);
      return;
    }
    if (projectIds.has(parsed.value.id)) {
      errors.push(`Duplicate project id "${parsed.value.id}".`);
      return;
    }
    projectIds.add(parsed.value.id);
    projects.push(parsed.value);
  });

  const tasks: Task[] = [];
  const taskIds = new Set<string>();
  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  rawTasks.forEach((entry, index) => {
    const parsed = parseTaskRecord(entry, `tasks[${index}]`);
    if (!parsed.value) {
      if (strict) errors.push(...parsed.issues);
      else errors.push(`Skipped an invalid task at tasks[${index}].`);
      return;
    }
    if (taskIds.has(parsed.value.id)) {
      errors.push(`Duplicate task id "${parsed.value.id}".`);
      return;
    }
    if (!projectIds.has(parsed.value.projectId)) {
      errors.push(
        `Task "${parsed.value.title}" references a missing project (${parsed.value.projectId}).`,
      );
      return;
    }
    errors.push(...parsed.issues);
    taskIds.add(parsed.value.id);
    tasks.push(parsed.value);
  });

  const activities: Activity[] = [];
  const seenActivities = new Set<string>();
  for (const entry of Array.isArray(raw.activities) ? raw.activities : []) {
    const activity = parseActivityRecord(entry);
    if (!activity || seenActivities.has(activity.id)) continue;
    seenActivities.add(activity.id);
    activities.push(activity);
  }
  activities.sort((a, b) => b.at.localeCompare(a.at));

  return {
    data: {
      version: DATA_VERSION,
      projects,
      tasks: normalizeTaskOrder(tasks),
      activities: activities.slice(0, MAX_ACTIVITIES),
      theme: resolveTheme(raw.theme, fallbackTheme),
    },
    errors,
  };
}

/** Strict validation used by the import flow. */
export function validateImport(raw: unknown, fallbackTheme: Theme = 'light'): ImportResult {
  const { data, errors } = extract(raw, true, fallbackTheme);
  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_REPORTED_ERRORS);
    if (errors.length > shown.length) {
      shown.push(`…and ${errors.length - shown.length} more problems.`);
    }
    return { ok: false, errors: shown };
  }
  return { ok: true, data, warnings: [] };
}

/**
 * Lenient recovery for data already inside localStorage. Broken records are dropped
 * instead of losing the whole workspace, and the caller receives warnings to show.
 */
export function recoverAppData(raw: unknown, fallbackTheme: Theme = 'light'): AppData & {
  recoveryWarnings: string[];
} {
  const { data, errors } = extract(raw, false, fallbackTheme);
  return { ...data, recoveryWarnings: errors.slice(0, MAX_REPORTED_ERRORS) };
}

export function isFlowBoardExport(raw: unknown): boolean {
  return isRecord(raw) && (raw.app === 'flowboard' || Array.isArray(raw.projects));
}
