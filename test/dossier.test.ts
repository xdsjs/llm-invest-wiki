import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildDisclosureDir,
  buildMaterialFilename,
  loadDossierManifest,
  makeIdentityKey,
  renderDossierMarkdown,
} from '../src/lib/dossier.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-dossier-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('dossier helpers', () => {
  it('should build disclosure paths from document type, year, and disclosure key', () => {
    expect(buildDisclosureDir('sources', {
      documentType: '8-k',
      published: '2026-02-01',
      disclosureKey: '2026-02-01-0000320193-8-k',
    })).toBe('sources/8-k/2026/2026-02-01-0000320193-8-k');
  });

  it('should build sequence-prefixed filenames', () => {
    expect(buildMaterialFilename(2, 'ex99-2-presentation')).toBe('02-ex99-2-presentation.md');
  });

  it('should create SEC identity keys from accession and primary document', () => {
    expect(makeIdentityKey({
      authority: 'sec',
      accessionNo: '0000320193-24-000123',
      primaryDocument: 'a10-k2024.htm',
      published: '2024-11-01',
    })).toBe('sec:0000320193-24-000123:a10-k2024.htm');
  });

  it('should create company identity keys from canonical url and published date', () => {
    expect(makeIdentityKey({
      authority: 'company',
      canonicalUrl: 'https://investor.example.com/q1-release.pdf',
      published: '2026-02-01',
    })).toBe('company:https://investor.example.com/q1-release.pdf:2026-02-01');
  });

  it('should render dossier markdown with required frontmatter', () => {
    const md = renderDossierMarkdown({
      title: 'Apple Q1 Release',
      source: 'https://example.com/q1.pdf',
      author: '[[apple.com]]',
      published: '2026-02-01',
      created: '2026-04-23',
      authority: 'company',
      documentType: 'earnings-release',
      disclosureKey: '2026-02-01-q1-results',
      body: '# Apple Q1 Release',
    });

    expect(md).toContain("title: 'Apple Q1 Release'");
    expect(md).toContain("author: '[[apple.com]]'");
    expect(md).toContain("document_type: 'earnings-release'");
    expect(md).toContain('# Apple Q1 Release');
  });

  it('should load a dossier manifest from json', () => {
    const manifestPath = join(testDir, 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify({
      company: {
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        cik: '0000320193',
      },
      generatedAt: '2026-04-23T10:00:00Z',
      materials: [{
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        authority: 'company',
        title: 'Apple Q1 Release',
        source: 'https://investor.apple.com/q1-release.pdf',
        canonicalUrl: 'https://investor.apple.com/q1-release.pdf',
        author: '[[apple.com]]',
        published: '2026-02-01',
        documentType: 'earnings-release',
        disclosureKey: '2026-02-01-q1-results',
        sequence: 0,
        suggestedFilename: 'primary-q1-release',
      }],
    }, null, 2));

    const manifest = loadDossierManifest(manifestPath);

    expect(manifest.company.companyName).toBe('Apple Inc.');
    expect(manifest.materials).toHaveLength(1);
    expect(manifest.materials[0].title).toBe('Apple Q1 Release');
    expect(readFileSync(manifestPath, 'utf-8')).toContain('"generatedAt"');
  });
});
