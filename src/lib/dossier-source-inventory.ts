import { relative, sep } from 'node:path';
import type {
  DossierAuthority,
  DossierContractErrorCode,
  DossierMaterialInput,
  DossierSourceExpectation,
} from './dossier.js';
import type { SourceInventoryItem } from './dossier-contract.js';

export interface DossierMaterialOutcome {
  status: 'found' | 'failed' | 'skipped';
  material: Pick<
    DossierMaterialInput,
    'authority' | 'documentType' | 'published' | 'accessionNo' | 'primaryDocument' | 'sourceChannel'
  >;
  sourceId?: string;
  contentHash?: string;
  outputPath?: string;
  errorCode?: DossierContractErrorCode;
  error?: string;
}

function toVaultRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

function authorityMatches(expectation: DossierSourceExpectation, authority: DossierAuthority): boolean {
  return expectation.match.authorities
    ? expectation.match.authorities.includes(authority)
    : expectation.authority === authority;
}

function outcomeMatches(
  expectation: DossierSourceExpectation,
  outcome: DossierMaterialOutcome
): boolean {
  if (
    expectation.match.sourceChannel &&
    outcome.material.sourceChannel !== expectation.match.sourceChannel
  ) {
    return false;
  }

  return (
    authorityMatches(expectation, outcome.material.authority) &&
    expectation.match.documentTypes.includes(outcome.material.documentType)
  );
}

function statusFromOutcome(outcome: DossierMaterialOutcome): SourceInventoryItem['status'] {
  return outcome.status;
}

function foundOutcomeIsComplete(outcome: DossierMaterialOutcome): boolean {
  return Boolean(outcome.sourceId && outcome.contentHash && outcome.outputPath);
}

function baseItem(expectation: DossierSourceExpectation): Omit<SourceInventoryItem, 'status'> {
  return {
    expectationId: expectation.expectationId,
    label: expectation.label,
    required: expectation.required,
    authority: expectation.authority,
    documentType: expectation.documentType,
    asOf: expectation.asOf,
    period: expectation.period,
    selectionRule: expectation.selectionRule,
    manualSupplementAllowed: expectation.manualSupplementAllowed,
  };
}

function missingItem(expectation: DossierSourceExpectation): SourceInventoryItem {
  const base = baseItem(expectation);

  if (expectation.notApplicable) {
    return {
      ...base,
      status: 'not_applicable',
      errorCode: expectation.notApplicable.errorCode,
      reason: expectation.notApplicable.reason,
    };
  }

  return {
    ...base,
    status: 'missing',
    errorCode: 'source_missing',
    reason: `${expectation.label} was not found`,
  };
}

export function buildSourceInventory(input: {
  root: string;
  expectations: DossierSourceExpectation[];
  outcomes: DossierMaterialOutcome[];
}): SourceInventoryItem[] {
  return input.expectations.map((expectation) => {
    const outcome = input.outcomes.find((candidate) => outcomeMatches(expectation, candidate));

    if (!outcome) {
      return missingItem(expectation);
    }

    const status = statusFromOutcome(outcome);
    const found = status === 'found';
    const incompleteFound = found && !foundOutcomeIsComplete(outcome);

    return {
      ...baseItem(expectation),
      status: incompleteFound ? 'failed' : status,
      sourceId: outcome.sourceId,
      contentHash: outcome.contentHash,
      sourceDate: outcome.material.published,
      filingDate: outcome.material.authority === 'sec' ? outcome.material.published : undefined,
      materializedPath: outcome.outputPath ? toVaultRelative(input.root, outcome.outputPath) : undefined,
      errorCode: found
        ? incompleteFound
          ? 'source_materialize_failed'
          : undefined
        : outcome.errorCode ?? 'manual_review_required',
      reason: found
        ? incompleteFound
          ? `${expectation.label} found outcome is missing source identity, content hash, or materialized path`
          : undefined
        : outcome.error ?? `${expectation.label} requires review`,
    };
  });
}
