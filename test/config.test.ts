import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findVaultRoot, vaultPaths } from '../src/lib/config.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-config-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('config path resolution', () => {
  it('should find .llm-wiki-invest vaults', () => {
    mkdirSync(join(testDir, '.llm-wiki-invest'), { recursive: true });
    writeFileSync(join(testDir, '.llm-wiki-invest/config.toml'), '[vault]\nname = "Primary"\nlanguage = "en"\n');

    expect(findVaultRoot(testDir)).toBe(testDir);

    const paths = vaultPaths(testDir);
    expect(paths.config).toBe(join(testDir, '.llm-wiki-invest/config.toml'));
    expect(paths.syncState).toBe(join(testDir, '.llm-wiki-invest/sync-state.json'));
  });

  it('should not recognize legacy .llm-wiki vaults', () => {
    mkdirSync(join(testDir, '.llm-wiki'), { recursive: true });
    writeFileSync(join(testDir, '.llm-wiki/config.toml'), '[vault]\nname = "Legacy"\nlanguage = "en"\n');

    expect(findVaultRoot(testDir)).toBeNull();
  });
});
