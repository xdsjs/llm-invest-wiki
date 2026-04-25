import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installMockMarkitdown } from './helpers/mock-markitdown.js';

const CLI = join(import.meta.dirname, '..', 'dist', 'cli.js');
let testDir: string;
let env: NodeJS.ProcessEnv;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-dossier-command-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  env = {
    ...process.env,
    LLM_WIKI_MARKITDOWN_BIN: installMockMarkitdown(join(testDir, 'bin')),
  };
  execSync(`node ${CLI} init`, { cwd: testDir, env });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('dossier command', () => {
  it('should initialize dossier state from explicit identity fields', () => {
    execSync(
      `node ${CLI} dossier init --market us --ticker AAPL --company-name "Apple Inc." --cik 0000320193 --exchange NASDAQ`,
      { cwd: testDir, env }
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

  it('should apply a reviewed manifest through the CLI', () => {
    const manifestPath = join(testDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({
      company: {
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
      },
      generatedAt: '2026-04-23T10:00:00Z',
      materials: [{
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        authority: 'company',
        title: 'Apple Q1 Results Release',
        source: 'data:text/markdown,%23%20Q1%20Results',
        canonicalUrl: 'data:text/markdown,%23%20Q1%20Results',
        author: '[[apple.com]]',
        published: '2026-02-01',
        documentType: 'earnings-release',
        disclosureKey: '2026-02-01-q1-results',
        sequence: 0,
        suggestedFilename: 'primary-q1-release',
      }],
    }, null, 2));

    const output = execSync(`node ${CLI} dossier apply ${manifestPath}`, {
      cwd: testDir,
      encoding: 'utf-8',
      env,
    });

    const outPath = join(
      testDir,
      'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md'
    );

    expect(output).toContain('Created: 1');
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, 'utf-8')).toContain("title: 'Apple Q1 Results Release'");
  });

  it('should show dossier status summary', () => {
    mkdirSync(join(testDir, 'sources/earnings-release/2026/2026-02-01-q1-results'), {
      recursive: true,
    });
    writeFileSync(
      join(testDir, 'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md'),
      `---
title: 'Apple Q1 Results Release'
source: 'https://investor.apple.com/q1-release.md'
author: '[[apple.com]]'
published: '2026-02-01'
created: '2026-04-23'
authority: 'company'
document_type: 'earnings-release'
disclosure_key: '2026-02-01-q1-results'
---

# Q1 Results
`
    );
    execSync(
      `node ${CLI} dossier init --market us --ticker AAPL --company-name "Apple Inc." --cik 0000320193 --exchange NASDAQ`,
      { cwd: testDir, env }
    );

    const output = execSync(`node ${CLI} dossier status`, {
      cwd: testDir,
      encoding: 'utf-8',
      env,
    });

    expect(output).toContain('Dossier: AAPL');
    expect(output).toContain('Materials: 1');
    expect(output).toContain('Disclosures: 1');
    expect(output).toContain('company: 1');
  });

  it('should fail dossier check when dossier files are malformed', () => {
    mkdirSync(join(testDir, 'sources/10-k/2024/disclosure-a'), { recursive: true });
    writeFileSync(
      join(testDir, 'sources/10-k/2024/disclosure-a/00-primary-10-k.md'),
      '# missing frontmatter'
    );

    const result = spawnSync('node', [CLI, 'dossier', 'check'], {
      cwd: testDir,
      encoding: 'utf-8',
      env,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('missing_frontmatter');
  });
});
