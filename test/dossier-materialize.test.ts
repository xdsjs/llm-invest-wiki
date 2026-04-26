import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { materializeSource } from '../src/lib/dossier-materialize.js';
import { installMockMarkitdown } from './helpers/mock-markitdown.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-materialize-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  process.env.LLM_WIKI_MARKITDOWN_BIN = installMockMarkitdown(join(testDir, 'bin'));
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
  delete process.env.LLM_WIKI_MARKITDOWN_BIN;
  vi.restoreAllMocks();
});

describe('materializeSource', () => {
  it('should clean SEC inline XBRL HTML before MarkItDown conversion', async () => {
    const html = `<!doctype html>
<html>
  <head><title>Apple 10-K</title></head>
  <body>
    <ix:header>
      <ix:hidden>2022FY context metadata noise</ix:hidden>
    </ix:header>
    <main>
      <p>UNITED STATES</p>
      <p>Item 1. Business</p>
      <table>
        <tr><td>Net sales</td><td><ix:nonfraction name="aapl:NetSales">394,328</ix:nonfraction></td></tr>
      </table>
      <p>SIGNATURES</p>
    </main>
  </body>
</html>`;

    vi.stubGlobal('fetch', vi.fn(async () => new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    })) as typeof fetch);

    const result = await materializeSource({
      companyName: 'Apple Inc.',
      ticker: 'AAPL',
      market: 'us',
      authority: 'sec',
      title: 'Apple 10-K',
      source: 'https://www.sec.gov/Archives/edgar/data/320193/000032019322000108/aapl-20220924.htm',
      canonicalUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019322000108/aapl-20220924.htm',
      author: '[[sec.gov]]',
      published: '2022-10-28',
      documentType: '10-k',
      disclosureKey: '2022-10-28-10-k',
      sequence: 0,
      suggestedFilename: 'primary-10-k',
      accessionNo: '0000320193-22-000108',
      primaryDocument: 'aapl-20220924.htm',
      contentType: 'text/html',
    });

    expect(result.materializer).toBe('defuddle-markitdown');
    expect(result.body).toContain('# Mock MarkItDown');
    expect(result.body).toContain('UNITED STATES');
    expect(result.body).toContain('394,328');
    expect(result.body).not.toContain('ix:');
    expect(result.body).not.toContain('context metadata noise');
  });
});
