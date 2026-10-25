import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { createDemoData } from '../data/demo';
import { todayISO } from '../domain/dates';
import type { AppData, Project, ProjectDraft, TaskDraft, TaskStatus, Theme } from '../domain/types';
import { createId } from '../lib/ids';
import {
  applyTheme,
  createEmptyData,
  detectPreferredTheme,
  loadAppData,
  saveAppData,
} from '../persistence/storage';
import { appReducer, type AppAction } from './reducer';

export interface AppActions {
  createProject: (draft: ProjectDraft) => string;
  updateProject: (id: string, draft: ProjectDraft) => void;
  deleteProject: (id: string) => void;
  createTask: (draft: TaskDraft) => string;
  updateTask: (id: string, draft: TaskDraft) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, status: TaskStatus, index: number) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  importData: (data: AppData) => void;
  resetData: () => void;
  loadDemo: () => void;
  removeDemo: () => void;
  setTheme: (theme: Theme) => void;
}

export interface AppContextValue {
  data: AppData;
  projects: Project[];
  tasks: AppData['tasks'];
  theme: Theme;
  /** False for the very first render, while localStorage is being read. */
  hydrated: boolean;
  recoveryWarnings: string[];
  storageError: string | null;
  hasDemoData: boolean;
  actions: AppActions;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(appReducer, undefined, () =>
    createEmptyData(detectPreferredTheme()),
  );
  const [hydrated, setHydrated] = useState(false);
  const [recoveryWarnings, setRecoveryWarnings] = useState<string[]>([]);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    const result = loadAppData();
    dispatch({ type: 'data/hydrate', data: result.data });
    setRecoveryWarnings(result.warnings);
    setHydrated(true);
  }, []);

  useEffect(() => {
    applyTheme(data.theme);
    if (!hydrated) return;
    const result = saveAppData(data);
    setStorageError(result.ok ? null : (result.error ?? 'Your changes could not be saved.'));
  }, [data, hydrated]);

  const createProject = useCallback((draft: ProjectDraft) => {
    const id = createId('project');
    dispatch({ type: 'project/create', id, at: new Date().toISOString(), draft });
    return id;
  }, []);

  const updateProject = useCallback((id: string, draft: ProjectDraft) => {
    dispatch({ type: 'project/update', id, at: new Date().toISOString(), draft });
  }, []);

  const deleteProject = useCallback((id: string) => {
    dispatch({ type: 'project/delete', id, at: new Date().toISOString() });
  }, []);

  const createTask = useCallback((draft: TaskDraft) => {
    const id = createId('task');
    dispatch({ type: 'task/create', id, at: new Date().toISOString(), draft });
    return id;
  }, []);

  const updateTask = useCallback((id: string, draft: TaskDraft) => {
    dispatch({ type: 'task/update', id, at: new Date().toISOString(), draft });
  }, []);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'task/delete', id, at: new Date().toISOString() });
  }, []);

  const moveTaskAction = useCallback((id: string, status: TaskStatus, index: number) => {
    dispatch({ type: 'task/move', id, at: new Date().toISOString(), status, index });
  }, []);

  const toggleSubtaskAction = useCallback((taskId: string, subtaskId: string) => {
    dispatch({
      type: 'task/toggle-subtask',
      id: taskId,
      subtaskId,
      at: new Date().toISOString(),
    });
  }, []);

  const importData = useCallback((imported: AppData) => {
    dispatch({ type: 'data/import', at: new Date().toISOString(), data: imported });
  }, []);

  const resetData = useCallback(() => {
    dispatch({ type: 'data/reset', at: new Date().toISOString() });
  }, []);

  const loadDemo = useCallback(() => {
    dispatch({
      type: 'data/load-demo',
      at: new Date().toISOString(),
      demo: createDemoData(todayISO()),
    });
  }, []);

  const removeDemo = useCallback(() => {
    dispatch({ type: 'data/remove-demo', at: new Date().toISOString() });
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    dispatch({ type: 'theme/set', theme });
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      createProject,
      updateProject,
      deleteProject,
      createTask,
      updateTask,
      deleteTask,
      moveTask: moveTaskAction,
      toggleSubtask: toggleSubtaskAction,
      importData,
      resetData,
      loadDemo,
      removeDemo,
      setTheme,
    }),
    [
      createProject,
      updateProject,
      deleteProject,
      createTask,
      updateTask,
      deleteTask,
      moveTaskAction,
      toggleSubtaskAction,
      importData,
      resetData,
      loadDemo,
      removeDemo,
      setTheme,
    ],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      data,
      projects: data.projects,
      tasks: data.tasks,
      theme: data.theme,
      hydrated,
      recoveryWarnings,
      storageError,
      hasDemoData:
        data.projects.some((project) => project.demo === true) ||
        data.tasks.some((task) => task.demo === true),
      actions,
    }),
    [data, hydrated, recoveryWarnings, storageError, actions],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>.');
  return context;
}

export type { AppAction };
