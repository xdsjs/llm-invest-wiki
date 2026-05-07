import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyManifest } from '../src/lib/dossier-apply.js';
import { COVERAGE_CONTRACT_SCHEMA_VERSION } from '../src/lib/dossier-contract.js';
import { installMockMarkitdown } from './helpers/mock-markitdown.js';

let testDir: string;
let markitdownBin: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-apply-${Date.now()}`);
  mkdirSync(join(testDir, 'sources'), { recursive: true });
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
      'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md'
    );

    expect(result.created).toEqual([out]);
    expect(result.materialized).toEqual([{ path: out, materializer: 'markitdown' }]);
    expect(existsSync(out)).toBe(true);
    const source = readFileSync(out, 'utf-8');
    expect(source).toContain("author: '[[apple.com]]'");
    expect(source).toContain("materializer: 'markitdown'");

    const state = JSON.parse(readFileSync(join(testDir, '.llm-wiki-invest/dossier-state.json'), 'utf-8')) as {
      materials: Record<string, {
        outputPath: string;
        contentHash: string;
        authority: string;
        documentType: string;
        disclosureKey: string;
        published: string;
        canonicalUrl: string;
        materializer: string;
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
    const identityKey = 'company:https://investor.apple.com/q1-release.md:2026-02-01';
    expect(state.materials[identityKey]).toMatchObject({
      outputPath: out,
      authority: 'company',
      documentType: 'earnings-release',
      disclosureKey: '2026-02-01-q1-results',
      published: '2026-02-01',
      canonicalUrl: 'https://investor.apple.com/q1-release.md',
      materializer: 'markitdown',
    });
    expect(state.materials[identityKey].contentHash).toMatch(/^[a-f0-9]{16}$/);
    expect(state.materials[identityKey].firstSeenAt).toBeTruthy();
    expect(state.materials[identityKey].lastSeenAt).toBeTruthy();
    expect(state.checkpoints.company?.latestPublished).toBe('2026-02-01');
    expect(state.checkpoints.company?.latestPublishedByDocumentType['earnings-release']).toBe('2026-02-01');
    expect(state.checkpoints.company?.latestIdentityByDocumentType['earnings-release']).toBe(identityKey);
  });

  it('should write a dossier run record while promoting materials into sources', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('# Q1 Results', {
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
        authority: 'company' as const,
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
    const result = await applyManifest(testDir, manifest, { runId: '2026-04-25-aapl' });
    const runDir = join(testDir, '.llm-wiki-invest/dossier-runs/2026-04-25-aapl');

    expect(result.runDir).toBe(runDir);
    expect(existsSync(join(runDir, 'manifest.json'))).toBe(true);
    expect(readFileSync(join(runDir, 'manifest.json'), 'utf-8')).toContain('Apple Q1 Results Release');
    expect(existsSync(join(runDir, 'report.md'))).toBe(false);

    const resultJson = JSON.parse(readFileSync(join(runDir, 'result.json'), 'utf-8')) as {
      runId: string;
      created: string[];
      materialized: Array<{ path: string; materializer: string }>;
      skippedDuplicates: string[];
      unresolved: string[];
    };
    expect(resultJson.runId).toBe('2026-04-25-aapl');
    expect(resultJson.created).toEqual([
      'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md',
    ]);
    expect(resultJson.materialized).toEqual([
      {
        path: 'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md',
        materializer: 'markitdown',
      },
    ]);
    expect(resultJson.skippedDuplicates).toEqual([]);
    expect(resultJson.unresolved).toEqual([]);
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

    const runUnresolved = join(
      result.runDir,
      'unresolved/2026-02-01-q1-results-investor-presentation-1.json'
    );
    expect(existsSync(runUnresolved)).toBe(true);
    expect(readFileSync(runUnresolved, 'utf-8')).toContain('unsupported content-type');

    const resultJson = JSON.parse(readFileSync(join(result.runDir, 'result.json'), 'utf-8')) as {
      created: string[];
      unresolved: string[];
    };
    expect(resultJson.created).toEqual([]);
    expect(resultJson.unresolved).toEqual([
      '.llm-wiki-invest/dossier-unresolved/2026-02-01-q1-results-investor-presentation-1.json',
    ]);
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
      join(testDir, 'sources/8-k/2026/2026-02-01-q1-results/00-primary-8-k.md')
    );
    expect(result.created).toContain(
      join(testDir, 'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-q1-release.md')
    );
    expect(result.created).toContain(
      join(testDir, 'sources/earnings-release/2026/2026-02-01-q1-results/01-q1-statements.md')
    );

    const state = JSON.parse(readFileSync(join(testDir, '.llm-wiki-invest/dossier-state.json'), 'utf-8')) as {
      checkpoints: {
        sec?: {
          latestPublished: string;
          latestSecFilingDate: string;
          latestSecFilingDateByDocumentType: Record<string, string>;
          latestSecAccessionNoByDocumentType: Record<string, string>;
        };
      };
    };
    expect(state.checkpoints.sec?.latestPublished).toBe('2026-02-01');
    expect(state.checkpoints.sec?.latestSecFilingDate).toBe('2026-02-01');
    expect(state.checkpoints.sec?.latestSecFilingDateByDocumentType['8-k']).toBe('2026-02-01');
    expect(state.checkpoints.sec?.latestSecAccessionNoByDocumentType['8-k']).toBe('0000320193-26-000005');
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
      join(testDir, 'sources/earnings-release/2026/2026-02-01-q1-results/00-primary-release.md'),
    ]);
    expect(result.unresolved).toEqual([
      join(testDir, '.llm-wiki-invest/dossier-unresolved/2026-02-01-q1-results-earnings-release-0.json'),
    ]);
    expect(readFileSync(result.unresolved[0], 'utf-8')).toContain('duplicate sequence 0');
  });

  it('should write a coverage contract bundle as the run completion entrypoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('# 10-K', {
      status: 200,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    })) as typeof fetch);

    const result = await applyManifest(testDir, {
      schemaVersion: 'coverage-contract/v0',
      preset: { id: 'us-listed-company', version: 'coverage-contract/v0' },
      company: {
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
      generatedAt: '2026-05-07T02:00:00Z',
      expectations: [{
        expectationId: 'sec.latest-10-k',
        label: 'Latest annual report on Form 10-K',
        required: true,
        authority: 'sec',
        documentType: '10-k',
        asOf: '2026-05-07',
        period: 'latest-fiscal-year',
        selectionRule: 'latest annual report on Form 10-K for AAPL',
        manualSupplementAllowed: true,
        match: { authorities: ['sec'], documentTypes: ['10-k'] },
      }],
      materials: [{
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        authority: 'sec',
        title: 'Apple 10-K',
        source: 'https://sec.example.com/aapl-10k.htm',
        canonicalUrl: 'https://sec.example.com/aapl-10k.htm',
        author: '[[sec.gov]]',
        published: '2024-11-01',
        documentType: '10-k',
        disclosureKey: '2024-11-01-aapl-10-k',
        sequence: 0,
        suggestedFilename: 'primary-10-k',
        accessionNo: '0000320193-25-000008',
        primaryDocument: 'aapl-20240928.htm',
        contentType: 'text/html',
      }],
    }, { runId: '2026-05-07-aapl' });

    expect(result.bundlePath).toBe(join(result.runDir, 'bundle.json'));
    expect(existsSync(join(result.runDir, 'manifest.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'source_inventory.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'quality_report.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'result.json'))).toBe(true);
    expect(existsSync(join(result.runDir, 'bundle.json'))).toBe(true);

    const bundle = JSON.parse(readFileSync(join(result.runDir, 'bundle.json'), 'utf-8')) as {
      schemaVersion: string;
      files: Record<string, string>;
    };
    expect(bundle.schemaVersion).toBe('coverage-contract/v0');
    expect(bundle.files).toEqual({
      manifest: 'manifest.json',
      sourceInventory: 'source_inventory.json',
      qualityReport: 'quality_report.json',
      result: 'result.json',
    });

    const qualityReport = JSON.parse(readFileSync(join(result.runDir, 'quality_report.json'), 'utf-8')) as {
      commercialReportAllowed: boolean;
      blockingReasons: unknown[];
    };
    expect(qualityReport.commercialReportAllowed).toBe(true);
    expect(qualityReport.blockingReasons).toEqual([]);

    const sourceInventory = JSON.parse(readFileSync(join(result.runDir, 'source_inventory.json'), 'utf-8')) as {
      schemaVersion: string;
      runId: string;
      preset: { id: string; version: string };
      items: Array<{
        expectationId: string;
        status: string;
        contentHash: string;
        materializedPath: string;
      }>;
    };
    expect(sourceInventory.schemaVersion).toBe(COVERAGE_CONTRACT_SCHEMA_VERSION);
    expect(sourceInventory.runId).toBe('2026-05-07-aapl');
    expect(sourceInventory.preset).toEqual({ id: 'us-listed-company', version: COVERAGE_CONTRACT_SCHEMA_VERSION });
    expect(sourceInventory.items[0]).toMatchObject({
      expectationId: 'sec.latest-10-k',
      status: 'found',
      materializedPath: 'sources/10-k/2024/2024-11-01-aapl-10-k/00-primary-10-k.md',
    });
    expect(sourceInventory.items[0]?.contentHash).toMatch(/^sha256:[a-f0-9]{16}$/);
  });

  it('should keep failed coverage runs consumable when a required source is missing', async () => {
    const result = await applyManifest(testDir, {
      schemaVersion: 'coverage-contract/v0',
      preset: { id: 'us-listed-company', version: 'coverage-contract/v0' },
      company: { companyName: 'Apple Inc.', ticker: 'AAPL', market: 'us' },
      generatedAt: '2026-05-07T02:00:00Z',
      expectations: [{
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'latest earnings call transcript for AAPL',
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['earnings-call-transcript'] },
      }],
      materials: [],
    }, { runId: '2026-05-07-aapl-missing' });

    const qualityReport = JSON.parse(readFileSync(join(result.runDir, 'quality_report.json'), 'utf-8')) as {
      commercialReportAllowed: boolean;
      blockingReasons: Array<{ code: string; expectationId: string }>;
    };
    expect(result.commercialReportAllowed).toBe(false);
    expect(qualityReport.commercialReportAllowed).toBe(false);
    expect(qualityReport.blockingReasons).toEqual([
      {
        code: 'missing_required_source',
        message: 'Latest earnings call transcript was not found',
        expectationId: 'company.latest-earnings-call-transcript',
      },
    ]);
    expect(existsSync(join(result.runDir, 'bundle.json'))).toBe(true);
  });
});
