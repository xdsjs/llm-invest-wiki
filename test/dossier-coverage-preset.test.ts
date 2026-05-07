import { describe, expect, it } from 'vitest';
import { COVERAGE_CONTRACT_SCHEMA_VERSION } from '../src/lib/dossier-contract.js';
import { buildUsListedCompanyPreset } from '../src/lib/dossier-coverage-preset.js';

describe('us-listed-company coverage preset', () => {
  it('emits versioned required and optional source expectations', () => {
    const preset = buildUsListedCompanyPreset({
      asOf: '2026-05-07',
      company: {
        companyName: 'Apple Inc.',
        ticker: 'AAPL',
        market: 'us',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
    });

    expect(preset.ref).toEqual({
      id: 'us-listed-company',
      version: COVERAGE_CONTRACT_SCHEMA_VERSION,
    });
    expect(preset.expectations.map((item) => item.expectationId)).toEqual([
      'sec.latest-10-k',
      'sec.latest-10-q',
      'sec.latest-proxy',
      'sec.latest-earnings-8-k',
      'company.latest-earnings-release',
      'company.latest-earnings-call-transcript',
      'company.latest-ir-presentation',
      'company.latest-governance-documents',
      'exchange.latest-company-profile',
    ]);
    expect(preset.expectations.filter((item) => item.required)).toHaveLength(6);
    expect(preset.expectations.filter((item) => !item.required)).toHaveLength(3);
    expect(preset.expectations[0]).toMatchObject({
      label: 'Latest annual report on Form 10-K',
      authority: 'sec',
      documentType: '10-k',
      asOf: '2026-05-07',
      period: 'latest-fiscal-year',
      manualSupplementAllowed: true,
      match: {
        authorities: ['sec'],
        documentTypes: ['10-k'],
      },
    });
    expect(preset.expectations[5]).toMatchObject({
      expectationId: 'company.latest-earnings-call-transcript',
      period: 'latest-earnings-event',
      match: {
        authorities: ['company'],
        documentTypes: ['earnings-call-transcript'],
      },
    });
  });
});
