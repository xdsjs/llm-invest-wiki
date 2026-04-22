import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyManifest } from '../src/lib/dossier-apply.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-apply-${Date.now()}`);
  mkdirSync(join(testDir, 'dossier'), { recursive: true });
  mkdirSync(join(testDir, '.llm-wiki-invest'), { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
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
      'dossier/company/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md'
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
      '.llm-wiki-invest/dossier-unresolved/2026-02-01-q1-results-1.json'
    );

    expect(result.unresolved).toEqual([unresolved]);
    expect(existsSync(unresolved)).toBe(true);
    expect(readFileSync(unresolved, 'utf-8')).toContain('unsupported content-type');
  });
});
