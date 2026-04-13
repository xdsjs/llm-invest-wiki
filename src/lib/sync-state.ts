import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface SyncState {
  lastSyncAt: string | null;
  wikiFiles: Record<string, { hash: string; mtime: number }>;
  sourceFiles: Record<string, { mtime: number }>;
}

const EMPTY_STATE: SyncState = {
  lastSyncAt: null,
  wikiFiles: {},
  sourceFiles: {},
};

export function getSyncStatePath(projectDir: string): string {
  return join(projectDir, ".llm-wiki", "sync-state.json");
}

export function loadSyncState(projectDir: string): SyncState {
  const path = getSyncStatePath(projectDir);
  if (!existsSync(path)) return { ...EMPTY_STATE };

  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as SyncState;
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function saveSyncState(projectDir: string, state: SyncState): void {
  const path = getSyncStatePath(projectDir);
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(state, null, 2), "utf-8");
}
