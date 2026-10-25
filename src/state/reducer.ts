import type { DemoDataset } from '../data/demo';
import {
  createTaskInList,
  deleteTaskFromList,
  deleteTasksForProject,
  moveTask,
  normalizeTaskOrder,
  toggleSubtask,
  updateTaskInList,
} from '../domain/tasks';
import {
  STATUS_LABELS,
  type Activity,
  type ActivityKind,
  type AppData,
  type Project,
  type ProjectDraft,
  type TaskDraft,
  type TaskStatus,
  type Theme,
} from '../domain/types';
import { createId } from '../lib/ids';

export const ACTIVITY_LIMIT = 60;

export type AppAction =
  | { type: 'project/create'; id: string; at: string; draft: ProjectDraft }
  | { type: 'project/update'; id: string; at: string; draft: ProjectDraft }
  | { type: 'project/delete'; id: string; at: string }
  | { type: 'task/create'; id: string; at: string; draft: TaskDraft }
  | { type: 'task/update'; id: string; at: string; draft: TaskDraft }
  | { type: 'task/delete'; id: string; at: string }
  | { type: 'task/move'; id: string; at: string; status: TaskStatus; index: number }
  | { type: 'task/toggle-subtask'; id: string; at: string; subtaskId: string }
  | { type: 'data/import'; at: string; data: AppData }
  | { type: 'data/hydrate'; data: AppData }
  | { type: 'data/reset'; at: string }
  | { type: 'data/load-demo'; at: string; demo: DemoDataset }
  | { type: 'data/remove-demo'; at: string }
  | { type: 'theme/set'; theme: Theme };

function activity(
  kind: ActivityKind,
  message: string,
  at: string,
  extra: Pick<Activity, 'projectId' | 'taskId'> = {},
): Activity {
  return { id: createId('activity'), kind, message, at, ...extra };
}

function pushActivity(activities: readonly Activity[], entry: Activity): Activity[] {
  return [entry, ...activities].slice(0, ACTIVITY_LIMIT);
}

