import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '..', 'dist', 'cli.js');
let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-dossier-command-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  execSync(`node ${CLI} init`, { cwd: testDir });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('dossier command', () => {
  it('should initialize dossier state from explicit identity fields', () => {
    execSync(
      `node ${CLI} dossier init --market us --ticker AAPL --company-name "Apple Inc." --cik 0000320193 --exchange NASDAQ`,
      { cwd: testDir }
    );

    const statePath = join(testDir, '.llm-wiki-invest', 'dossier-state.json');
    expect(existsSync(statePath)).toBe(true);

    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as {
      market: string;
      ticker: string;
      companyName: string;
      cik: string | null;
      exchange: string | null;
      template: string;
      materials: Record<string, unknown>;
    };

    expect(state.market).toBe('us');
    expect(state.ticker).toBe('AAPL');
    expect(state.companyName).toBe('Apple Inc.');
    expect(state.cik).toBe('0000320193');
    expect(state.exchange).toBe('NASDAQ');
    expect(state.template).toBe('us');
    expect(state.materials).toEqual({});
  });
});
