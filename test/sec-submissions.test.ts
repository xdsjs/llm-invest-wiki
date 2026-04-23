import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSecSubmissionsByCik,
  parseFormsOption,
  secHeaders,
  summarizeRecentSubmissions,
  zeroPadCik,
} from '../src/lib/sec-submissions.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sec submissions helpers', () => {
  it('should zero-pad CIK values', () => {
    expect(zeroPadCik('320193')).toBe('0000320193');
    expect(zeroPadCik('0000320193')).toBe('0000320193');
    expect(zeroPadCik('CIK 320193')).toBe('0000320193');
  });

  it('should parse comma-separated form filters', () => {
    expect(parseFormsOption('10-K, 10-Q,8-K')).toEqual(['10-K', '10-Q', '8-K']);
    expect(parseFormsOption(undefined)).toEqual([]);
  });

  it('should summarize recent filings and apply form filters', () => {
    const summary = summarizeRecentSubmissions({
      cik: '320193',
      name: 'Apple Inc.',
      tickers: ['AAPL'],
      exchanges: ['Nasdaq'],
      filings: {
        recent: {
          filingDate: ['2026-01-30', '2026-01-29'],
          form: ['10-Q', '8-K'],
          accessionNumber: ['0000320193-26-000006', '0000320193-26-000005'],
          primaryDocument: ['aapl-20251227.htm', 'aapl-20260129.htm'],
        },
      },
    }, ['10-Q']);

    expect(summary).toEqual({
      cik: '0000320193',
      name: 'Apple Inc.',
      ticker: 'AAPL',
      exchange: 'Nasdaq',
      recent: [{
        filingDate: '2026-01-30',
        form: '10-Q',
        accessionNumber: '0000320193-26-000006',
        primaryDocument: 'aapl-20251227.htm',
      }],
    });
  });

  it('should fetch SEC submissions by CIK with SEC headers', async () => {
    const payload = { cik: '320193', name: 'Apple Inc.' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    await expect(fetchSecSubmissionsByCik('320193')).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://data.sec.gov/submissions/CIK0000320193.json',
      { headers: secHeaders() }
    );
  });

  it('should throw when SEC submissions fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain' },
    })) as typeof fetch);

    await expect(fetchSecSubmissionsByCik('320193')).rejects.toThrow('fetch failed: 403');
  });
});
