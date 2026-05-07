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
    expect(preset.expectations).toEqual([
      {
        expectationId: 'sec.latest-10-k',
        label: 'Latest annual report on Form 10-K',
        required: true,
        authority: 'sec',
        documentType: '10-k',
        asOf: '2026-05-07',
        period: 'latest-fiscal-year',
        selectionRule: 'Select Latest annual report on Form 10-K for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['sec'],
          documentTypes: ['10-k'],
        },
      },
      {
        expectationId: 'sec.latest-10-q',
        label: 'Latest quarterly report on Form 10-Q',
        required: true,
        authority: 'sec',
        documentType: '10-q',
        asOf: '2026-05-07',
        period: 'latest-quarter',
        selectionRule: 'Select Latest quarterly report on Form 10-Q for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['sec'],
          documentTypes: ['10-q'],
        },
      },
      {
        expectationId: 'sec.latest-proxy',
        label: 'Latest proxy statement',
        required: true,
        authority: 'sec',
        documentType: 'proxy-statement',
        asOf: '2026-05-07',
        period: 'latest-annual-meeting',
        selectionRule: 'Select Latest proxy statement for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['sec'],
          documentTypes: ['def-14a', 'proxy-statement'],
        },
      },
      {
        expectationId: 'sec.latest-earnings-8-k',
        label: 'Latest earnings-related Form 8-K',
        required: true,
        authority: 'sec',
        documentType: '8-k',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'Select Latest earnings-related Form 8-K for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['sec'],
          documentTypes: ['8-k'],
        },
      },
      {
        expectationId: 'company.latest-earnings-release',
        label: 'Latest earnings release',
        required: true,
        authority: 'company',
        documentType: 'earnings-release',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'Select Latest earnings release for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['company'],
          documentTypes: ['earnings-release'],
        },
      },
      {
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'Select Latest earnings call transcript for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['company'],
          documentTypes: ['earnings-call-transcript'],
        },
      },
      {
        expectationId: 'company.latest-ir-presentation',
        label: 'Latest investor presentation',
        required: false,
        authority: 'company',
        documentType: 'investor-presentation',
        asOf: '2026-05-07',
        period: 'latest-investor-update',
        selectionRule: 'Select Latest investor presentation for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['company'],
          documentTypes: ['investor-presentation'],
        },
      },
      {
        expectationId: 'company.latest-governance-documents',
        label: 'Latest company governance documents',
        required: false,
        authority: 'company',
        documentType: 'governance-document',
        asOf: '2026-05-07',
        period: 'current-governance',
        selectionRule: 'Select Latest company governance documents for AAPL as of 2026-05-07.',
        manualSupplementAllowed: true,
        match: {
          authorities: ['company'],
          documentTypes: ['governance-document'],
        },
      },
      {
        expectationId: 'exchange.latest-company-profile',
        label: 'Latest exchange company profile',
        required: false,
        authority: 'nasdaq',
        documentType: 'exchange-profile',
        asOf: '2026-05-07',
        period: 'current-profile',
        selectionRule: 'Select Latest exchange company profile for AAPL as of 2026-05-07.',
        manualSupplementAllowed: false,
        match: {
          authorities: ['nasdaq', 'nyse'],
          documentTypes: ['exchange-profile'],
        },
      },
    ]);
    expect(preset.expectations.filter((item) => item.required)).toHaveLength(6);
    expect(preset.expectations.filter((item) => !item.required)).toHaveLength(3);
  });

  it('uses nyse as the exchange profile authority for NYSE companies', () => {
    const preset = buildUsListedCompanyPreset({
      asOf: '2026-05-07',
      company: {
        companyName: 'International Business Machines Corporation',
        ticker: 'IBM',
        market: 'us',
        cik: '0000051143',
        exchange: 'NYSE',
      },
    });

    expect(
      preset.expectations.find((item) => item.expectationId === 'exchange.latest-company-profile')
    ).toMatchObject({
      authority: 'nyse',
    });
  });

  it.each([
    { exchange: undefined, expectedAuthority: 'nasdaq' },
    { exchange: 'New York Stock Exchange', expectedAuthority: 'nasdaq' },
    { exchange: 'nyse', expectedAuthority: 'nasdaq' },
  ])(
    'falls back to nasdaq exchange profile authority for $exchange',
    ({ exchange, expectedAuthority }) => {
      const preset = buildUsListedCompanyPreset({
        asOf: '2026-05-07',
        company: {
          companyName: 'Example Corporation',
          ticker: 'EXM',
          market: 'us',
          cik: '0000000000',
          exchange,
        },
      });

      expect(
        preset.expectations.find(
          (item) => item.expectationId === 'exchange.latest-company-profile'
        )
      ).toMatchObject({
        authority: expectedAuthority,
      });
    }
  );
});
