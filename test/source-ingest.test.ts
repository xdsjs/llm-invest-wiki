import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  listPendingSourceGroups,
  listPendingSourceGroupsForPath,
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
  it('should list sources without ingested frontmatter as new', () => {
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

    const pending = listPendingSourceGroups(testDir);
    expect(pending).toHaveLength(1);
    expect(pending[0].sources[0].status).toBe('new');
  });

  it('should treat sources with ingested frontmatter as clean', () => {
    const sourcePath = join(testDir, 'sources/earnings-release/2026/q1-results/00-release.md');
    writeFileSync(sourcePath, `---
title: Release
source: https://example.com/release
authority: company
document_type: earnings-release
disclosure_key: q1-results
published: 2026-02-01
ingested: 2026-04-26
wiki_pages:
  - wiki/events/q1-results.md
---

# body
`);

    expect(listPendingSourceGroups(testDir)).toEqual([]);

    const clean = listPendingSourceGroups(testDir, true);
    expect(clean).toHaveLength(1);
    expect(clean[0].sources[0].status).toBe('clean');
    expect(clean[0].sources[0].wikiPages).toEqual(['wiki/events/q1-results.md']);
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
