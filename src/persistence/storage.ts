import { recoverAppData, validateImport, type ImportResult } from '../domain/import';
import { DATA_VERSION, type AppData, type Theme } from '../domain/types';
import { LIMITS } from '../domain/validation';

export const STORAGE_KEY = 'flowboard:v1:data';
export const BACKUP_KEY = 'flowboard:v1:unreadable-backup';
export const EXPORT_APP_ID = 'flowboard';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function getStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function detectPreferredTheme(): Theme {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    /* ignore */
  }
  return 'light';
}

export function createEmptyData(theme: Theme = 'light'): AppData {
  return { version: DATA_VERSION, projects: [], tasks: [], activities: [], theme };
}

export interface LoadResult {
  data: AppData;
  warnings: string[];
  /** True when stored data had to be repaired or discarded. */
  recovered: boolean;
}

/** Reads localStorage and repairs it defensively; never throws. */
export function loadAppData(
  storage: StorageLike | null = getStorage(),
  fallbackTheme: Theme = detectPreferredTheme(),
): LoadResult {
  if (!storage) {
    return { data: createEmptyData(fallbackTheme), warnings: [], recovered: false };
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return {
      data: createEmptyData(fallbackTheme),
      warnings: ['Local storage is unavailable in this browser. Changes will not be saved.'],
      recovered: true,
    };
  }

  if (!raw) return { data: createEmptyData(fallbackTheme), warnings: [], recovered: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      storage.setItem(BACKUP_KEY, raw);
    } catch {
      /* best effort */
    }
    return {
      data: createEmptyData(fallbackTheme),
      warnings: [
        'Saved data was malformed. A backup was kept in local storage and FlowBoard started empty.',
      ],
      recovered: true,
    };
  }

  const recoveredData = recoverAppData(parsed, fallbackTheme);
  const { recoveryWarnings, ...data } = recoveredData;
  const repaired = recoveryWarnings.length > 0;
  if (repaired) {
    try {
      storage.setItem(BACKUP_KEY, raw);
    } catch {
      /* best effort */
    }
  }

  return {
    data,
    warnings: repaired
      ? ['Some saved records were invalid and were skipped.', ...recoveryWarnings]
      : [],
    recovered: repaired,
  };
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export function saveAppData(data: AppData, storage: StorageLike | null = getStorage()): SaveResult {
  if (!storage) return { ok: false, error: 'Local storage is unavailable.' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return {
      ok: false,
      error:
        name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
          ? 'Browser storage is full. Export your data, then remove some projects or tasks.'
          : 'Your changes could not be saved to this browser.',
    };
  }
}

export function clearStoredData(storage: StorageLike | null = getStorage()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface ExportEnvelope extends AppData {
  app: typeof EXPORT_APP_ID;
  exportedAt: string;
}

export function serializeExport(data: AppData, exportedAt: string = new Date().toISOString()): string {
  const envelope: ExportEnvelope = { app: EXPORT_APP_ID, exportedAt, ...data };
  return JSON.stringify(envelope, null, 2);
}

export function exportFileName(date: Date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  return `flowboard-export-${stamp}.json`;
}

/** Parses and validates an imported JSON file's text. */
export function parseImportText(text: string, fallbackTheme: Theme = 'light'): ImportResult {
  if (!text || text.trim().length === 0) {
    return { ok: false, errors: ['The selected file is empty.'] };
  }
  if (text.length > LIMITS.maxImportBytes) {
    return { ok: false, errors: ['The file is larger than 5 MB and was not imported.'] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      errors: [
        `The file is not valid JSON${error instanceof Error ? `: ${error.message}` : '.'}`,
      ],
    };
  }
  return validateImport(parsed, fallbackTheme);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.dataset.theme = theme;
}
