import type {
  DossierAuthority,
  DossierContractErrorCode,
  DossierManifestCompany,
  DossierPresetRef,
  DossierSourceStatus,
} from './dossier.js';

export const COVERAGE_CONTRACT_SCHEMA_VERSION = 'coverage-contract/v0';

export type SourceInventoryStatus = DossierSourceStatus | 'manual_review_required';

export interface SourceInventoryItem {
  expectationId: string;
  label: string;
  required: boolean;
  authority: DossierAuthority;
  documentType: string;
  asOf: string;
  period: string;
  selectionRule: string;
  status: SourceInventoryStatus;
  manualSupplementAllowed: boolean;
  sourceId?: string;
  contentHash?: string;
  materializedPath?: string;
  sourceDate?: string;
  filingDate?: string;
  errorCode?: DossierContractErrorCode;
  reason?: string;
  message?: string;
}

export interface CoverageBlockingReason {
  code:
    | 'missing_required_source'
    | 'failed_required_source'
    | 'skipped_required_source'
    | 'required_source_needs_review';
  message: string;
  expectationId: string;
}

export interface QualityReport {
  schemaVersion: string;
  runId: string;
  preset: DossierPresetRef;
  commercialReportAllowed: boolean;
  summary: {
    requiredTotal: number;
    requiredFound: number;
    requiredMissing: number;
    requiredFailed: number;
    optionalTotal: number;
  };
  blockingReasons: CoverageBlockingReason[];
}

export interface CoverageBundle {
  schemaVersion: string;
  runId: string;
  completedAt: string;
  company: DossierManifestCompany;
  preset: DossierPresetRef;
  files: {
    manifest: 'manifest.json';
    sourceInventory: 'source_inventory.json';
    qualityReport: 'quality_report.json';
    result: 'result.json';
  };
}

function blockingReasonFor(item: SourceInventoryItem): CoverageBlockingReason | undefined {
  if (!item.required) {
    return undefined;
  }

  const message = item.reason ?? item.message ?? `${item.label} is ${item.status}`;

  if (item.status === 'missing') {
    return { code: 'missing_required_source', message, expectationId: item.expectationId };
  }
  if (item.status === 'failed') {
    return { code: 'failed_required_source', message, expectationId: item.expectationId };
  }
  if (item.status === 'skipped') {
    return { code: 'skipped_required_source', message, expectationId: item.expectationId };
  }
  if (item.status === 'manual_review_required') {
    return { code: 'required_source_needs_review', message, expectationId: item.expectationId };
  }

  return undefined;
}

export function buildQualityReport(input: {
  runId: string;
  preset: DossierPresetRef;
  inventory: SourceInventoryItem[];
}): QualityReport {
  const required = input.inventory.filter((item) => item.required);

  const blockingReasons = input.inventory.flatMap((item) => {
    const reason = blockingReasonFor(item);
    return reason ? [reason] : [];
  });

  return {
    schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
    runId: input.runId,
    preset: input.preset,
    commercialReportAllowed: blockingReasons.length === 0,
    summary: {
      requiredTotal: required.length,
      requiredFound: required.filter((item) => item.status === 'found').length,
      requiredMissing: required.filter((item) => item.status === 'missing').length,
      requiredFailed: required.filter((item) => item.status === 'failed').length,
      optionalTotal: input.inventory.filter((item) => !item.required).length,
    },
    blockingReasons,
  };
}

export function buildCoverageBundle(input: {
  runId: string;
  completedAt: string;
  company: DossierManifestCompany;
  preset: DossierPresetRef;
}): CoverageBundle {
  return {
    schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
    runId: input.runId,
    completedAt: input.completedAt,
    company: input.company,
    preset: input.preset,
    files: {
      manifest: 'manifest.json',
      sourceInventory: 'source_inventory.json',
      qualityReport: 'quality_report.json',
      result: 'result.json',
    },
  };
}
