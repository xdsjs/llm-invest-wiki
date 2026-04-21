import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeSync, updateSyncState } from '../src/lib/sync.js';
import type { SyncState } from '../src/lib/sync.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-test-${Date.now()}`);
  mkdirSync(join(testDir, 'wiki'), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('computeSync', () => {
  it('should detect added files', () => {
    writeFileSync(join(testDir, 'wiki/page-a.md'), '# Page A');
    const emptyState: SyncState = { entries: {}, lastSync: '' };
    const result = computeSync([join(testDir, 'wiki')], testDir, emptyState);
    expect(result.added).toEqual(['wiki/page-a.md']);
    expect(result.modified).toEqual([]);
    expect(result.deleted).toEqual([]);
  });

  it('should detect deleted files', () => {
    const state: SyncState = {
      entries: {
        'wiki/deleted.md': { path: 'wiki/deleted.md', mtime: 0, contentHash: 'abc', lastSynced: '2026-01-01' },
      },
      lastSync: '2026-01-01',
    };
    const result = computeSync([join(testDir, 'wiki')], testDir, state);
    expect(result.deleted).toEqual(['wiki/deleted.md']);
  });

  it('should detect unchanged files', () => {
    const filePath = join(testDir, 'wiki/page.md');
    writeFileSync(filePath, '# Unchanged');
    const state = updateSyncState([join(testDir, 'wiki')], testDir, { entries: {}, lastSync: '' });
    const result = computeSync([join(testDir, 'wiki')], testDir, state);
    expect(result.unchanged).toEqual(['wiki/page.md']);
  });
});

describe('updateSyncState', () => {
  it('should create entries for all files', () => {
    writeFileSync(join(testDir, 'wiki/a.md'), '# A');
    writeFileSync(join(testDir, 'wiki/b.md'), '# B');
    const state = updateSyncState([join(testDir, 'wiki')], testDir, { entries: {}, lastSync: '' });
    expect(Object.keys(state.entries)).toHaveLength(2);
    expect(state.entries['wiki/a.md']).toBeDefined();
    expect(state.entries['wiki/b.md']).toBeDefined();
    expect(state.entries['wiki/a.md'].contentHash).toBeTruthy();
  });
});
