import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditDossier, summarizeDossier } from '../src/lib/dossier-audit.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-dossier-audit-${Date.now()}`);
  mkdirSync(join(testDir, 'dossier'), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('dossier audit', () => {
  it('should summarize dossier counts by authority and document type', () => {
    mkdirSync(join(testDir, 'dossier/10-k/2024/disclosure-a'), { recursive: true });
    writeFileSync(join(testDir, 'dossier/10-k/2024/disclosure-a/00-primary-10-k.md'), `---
title: Apple 10-K
source: https://sec.gov/10-k
author: '[[sec.gov]]'
published: '2024-11-01'
created: '2026-04-23'
authority: 'sec'
document_type: '10-k'
disclosure_key: 'disclosure-a'
---

# body
`);

    const summary = summarizeDossier(join(testDir, 'dossier'));

    expect(summary.materialCount).toBe(1);
    expect(summary.disclosureCount).toBe(1);
    expect(summary.byAuthority.sec).toBe(1);
    expect(summary.byDocumentType['10-k']).toBe(1);
    expect(summary.latestPublished).toBe('2024-11-01');
  });

  it('should flag files with missing frontmatter', () => {
    mkdirSync(join(testDir, 'dossier/10-k/2024/disclosure-a'), { recursive: true });
    writeFileSync(
      join(testDir, 'dossier/10-k/2024/disclosure-a/00-primary-10-k.md'),
      '# no frontmatter'
    );

    const issues = auditDossier(join(testDir, 'dossier'));

    expect(issues.some(issue => issue.type === 'missing_frontmatter')).toBe(true);
  });

  it('should flag files with bad path layout', () => {
    writeFileSync(join(testDir, 'dossier/orphan.md'), `---
title: Orphan
source: https://example.com/orphan
author: '[[example.com]]'
published: '2026-04-23'
created: '2026-04-23'
authority: 'company'
document_type: 'other-official-filing'
disclosure_key: 'orphan'
---

# body
`);

    const issues = auditDossier(join(testDir, 'dossier'));

    expect(issues.some(issue => issue.type === 'bad_path_layout')).toBe(true);
  });
});
