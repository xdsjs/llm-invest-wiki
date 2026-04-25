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
      checkpoints: Record<string, unknown>;
    };

    expect(state.market).toBe('us');
    expect(state.ticker).toBe('AAPL');
    expect(state.companyName).toBe('Apple Inc.');
    expect(state.cik).toBe('0000320193');
    expect(state.exchange).toBe('NASDAQ');
    expect(state.template).toBe('us');
    expect(state.materials).toEqual({});
    expect(state.checkpoints).toEqual({});
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

    const output = execSync(`node ${CLI} dossier apply ${manifestPath} --run-id 2026-04-25-aapl`, {
      cwd: testDir,
      encoding: 'utf-8',
      env,
    });

    const outPath = join(
      testDir,
      'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md'
    );

    expect(output).toContain('Created: 1');
    expect(output).toContain('Run: .llm-wiki-invest/dossier-runs/2026-04-25-aapl');
    expect(existsSync(outPath)).toBe(true);
    expect(readFileSync(outPath, 'utf-8')).toContain("title: 'Apple Q1 Results Release'");
    expect(existsSync(join(testDir, '.llm-wiki-invest/dossier-runs/2026-04-25-aapl/result.json'))).toBe(true);
    expect(existsSync(join(testDir, '.llm-wiki-invest/dossier-runs/2026-04-25-aapl/report.md'))).toBe(false);
  });

  it('should refresh legacy dossier state metadata from tracked source files', () => {
    const sourceDir = join(testDir, 'sources/earnings-release/2026/2026-02-01-q1-results');
    mkdirSync(sourceDir, { recursive: true });
    const sourcePath = join(sourceDir, '00-primary-q1-release.md');
    writeFileSync(sourcePath, `---
title: 'Apple Q1 Results Release'
source: 'https://investor.apple.com/q1-release.md'
author: '[[apple.com]]'
published: '2026-02-01'
created: '2026-04-23'
authority: 'company'
document_type: 'earnings-release'
disclosure_key: '2026-02-01-q1-results'
canonical_url: 'https://investor.apple.com/q1-release.md'
---

# Q1 Results
`);

    const statePath = join(testDir, '.llm-wiki-invest/dossier-state.json');
    const identityKey = 'company:https://investor.apple.com/q1-release.md:2026-02-01';
    writeFileSync(statePath, JSON.stringify({
      market: 'us',
      ticker: 'AAPL',
      companyName: 'Apple Inc.',
      cik: '0000320193',
      exchange: 'NASDAQ',
      template: 'us',
      initializedAt: '2026-04-01T00:00:00.000Z',
      materials: {
        [identityKey]: {
          outputPath: sourcePath,
          contentHash: 'legacyhash',
        },
      },
    }, null, 2));

    const output = execSync(`node ${CLI} dossier refresh-state`, {
      cwd: testDir,
      encoding: 'utf-8',
      env,
    });

    const state = JSON.parse(readFileSync(statePath, 'utf-8')) as {
      materials: Record<string, {
        contentHash: string;
        authority: string;
        documentType: string;
        published: string;
        canonicalUrl: string;
        firstSeenAt: string;
        lastSeenAt: string;
      }>;
      checkpoints: {
        company?: {
          latestPublished: string;
          latestPublishedByDocumentType: Record<string, string>;
          latestIdentityByDocumentType: Record<string, string>;
        };
      };
    };

    expect(output).toContain('Refreshed materials: 1');
    expect(state.materials[identityKey]).toMatchObject({
      contentHash: 'legacyhash',
      authority: 'company',
      documentType: 'earnings-release',
      published: '2026-02-01',
      canonicalUrl: 'https://investor.apple.com/q1-release.md',
    });
    expect(state.materials[identityKey].firstSeenAt).toBeTruthy();
    expect(state.materials[identityKey].lastSeenAt).toBeTruthy();
    expect(state.checkpoints.company?.latestPublished).toBe('2026-02-01');
    expect(state.checkpoints.company?.latestPublishedByDocumentType['earnings-release']).toBe('2026-02-01');
    expect(state.checkpoints.company?.latestIdentityByDocumentType['earnings-release']).toBe(identityKey);
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
