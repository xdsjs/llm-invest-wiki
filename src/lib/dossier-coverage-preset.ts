import type { DossierManifestCompany, DossierSourceExpectation } from './dossier.js';
import { COVERAGE_CONTRACT_SCHEMA_VERSION } from './dossier-contract.js';

type UsListedCompanyPreset = {
  ref: {
    id: 'us-listed-company';
    version: typeof COVERAGE_CONTRACT_SCHEMA_VERSION;
  };
  expectations: DossierSourceExpectation[];
};

export function buildUsListedCompanyPreset(input: {
  asOf: string;
  company: DossierManifestCompany;
}): UsListedCompanyPreset {
  const selectionPrefix = `for ${input.company.ticker} as of ${input.asOf}`;
  const expectation = (
    item: Omit<DossierSourceExpectation, 'asOf' | 'selectionRule' | 'manualSupplementAllowed'> & {
      manualSupplementAllowed?: boolean;
    }
  ): DossierSourceExpectation => ({
    ...item,
    asOf: input.asOf,
    selectionRule: `Select ${item.label} ${selectionPrefix}.`,
    manualSupplementAllowed: item.manualSupplementAllowed ?? true,
  });

  return {
    ref: {
      id: 'us-listed-company',
      version: COVERAGE_CONTRACT_SCHEMA_VERSION,
    },
    expectations: [
      expectation({
        expectationId: 'sec.latest-10-k',
        label: 'Latest annual report on Form 10-K',
        required: true,
        authority: 'sec',
        documentType: '10-k',
        period: 'latest-fiscal-year',
        match: {
          authorities: ['sec'],
          documentTypes: ['10-k'],
        },
      }),
      expectation({
        expectationId: 'sec.latest-10-q',
        label: 'Latest quarterly report on Form 10-Q',
        required: true,
        authority: 'sec',
        documentType: '10-q',
        period: 'latest-quarter',
        match: {
          authorities: ['sec'],
          documentTypes: ['10-q'],
        },
      }),
      expectation({
        expectationId: 'sec.latest-proxy',
        label: 'Latest proxy statement',
        required: true,
        authority: 'sec',
        documentType: 'proxy-statement',
        period: 'latest-annual-meeting',
        match: {
          authorities: ['sec'],
          documentTypes: ['def-14a', 'proxy-statement'],
        },
      }),
      expectation({
        expectationId: 'sec.latest-earnings-8-k',
        label: 'Latest earnings-related Form 8-K',
        required: true,
        authority: 'sec',
        documentType: '8-k',
        period: 'latest-earnings-event',
        match: {
          authorities: ['sec'],
          documentTypes: ['8-k'],
        },
      }),
      expectation({
        expectationId: 'company.latest-earnings-release',
        label: 'Latest earnings release',
        required: true,
        authority: 'company',
        documentType: 'earnings-release',
        period: 'latest-earnings-event',
        match: {
          authorities: ['company'],
          documentTypes: ['earnings-release'],
        },
      }),
      expectation({
        expectationId: 'company.latest-earnings-call-transcript',
        label: 'Latest earnings call transcript',
        required: true,
        authority: 'company',
        documentType: 'earnings-call-transcript',
        period: 'latest-earnings-event',
        match: {
          authorities: ['company'],
          documentTypes: ['earnings-call-transcript'],
        },
      }),
      expectation({
        expectationId: 'company.latest-ir-presentation',
        label: 'Latest investor presentation',
        required: false,
        authority: 'company',
        documentType: 'investor-presentation',
        period: 'latest-investor-update',
        match: {
          authorities: ['company'],
          documentTypes: ['investor-presentation'],
        },
      }),
      expectation({
        expectationId: 'company.latest-governance-documents',
        label: 'Latest company governance documents',
        required: false,
        authority: 'company',
        documentType: 'governance-document',
        period: 'current-governance',
        match: {
          authorities: ['company'],
          documentTypes: ['governance-document'],
        },
      }),
      expectation({
        expectationId: 'exchange.latest-company-profile',
        label: 'Latest exchange company profile',
        required: false,
        authority: input.company.exchange === 'NYSE' ? 'nyse' : 'nasdaq',
        documentType: 'exchange-profile',
        period: 'current-profile',
        manualSupplementAllowed: false,
        match: {
          authorities: ['nasdaq', 'nyse'],
          documentTypes: ['exchange-profile'],
        },
      }),
    ],
  };
}
