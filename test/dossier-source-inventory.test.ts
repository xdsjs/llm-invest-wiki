import { describe, expect, it } from 'vitest';
import { buildSourceInventory } from '../src/lib/dossier-source-inventory.js';
import type { DossierSourceExpectation } from '../src/lib/dossier.js';

const expectations: DossierSourceExpectation[] = [
  {
    expectationId: 'sec.latest-10-k',
    label: 'Latest annual report on Form 10-K',
    required: true,
    authority: 'sec',
    documentType: '10-k',
    asOf: '2026-05-07',
    period: 'latest-fiscal-year',
    selectionRule: 'latest annual report on Form 10-K',
    manualSupplementAllowed: true,
    match: { authorities: ['sec'], documentTypes: ['10-k'] },
  },
  {
    expectationId: 'company.latest-earnings-call-transcript',
    label: 'Latest earnings call transcript',
    required: true,
    authority: 'company',
    documentType: 'earnings-call-transcript',
    asOf: '2026-05-07',
    period: 'latest-earnings-event',
    selectionRule: 'latest earnings call transcript',
    manualSupplementAllowed: true,
    match: { authorities: ['company'], documentTypes: ['earnings-call-transcript'] },
  },
  {
    expectationId: 'company.latest-ir-presentation',
    label: 'Latest investor presentation',
    required: false,
    authority: 'company',
    documentType: 'investor-presentation',
    asOf: '2026-05-07',
    period: 'latest-investor-update',
    selectionRule: 'latest investor presentation',
    manualSupplementAllowed: true,
    match: { authorities: ['company'], documentTypes: ['investor-presentation'] },
  },
];

describe('source inventory builder', () => {
  it('marks found sources with source id, hash, dates, and materialized path', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations,
      outcomes: [
        {
          status: 'found',
          sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
          contentHash: 'sha256:5f2c7a4b9d8e1a30',
          outputPath: '/vault/sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
          material: {
            authority: 'sec',
            documentType: '10-k',
            published: '2024-11-01',
            accessionNo: '0000320193-25-000008',
            primaryDocument: 'aapl-20240928.htm',
          },
        },
      ],
    });

    expect(inventory[0]).toMatchObject({
      expectationId: 'sec.latest-10-k',
      status: 'found',
      sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
      contentHash: 'sha256:5f2c7a4b9d8e1a30',
      filingDate: '2024-11-01',
      sourceDate: '2024-11-01',
      materializedPath: 'sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
    });
  });

  it('marks required unmatched expectations as missing', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations,
      outcomes: [],
    });

    expect(inventory[0]).toMatchObject({
      expectationId: 'sec.latest-10-k',
      required: true,
      status: 'missing',
      errorCode: 'source_missing',
      reason: 'Latest annual report on Form 10-K was not found',
    });
    expect(inventory[2]).toMatchObject({
      expectationId: 'company.latest-ir-presentation',
      required: false,
      status: 'missing',
      errorCode: 'source_missing',
    });
  });

  it('marks failed materialization with stable error code and display reason', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations,
      outcomes: [
        {
          status: 'failed',
          errorCode: 'source_materialize_failed',
          error: 'unsupported content-type: application/vnd.ms-powerpoint',
          material: {
            authority: 'company',
            documentType: 'earnings-call-transcript',
            published: '2026-02-01',
          },
        },
      ],
    });

    expect(inventory[1]).toMatchObject({
      expectationId: 'company.latest-earnings-call-transcript',
      status: 'failed',
      errorCode: 'source_materialize_failed',
      reason: 'unsupported content-type: application/vnd.ms-powerpoint',
    });
  });

  it('keeps not-applicable expectations separate from missing sources', () => {
    const inventory = buildSourceInventory({
      root: '/vault',
      expectations: [{
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'latest earnings call transcript',
        manualSupplementAllowed: true,
        match: { authorities: ['company'], documentTypes: ['earnings-call-transcript'] },
        notApplicable: {
          errorCode: 'source_not_applicable',
          reason: 'Company did not host an earnings call for this period',
        },
      }],
      outcomes: [],
    });

    expect(inventory).toEqual([
      {
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        asOf: '2026-05-07',
        period: 'latest-earnings-event',
        selectionRule: 'latest earnings call transcript',
        manualSupplementAllowed: true,
        status: 'not_applicable',
        errorCode: 'source_not_applicable',
        reason: 'Company did not host an earnings call for this period',
      },
    ]);
  });
});
