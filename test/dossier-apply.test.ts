import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyManifest } from '../src/lib/dossier-apply.js';
import { installMockMarkitdown } from './helpers/mock-markitdown.js';

let testDir: string;
let markitdownBin: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-apply-${Date.now()}`);
  mkdirSync(join(testDir, 'dossier'), { recursive: true });
  mkdirSync(join(testDir, '.llm-wiki-invest'), { recursive: true });
  markitdownBin = installMockMarkitdown(join(testDir, 'bin'));
  process.env.LLM_WIKI_MARKITDOWN_BIN = markitdownBin;
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  delete process.env.LLM_WIKI_MARKITDOWN_BIN;
  vi.restoreAllMocks();
});

describe('applyManifest', () => {
  it('should materialize a reviewed manifest into a disclosure directory', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('# Q1 Results', {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })) as typeof fetch);

    const result = await applyManifest(testDir, {
      company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
      generatedAt: '2026-04-23T10:00:00Z',
      materials: [{
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        authority: 'company',
        title: 'Apple Q1 Results Release',
        source: 'https://investor.apple.com/q1-release.md',
        canonicalUrl: 'https://investor.apple.com/q1-release.md',
        author: '[[apple.com]]',
        published: '2026-02-01',
        documentType: 'earnings-release',
        disclosureKey: '2026-02-01-q1-results',
        sequence: 0,
        suggestedFilename: 'primary-q1-release',
        contentType: 'text/markdown',
      }],
    });

    const out = join(
      testDir,
      'dossier/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md'
    );

    expect(result.created).toEqual([out]);
    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, 'utf-8')).toContain("author: '[[apple.com]]'");
  });

  it('should skip duplicate materials with the same identity key and unchanged content', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('# Same body', {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })) as typeof fetch);

    const manifest = {
      company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
      generatedAt: '2026-04-23T10:00:00Z',
      materials: [{
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        authority: 'company',
        title: 'Apple Q1 Results Release',
        source: 'https://investor.apple.com/q1-release.md',
        canonicalUrl: 'https://investor.apple.com/q1-release.md',
        author: '[[apple.com]]',
        published: '2026-02-01',
        documentType: 'earnings-release',
        disclosureKey: '2026-02-01-q1-results',
        sequence: 0,
        suggestedFilename: 'primary-q1-release',
        contentType: 'text/markdown',
      }],
    };

    await applyManifest(testDir, manifest);
    const second = await applyManifest(testDir, manifest);

    expect(second.created).toEqual([]);
    expect(second.skippedDuplicates).toEqual([
      'company:https://investor.apple.com/q1-release.md:2026-02-01',
    ]);
  });

  it('should write unresolved records for unsupported content types', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'application/vnd.ms-powerpoint' },
    })) as typeof fetch);

    const result = await applyManifest(testDir, {
      company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
      generatedAt: '2026-04-23T10:00:00Z',
      materials: [{
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        authority: 'company',
        title: 'Apple Q1 Results Deck',
        source: 'https://investor.apple.com/q1-results.ppt',
        canonicalUrl: 'https://investor.apple.com/q1-results.ppt',
        author: '[[apple.com]]',
        published: '2026-02-01',
        documentType: 'investor-presentation',
        disclosureKey: '2026-02-01-q1-results',
        sequence: 1,
        suggestedFilename: 'ex99-2-presentation',
        contentType: 'application/vnd.ms-powerpoint',
      }],
    });

    const unresolved = join(
      testDir,
      '.llm-wiki-invest/dossier-unresolved/2026-02-01-q1-results-investor-presentation-1.json'
    );

    expect(result.unresolved).toEqual([unresolved]);
    expect(existsSync(unresolved)).toBe(true);
    expect(readFileSync(unresolved, 'utf-8')).toContain('unsupported content-type');
  });

  it('should group same-type materials under one disclosure directory and split different types', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => new Response(`# ${String(url)}`, {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })) as typeof fetch);

    const result = await applyManifest(testDir, {
      company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
      generatedAt: '2026-04-23T10:00:00Z',
      materials: [
        {
          companyName: 'Apple Inc.',
          ticker: 'AAPL',
          market: 'us',
          authority: 'sec',
          title: 'Apple 8-K',
          source: 'https://sec.example.com/a8k.htm',
          canonicalUrl: 'https://sec.example.com/a8k.htm',
          author: '[[sec.gov]]',
          published: '2026-02-01',
          documentType: '8-k',
          disclosureKey: '2026-02-01-q1-results',
          sequence: 0,
          suggestedFilename: 'primary-8-k',
          accessionNo: '0000320193-26-000005',
          primaryDocument: 'a8k.htm',
          contentType: 'text/html',
        },
        {
          companyName: 'Apple Inc.',
          ticker: 'AAPL',
          market: 'us',
          authority: 'company',
          title: 'Apple Q1 Release',
          source: 'https://apple.example.com/q1-release.html',
          canonicalUrl: 'https://apple.example.com/q1-release.html',
          author: '[[apple.com]]',
          published: '2026-02-01',
          documentType: 'earnings-release',
          disclosureKey: '2026-02-01-q1-results',
          sequence: 0,
          suggestedFilename: 'primary-q1-release',
          contentType: 'text/html',
        },
        {
          companyName: 'Apple Inc.',
          ticker: 'AAPL',
          market: 'us',
          authority: 'company',
          title: 'Apple Q1 Statements',
          source: 'https://apple.example.com/q1-statements.pdf',
          canonicalUrl: 'https://apple.example.com/q1-statements.pdf',
          author: '[[apple.com]]',
          published: '2026-02-01',
          documentType: 'earnings-release',
          disclosureKey: '2026-02-01-q1-results',
          sequence: 1,
          suggestedFilename: 'q1-statements',
          contentType: 'application/pdf',
        },
      ],
    });

    expect(result.created).toContain(
      join(testDir, 'dossier/8-k/2026/2026-02-01-q1-results/00-primary-8-k.md')
    );
    expect(result.created).toContain(
      join(testDir, 'dossier/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md')
    );
    expect(result.created).toContain(
      join(testDir, 'dossier/earnings-release/2026/2026-02-01-q1-results/01-q1-statements.md')
    );
  });

  it('should write unresolved records when sequence is reused within the same disclosure directory', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('# Same disclosure', {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })) as typeof fetch);

    const result = await applyManifest(testDir, {
      company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
      generatedAt: '2026-04-24T10:00:00Z',
      materials: [
        {
          companyName: 'Apple Inc.',
          ticker: 'AAPL',
          market: 'us',
          authority: 'company',
          title: 'Apple Q1 Release',
          source: 'https://apple.example.com/q1-release.html',
          canonicalUrl: 'https://apple.example.com/q1-release.html',
          author: '[[apple.com]]',
          published: '2026-02-01',
          documentType: 'earnings-release',
          disclosureKey: '2026-02-01-q1-results',
          sequence: 0,
          suggestedFilename: 'primary-release',
          contentType: 'text/html',
        },
        {
          companyName: 'Apple Inc.',
          ticker: 'AAPL',
          market: 'us',
          authority: 'sec',
          title: 'Apple Q1 Release Exhibit',
          source: 'https://sec.example.com/ex99-1.htm',
          canonicalUrl: 'https://sec.example.com/ex99-1.htm',
          author: '[[sec.gov]]',
          published: '2026-02-01',
          documentType: 'earnings-release',
          disclosureKey: '2026-02-01-q1-results',
          sequence: 0,
          suggestedFilename: 'ex99-1-release',
          accessionNo: '0000320193-26-000005',
          primaryDocument: 'ex99-1.htm',
          contentType: 'text/html',
        },
      ],
    });

    expect(result.created).toEqual([
      join(testDir, 'dossier/earnings-release/2026/2026-02-01-q1-results/00-primary-release.md'),
    ]);
    expect(result.unresolved).toEqual([
      join(testDir, '.llm-wiki-invest/dossier-unresolved/2026-02-01-q1-results-earnings-release-0.json'),
    ]);
    expect(readFileSync(result.unresolved[0], 'utf-8')).toContain('duplicate sequence 0');
  });
});