export function appReducer(state: AppData, action: AppAction): AppData {
  switch (action.type) {
    case 'project/create': {
      const project: Project = {
        id: action.id,
        name: action.draft.name,
        description: action.draft.description,
        color: action.draft.color,
        createdAt: action.at,
        updatedAt: action.at,
      };
      return {
        ...state,
        projects: [...state.projects, project],
        activities: pushActivity(
          state.activities,
          activity('project-created', `Created project “${project.name}”`, action.at, {
            projectId: project.id,
          }),
        ),
      };
    }

    case 'project/update': {
      const existing = state.projects.find((project) => project.id === action.id);
      if (!existing) return state;
      const projects = state.projects.map((project) =>
        project.id === action.id
          ? {
              ...project,
              name: action.draft.name,
              description: action.draft.description,
              color: action.draft.color,
              updatedAt: action.at,
            }
          : project,
      );
      return {
        ...state,
        projects,
        activities: pushActivity(
          state.activities,
          activity('project-updated', `Updated project “${action.draft.name}”`, action.at, {
            projectId: action.id,
          }),
        ),
      };
    }

    case 'project/delete': {
      const project = state.projects.find((entry) => entry.id === action.id);
      if (!project) return state;
      const removedTaskCount = state.tasks.filter((task) => task.projectId === action.id).length;
      return {
        ...state,
        projects: state.projects.filter((entry) => entry.id !== action.id),
        tasks: deleteTasksForProject(state.tasks, action.id),
        activities: pushActivity(
          state.activities,
          activity(
            'project-deleted',
            removedTaskCount > 0
              ? `Deleted project “${project.name}” and ${removedTaskCount} task${removedTaskCount === 1 ? '' : 's'}`
              : `Deleted project “${project.name}”`,
            action.at,
            { projectId: project.id },
          ),
        ),
      };
    }

    case 'task/create': {
      const { task, tasks } = createTaskInList(state.tasks, action.draft, {
        now: action.at,
        idFactory: (prefix) => (prefix === 'task' ? action.id : createId(prefix)),
      });
      return {
        ...state,
        tasks,
        activities: pushActivity(
          state.activities,
          activity(
            task.status === 'done' ? 'task-completed' : 'task-created',
            task.status === 'done' ? `Completed “${task.title}”` : `Created task “${task.title}”`,
            action.at,
            { projectId: task.projectId, taskId: task.id },
          ),
        ),
      };
    }

    case 'task/update': {
      const existing = state.tasks.find((task) => task.id === action.id);
      if (!existing) return state;
      const tasks = updateTaskInList(state.tasks, action.id, action.draft, action.at);
      const updated = tasks.find((task) => task.id === action.id);
      if (!updated) return state;
      return {
        ...state,
        tasks,
        activities: pushActivity(
          state.activities,
          activity('task-updated', `Updated task “${updated.title}”`, action.at, {
            projectId: updated.projectId,
            taskId: updated.id,
          }),
        ),
      };
    }

    case 'task/delete': {
      const existing = state.tasks.find((task) => task.id === action.id);
      if (!existing) return state;
      return {
        ...state,
        tasks: deleteTaskFromList(state.tasks, action.id),
        activities: pushActivity(
          state.activities,
          activity('task-deleted', `Deleted task “${existing.title}”`, action.at, {
            projectId: existing.projectId,
            taskId: existing.id,
          }),
        ),
      };
    }

    case 'task/move': {
      const before = state.tasks.find((task) => task.id === action.id);
      if (!before) return state;
      const tasks = moveTask(state.tasks, action.id, action.status, action.index, action.at);
      const after = tasks.find((task) => task.id === action.id);
      if (!after) return state;
      if (before.status === after.status && before.order === after.order) return { ...state, tasks };

      const becameDone = after.status === 'done' && before.status !== 'done';
      const message = becameDone
        ? `Completed “${after.title}”`
        : `Moved “${after.title}” to ${STATUS_LABELS[after.status]}`;
      return {
        ...state,
        tasks,
        activities: pushActivity(
          state.activities,
          activity(becameDone ? 'task-completed' : 'task-moved', message, action.at, {
            projectId: after.projectId,
            taskId: after.id,
          }),
        ),
      };
    }

    case 'task/toggle-subtask': {
      const existing = state.tasks.find((task) => task.id === action.id);
      if (!existing || !existing.subtasks.some((entry) => entry.id === action.subtaskId)) {
        return state;
      }
      return {
        ...state,
        tasks: toggleSubtask(state.tasks, action.id, action.subtaskId, action.at),
      };
    }

    case 'data/hydrate': {
      return action.data;
    }

    case 'data/import': {
      const imported = action.data;
      return {
        ...imported,
        activities: pushActivity(
          imported.activities,
          activity(
            'data-imported',
            `Imported ${imported.projects.length} project${imported.projects.length === 1 ? '' : 's'} and ${imported.tasks.length} task${imported.tasks.length === 1 ? '' : 's'}`,
            action.at,
          ),
        ),
      };
    }

    case 'data/reset': {
      return {
        version: state.version,
        projects: [],
        tasks: [],
        activities: [activity('data-reset', 'Reset all workspace data', action.at)],
        theme: state.theme,
      };
    }

    case 'data/load-demo': {
      const existingProjectIds = new Set(state.projects.map((project) => project.id));
      const existingTaskIds = new Set(state.tasks.map((task) => task.id));
      const newProjects = action.demo.projects.filter(
        (project) => !existingProjectIds.has(project.id),
      );
      const newTasks = action.demo.tasks.filter(
        (task) => !existingTaskIds.has(task.id) && !existingProjectIds.has(task.projectId),
      );
      if (newProjects.length === 0 && newTasks.length === 0) return state;
      return {
        ...state,
        projects: [...state.projects, ...newProjects],
        tasks: normalizeTaskOrder([...state.tasks, ...newTasks]),
        activities: pushActivity(
          state.activities,
          activity(
            'demo-loaded',
            `Loaded demo workspace (${newProjects.length} projects, ${newTasks.length} tasks)`,
            action.at,
          ),
        ),
      };
    }

    case 'data/remove-demo': {
      const demoProjectIds = new Set(
        state.projects.filter((project) => project.demo).map((project) => project.id),
      );
      const hasDemoContent =
        demoProjectIds.size > 0 || state.tasks.some((task) => task.demo === true);
      if (!hasDemoContent) return state;
      return {
        ...state,
        projects: state.projects.filter((project) => !demoProjectIds.has(project.id)),
        tasks: normalizeTaskOrder(
          state.tasks.filter((task) => !task.demo && !demoProjectIds.has(task.projectId)),
        ),
        activities: pushActivity(
          state.activities,
          activity('demo-removed', 'Removed demo workspace data', action.at),
        ),
      };
    }

    case 'theme/set': {
      if (state.theme === action.theme) return state;
      return { ...state, theme: action.theme };
    }

    default:
      return state;
  }
}
