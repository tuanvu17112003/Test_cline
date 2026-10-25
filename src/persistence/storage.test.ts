import { describe, expect, it } from 'vitest';
import { makeData, makeProject, makeTask } from '../test/fixtures';
import {
  applyTheme,
  BACKUP_KEY,
  createEmptyData,
  exportFileName,
  loadAppData,
  parseImportText,
  saveAppData,
  serializeExport,
  STORAGE_KEY,
  type StorageLike,
} from './storage';

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();
  failOnWrite: Error | null = null;

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failOnWrite) {
      const error = this.failOnWrite;
      this.failOnWrite = null;
      throw error;
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  raw(key: string): string | null {
    return this.store.get(key) ?? null;
  }
}

const sampleData = () =>
  makeData({
    projects: [makeProject({ id: 'p1', name: 'Alpha' })],
    tasks: [makeTask({ id: 't1', projectId: 'p1' })],
    activities: [],
    theme: 'dark',
  });

describe('loading', () => {
  it('returns empty data when nothing is stored', () => {
    const result = loadAppData(new MemoryStorage(), 'light');
    expect(result.data.projects).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.recovered).toBe(false);
  });

  it('round-trips saved data', () => {
    const storage = new MemoryStorage();
    expect(saveAppData(sampleData(), storage).ok).toBe(true);
    const result = loadAppData(storage, 'light');
    expect(result.data.projects[0].name).toBe('Alpha');
    expect(result.data.theme).toBe('dark');
    expect(result.data.tasks).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('recovers from malformed JSON and keeps a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');
    const result = loadAppData(storage, 'light');
    expect(result.data.projects).toEqual([]);
    expect(result.recovered).toBe(true);
    expect(result.warnings[0]).toMatch(/malformed/i);
    expect(storage.raw(BACKUP_KEY)).toBe('{not json');
  });

  it('repairs partially broken data instead of discarding it', () => {
    const storage = new MemoryStorage();
    const broken = {
      ...sampleData(),
      tasks: [{ id: 'broken' }],
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(broken));
    const result = loadAppData(storage, 'light');
    expect(result.data.projects).toHaveLength(1);
    expect(result.data.tasks).toHaveLength(0);
    expect(result.recovered).toBe(true);
    expect(storage.raw(BACKUP_KEY)).not.toBeNull();
  });

  it('handles unavailable storage gracefully', () => {
    const result = loadAppData(null, 'dark');
    expect(result.data.theme).toBe('dark');
    expect(result.warnings).toEqual([]);
  });

  it('creates empty data with the requested theme', () => {
    expect(createEmptyData('dark')).toEqual({
      version: 1,
      projects: [],
      tasks: [],
      activities: [],
      theme: 'dark',
    });
  });
});

describe('saving', () => {
  it('reports quota errors with an actionable message', () => {
    const storage = new MemoryStorage();
    const error = new Error('Quota');
    error.name = 'QuotaExceededError';
    storage.failOnWrite = error;
    const result = saveAppData(sampleData(), storage);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/storage is full/i);
  });

  it('reports generic write failures', () => {
    const storage = new MemoryStorage();
    storage.failOnWrite = new Error('boom');
    expect(saveAppData(sampleData(), storage).error).toMatch(/could not be saved/i);
  });

  it('reports missing storage', () => {
    expect(saveAppData(sampleData(), null).ok).toBe(false);
  });
});

describe('export and import text', () => {
  it('serialises an export envelope with metadata', () => {
    const json = serializeExport(sampleData(), '2026-03-10T10:00:00.000Z');
    const parsed = JSON.parse(json);
    expect(parsed.app).toBe('flowboard');
    expect(parsed.exportedAt).toBe('2026-03-10T10:00:00.000Z');
    expect(parsed.projects[0].name).toBe('Alpha');
    expect(json).toContain('\n  ');
  });

  it('accepts previously exported JSON', () => {
    const text = serializeExport(sampleData());
    const result = parseImportText(text, 'light');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.tasks).toHaveLength(1);
  });

  it('rejects empty, oversized and malformed files', () => {
    const empty = parseImportText('   ');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.errors[0]).toMatch(/empty/i);

    const huge = parseImportText('x'.repeat(5 * 1024 * 1024 + 1));
    expect(huge.ok).toBe(false);

    const malformed = parseImportText('{oops');
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.errors[0]).toMatch(/not valid JSON/i);
  });

  it('names exports with the current date', () => {
    expect(exportFileName(new Date('2026-03-10T12:00:00.000Z'))).toBe(
      'flowboard-export-2026-03-10.json',
    );
  });
});

describe('theme application', () => {
  it('toggles the dark class and dataset', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
