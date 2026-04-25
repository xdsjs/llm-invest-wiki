import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import matter from 'gray-matter';
import {
  listPendingSourceGroups,
  listPendingSourceGroupsForPath,
  markSourcesIngested,
  sourceContentHash,
} from '../src/lib/source-ingest.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-source-ingest-${Date.now()}`);
  mkdirSync(join(testDir, 'sources/earnings-release/2026/q1-results'), { recursive: true });
  mkdirSync(join(testDir, '.llm-wiki-invest'), { recursive: true });
  writeFileSync(join(testDir, '.llm-wiki-invest/config.toml'), '[vault]\nname = "Test"\nlanguage = "zh"\n');
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('source ingest helpers', () => {
  it('should ignore ingest tracking fields when computing source hash', () => {
    const sourcePath = join(testDir, 'sources/earnings-release/2026/q1-results/00-release.md');
    writeFileSync(sourcePath, `---
title: Release
source: https://example.com/release
authority: company
document_type: earnings-release
disclosure_key: q1-results
---

# body
`);

    const before = sourceContentHash(sourcePath);
    writeFileSync(sourcePath, `---
title: Release
source: https://example.com/release
authority: company
document_type: earnings-release
disclosure_key: q1-results
ingested: 2026-04-25
ingest_hash: older
wiki_pages:
  - wiki/events/q1-results.md
---

# body
`);

    expect(sourceContentHash(sourcePath)).toBe(before);
  });

  it('should list new sources and mark them as clean after ingest', () => {
    const sourcePath = join(testDir, 'sources/earnings-release/2026/q1-results/00-release.md');
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

    const pending = listPendingSourceGroups(testDir);
    expect(pending).toHaveLength(1);
    expect(pending[0].sources[0].status).toBe('new');

    markSourcesIngested(testDir, ['sources/earnings-release/2026/q1-results/00-release.md'], [
      'wiki/events/q1-results.md',
    ]);

    const raw = readFileSync(sourcePath, 'utf-8');
    const { data } = matter(raw);
    expect(data.ingested).toBeTruthy();
    expect(data.ingest_hash).toBe(sourceContentHash(sourcePath));
    expect(data.wiki_pages).toEqual(['wiki/events/q1-results.md']);
    expect(listPendingSourceGroups(testDir)).toEqual([]);
  });

  it('should derive pending candidates from a dossier run result', () => {
    const releasePath = join(testDir, 'sources/earnings-release/2026/q1-results/00-release.md');
    const otherDir = join(testDir, 'sources/10-q/2026/q1-10-q');
    const otherPath = join(otherDir, '00-10-q.md');
    const runDir = join(testDir, '.llm-wiki-invest/dossier-runs/run-a');
    mkdirSync(otherDir, { recursive: true });
    mkdirSync(runDir, { recursive: true });
    writeFileSync(releasePath, `---
title: Release
source: https://example.com/release
authority: company
document_type: earnings-release
disclosure_key: q1-results
published: 2026-02-01
---

# body
`);
    writeFileSync(otherPath, `---
title: 10-Q
source: https://example.com/10-q
authority: sec
document_type: 10-q
disclosure_key: q1-10-q
published: 2026-02-02
---

# body
`);
    writeFileSync(join(runDir, 'result.json'), JSON.stringify({
      created: ['sources/10-q/2026/q1-10-q/00-10-q.md'],
      skippedDuplicates: [],
      unresolved: [],
    }, null, 2));

    const pending = listPendingSourceGroupsForPath(testDir, '.llm-wiki-invest/dossier-runs/run-a');

    expect(pending).toHaveLength(1);
    expect(pending[0].sources).toHaveLength(1);
    expect(pending[0].sources[0].path).toBe('sources/10-q/2026/q1-10-q/00-10-q.md');
  });
});
