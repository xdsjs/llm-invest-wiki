import { describe, expect, it } from 'vitest';
import {
  buildCoverageBundle,
  buildQualityReport,
  COVERAGE_CONTRACT_SCHEMA_VERSION,
} from '../src/lib/dossier-contract.js';
import type { SourceInventoryItem } from '../src/lib/dossier-contract.js';

const preset = {
  id: 'us-listed-company',
  version: COVERAGE_CONTRACT_SCHEMA_VERSION,
};

function item(
  input: Partial<SourceInventoryItem> &
    Pick<SourceInventoryItem, 'expectationId' | 'required' | 'status'>
): SourceInventoryItem {
  return {
    expectationId: input.expectationId,
    label: input.label ?? input.expectationId,
    required: input.required,
    authority: input.authority ?? 'sec',
    documentType: input.documentType ?? '10-k',
    asOf: input.asOf ?? '2026-05-07',
    period: input.period ?? 'latest-fiscal-year',
    selectionRule: input.selectionRule ?? 'test selection rule',
    status: input.status,
    manualSupplementAllowed: input.manualSupplementAllowed ?? true,
    sourceId: input.sourceId,
    contentHash: input.contentHash,
    materializedPath: input.materializedPath,
    sourceDate: input.sourceDate,
    filingDate: input.filingDate,
    errorCode: input.errorCode,
    reason: input.reason,
    message: input.message,
  };
}

describe('coverage contract v0', () => {
  it('blocks commercial reports when a required source is missing', () => {
    const report = buildQualityReport({
      runId: '2026-05-07-aapl',
      preset,
      inventory: [
        item({
          expectationId: 'sec.latest-10-k',
          required: true,
          status: 'found',
          sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
          contentHash: 'sha256:5f2c7a4b9d8e1a30',
          materializedPath: 'sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
        }),
        item({
          expectationId: 'company.latest-earnings-call',
          required: true,
          authority: 'company',
          documentType: 'earnings-call-transcript',
          period: 'latest-earnings-event',
          status: 'missing',
          errorCode: 'source_missing',
          reason: 'No earnings call transcript was found',
        }),
        item({
          expectationId: 'company.latest-ir-presentation',
          required: false,
          authority: 'company',
          documentType: 'investor-presentation',
          status: 'missing',
          errorCode: 'source_missing',
          reason: 'No investor presentation was found',
        }),
      ],
    });

    expect(report.schemaVersion).toBe(COVERAGE_CONTRACT_SCHEMA_VERSION);
    expect(report.commercialReportAllowed).toBe(false);
    expect(report.summary).toEqual({
      requiredTotal: 2,
      requiredFound: 1,
      requiredMissing: 1,
      requiredFailed: 0,
      optionalTotal: 1,
    });
    expect(report.blockingReasons).toEqual([
      {
        code: 'missing_required_source',
        message: 'No earnings call transcript was found',
        expectationId: 'company.latest-earnings-call',
      },
    ]);
  });

  it('allows commercial reports when only optional sources are missing', () => {
    const report = buildQualityReport({
      runId: '2026-05-07-aapl',
      preset,
      inventory: [
        item({
          expectationId: 'sec.latest-10-k',
          required: true,
          status: 'found',
          sourceId: 'sec:0000320193-25-000008:aapl-20240928.htm',
          contentHash: 'sha256:5f2c7a4b9d8e1a30',
          materializedPath: 'sources/10-k/2024/2024-11-01-aapl/00-primary-10-k.md',
        }),
        item({
          expectationId: 'company.latest-ir-presentation',
          required: false,
          authority: 'company',
          documentType: 'investor-presentation',
          status: 'missing',
          errorCode: 'source_missing',
          reason: 'No investor presentation was found',
        }),
      ],
    });

    expect(report.commercialReportAllowed).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.summary.optionalTotal).toBe(1);
  });

  it('does not treat required not-applicable sources as missing', () => {
    const report = buildQualityReport({
      runId: '2026-05-07-aapl',
      preset,
      inventory: [
        item({
          expectationId: 'company.latest-earnings-call-transcript',
          required: true,
          authority: 'company',
          documentType: 'earnings-call-transcript',
          period: 'latest-earnings-event',
          status: 'not_applicable',
          errorCode: 'source_not_applicable',
          reason: 'Company did not host an earnings call for this period',
        }),
      ],
    });

    expect(report.commercialReportAllowed).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.summary).toEqual({
      requiredTotal: 1,
      requiredFound: 0,
      requiredMissing: 0,
      requiredFailed: 0,
      optionalTotal: 0,
    });
  });

  it('marks blocking required sources as needing review when manual review is required', () => {
    const report = buildQualityReport({
      runId: '2026-05-07-aapl',
      preset,
      inventory: [
        item({
          expectationId: 'company.latest-earnings-call',
          required: true,
          authority: 'company',
          documentType: 'earnings-call-transcript',
          period: 'latest-earnings-event',
          status: 'missing',
          errorCode: 'manual_review_required',
          reason: 'Manual transcript review is required',
        }),
      ],
    });

    expect(report.commercialReportAllowed).toBe(false);
    expect(report.blockingReasons).toEqual([
      {
        code: 'required_source_needs_review',
        message: 'Manual transcript review is required',
        expectationId: 'company.latest-earnings-call',
      },
    ]);
  });

  it('builds bundle.json as the single completion entrypoint', () => {
    const bundle = buildCoverageBundle({
      runId: '2026-05-07-aapl',
      completedAt: '2026-05-07T02:00:20.000Z',
      company: {
        market: 'us',
        ticker: 'AAPL',
        companyName: 'Apple Inc.',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
      preset,
    });

    expect(bundle).toEqual({
      schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
      runId: '2026-05-07-aapl',
      completedAt: '2026-05-07T02:00:20.000Z',
      company: {
        market: 'us',
        ticker: 'AAPL',
        companyName: 'Apple Inc.',
        cik: '0000320193',
        exchange: 'NASDAQ',
      },
      preset,
      files: {
        manifest: 'manifest.json',
        sourceInventory: 'source_inventory.json',
        qualityReport: 'quality_report.json',
        result: 'result.json',
      },
    });
  });
});
