import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';

const CLI = join(import.meta.dirname, '..', 'dist', 'cli.js');
let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-sources-command-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  execSync(`node ${CLI} init`, { cwd: testDir });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('sources command', () => {
  it('should list pending sources as json', () => {
    const sourceDir = join(testDir, 'sources/earnings-release/2026/q1-results');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(join(sourceDir, '00-release.md'), `---
title: Release
source: https://example.com/release
authority: company
document_type: earnings-release
disclosure_key: q1-results
published: 2026-02-01
---

# body
`);

    const output = execSync(`node ${CLI} sources pending --json`, {
      cwd: testDir,
      encoding: 'utf-8',
    });
    const payload = JSON.parse(output) as {
      groups: Array<{ path: string; sources: Array<{ path: string; status: string }> }>;
    };

    expect(payload.groups).toHaveLength(1);
    expect(payload.groups[0].path).toBe('sources/earnings-release/2026/q1-results');
    expect(payload.groups[0].sources[0].status).toBe('new');
  });

  it('should mark sources as ingested with wiki page references', () => {
    const sourceDir = join(testDir, 'sources/earnings-release/2026/q1-results');
    const sourcePath = join(sourceDir, '00-release.md');
    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(sourcePath, `---
title: Release
source: https://example.com/release
authority: company
document_type: earnings-release
disclosure_key: q1-results
published: 2026-02-01
---

# body
`);

    const output = execSync(
      `node ${CLI} sources mark-ingested sources/earnings-release/2026/q1-results/00-release.md --pages wiki/events/q1-results.md,wiki/financials.md`,
      { cwd: testDir, encoding: 'utf-8' }
    );

    expect(output).toContain('Marked ingested: 1');
    const { data } = matter(readFileSync(sourcePath, 'utf-8'));
    expect(data.ingested).toBeTruthy();
    expect(data.ingest_hash).toBeTruthy();
    expect(data.wiki_pages).toEqual(['wiki/events/q1-results.md', 'wiki/financials.md']);

    const pending = execSync(`node ${CLI} sources pending`, {
      cwd: testDir,
      encoding: 'utf-8',
    });
    expect(pending).toContain('No pending sources.');
    expect(existsSync(join(testDir, 'dossier'))).toBe(false);
  });
});
