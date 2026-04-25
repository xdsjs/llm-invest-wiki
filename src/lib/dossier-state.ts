import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import type {
  DossierAuthority,
  DossierCheckpointSurface,
  DossierManifestCompany,
  DossierMaterialState,
  DossierState,
} from './dossier.js';

interface DossierStateMaterialInput {
  title?: string;
  authority?: DossierAuthority;
  documentType?: string;
  disclosureKey?: string;
  published?: string;
  source?: string;
  canonicalUrl?: string;
  accessionNo?: string;
  primaryDocument?: string;
  sourceChannel?: string;
}

export interface DossierStateRefreshResult {
  refreshed: number;
  missing: string[];
}

const DOSSIER_AUTHORITIES = new Set<DossierAuthority>(['sec', 'nasdaq', 'nyse', 'company']);

function normalizeAuthority(value: string | undefined): DossierAuthority | undefined {
  return DOSSIER_AUTHORITIES.has(value as DossierAuthority) ? value as DossierAuthority : undefined;
}

function stringField(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return typeof value === 'string' && value ? value : undefined;
}

function parseSecIdentityKey(identityKey: string): Pick<DossierStateMaterialInput, 'accessionNo' | 'primaryDocument'> {
  const match = identityKey.match(/^sec:([^:]+):(.+)$/);
  if (!match) {
    return {};
  }
  return {
    accessionNo: match[1],
    primaryDocument: match[2],
  };
}

function parseNonSecIdentityKey(
  identityKey: string,
  authority: DossierAuthority | undefined
): Pick<DossierStateMaterialInput, 'canonicalUrl' | 'published'> {
  if (!authority || authority === 'sec') {
    return {};
  }

  const prefix = `${authority}:`;
  if (!identityKey.startsWith(prefix)) {
    return {};
  }

  const match = identityKey.match(/:(\d{4}-\d{2}-\d{2})$/);
  if (!match) {
    return {};
  }

  return {
    canonicalUrl: identityKey.slice(prefix.length, identityKey.length - match[0].length),
    published: match[1],
  };
}

function isLaterOrEqual(candidate: string | undefined, current: string | undefined): candidate is string {
  return Boolean(candidate && (!current || candidate >= current));
}

function checkpointSurface(material: DossierStateMaterialInput): DossierCheckpointSurface | undefined {
  if (material.authority === 'sec') {
    return 'sec';
  }
  if (material.authority === 'nasdaq' || material.authority === 'nyse') {
    return 'exchange';
  }
  if (material.documentType === 'governance-document' || material.documentType === 'proxy-statement') {
    return 'governance';
  }
  if (material.authority === 'company') {
    return 'company';
  }
  return undefined;
}

function materialInputFromSource(
  identityKey: string,
  existing: DossierMaterialState,
  filePath: string
): DossierStateMaterialInput {
  const { data } = matter(readFileSync(filePath, 'utf-8'));
  const frontmatter = data as Record<string, unknown>;
  const authority = normalizeAuthority(stringField(frontmatter, 'authority')) ?? existing.authority;
  const parsedSecIdentity = parseSecIdentityKey(identityKey);
  const parsedNonSecIdentity = parseNonSecIdentityKey(identityKey, authority);

  return {
    title: stringField(frontmatter, 'title') ?? existing.title,
    authority,
    documentType: stringField(frontmatter, 'document_type') ?? existing.documentType,
    disclosureKey: stringField(frontmatter, 'disclosure_key') ?? existing.disclosureKey,
    published: stringField(frontmatter, 'published') ?? existing.published ?? parsedNonSecIdentity.published,
    source: stringField(frontmatter, 'source') ?? existing.source,
    canonicalUrl: stringField(frontmatter, 'canonical_url') ?? existing.canonicalUrl ?? parsedNonSecIdentity.canonicalUrl,
    accessionNo: existing.accessionNo ?? parsedSecIdentity.accessionNo,
    primaryDocument: existing.primaryDocument ?? parsedSecIdentity.primaryDocument,
    sourceChannel: stringField(frontmatter, 'source_channel') ?? existing.sourceChannel,
  };
}

export function createInitialDossierState(company: DossierManifestCompany): DossierState {
  const now = new Date().toISOString();
  return {
    market: company.market,
    ticker: company.ticker,
    companyName: company.companyName,
    cik: company.cik ?? null,
    exchange: company.exchange ?? null,
    template: company.market,
    initializedAt: now,
    updatedAt: now,
    materials: {},
    checkpoints: {},
  };
}

export function loadDossierState(statePath: string, company: DossierManifestCompany): DossierState {
  if (!existsSync(statePath)) {
    return createInitialDossierState(company);
  }

  const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Partial<DossierState>;
  return {
    market: state.market ?? company.market,
    ticker: state.ticker ?? company.ticker,
    companyName: state.companyName ?? company.companyName,
    cik: state.cik ?? company.cik ?? null,
    exchange: state.exchange ?? company.exchange ?? null,
    template: state.template ?? company.market,
    initializedAt: state.initializedAt ?? new Date().toISOString(),
    updatedAt: state.updatedAt ?? state.initializedAt,
    materials: state.materials ?? {},
    checkpoints: state.checkpoints ?? {},
  };
}

export function readDossierState(statePath: string): DossierState {
  const state = JSON.parse(readFileSync(statePath, 'utf-8')) as Partial<DossierState>;
  const initializedAt = state.initializedAt ?? new Date().toISOString();
  return {
    market: state.market ?? '',
    ticker: state.ticker ?? '',
    companyName: state.companyName ?? '',
    cik: state.cik ?? null,
    exchange: state.exchange ?? null,
    template: state.template ?? state.market ?? '',
    initializedAt,
    updatedAt: state.updatedAt ?? initializedAt,
    materials: state.materials ?? {},
    checkpoints: state.checkpoints ?? {},
  };
}

export function saveDossierState(statePath: string, state: DossierState): void {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

export function mergeDossierMaterialState(
  existing: DossierMaterialState | undefined,
  material: DossierStateMaterialInput,
  outputPath: string,
  contentHash: string,
  now: string
): DossierMaterialState {
  return {
    outputPath,
    contentHash,
    title: material.title,
    authority: material.authority,
    documentType: material.documentType,
    disclosureKey: material.disclosureKey,
    published: material.published,
    source: material.source,
    canonicalUrl: material.canonicalUrl,
    accessionNo: material.accessionNo,
    primaryDocument: material.primaryDocument,
    sourceChannel: material.sourceChannel,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
  };
}

export function updateDossierCheckpoints(
  state: DossierState,
  material: DossierStateMaterialInput,
  identityKey: string,
  now: string
): void {
  if (!material.authority || !material.documentType || !material.published) {
    return;
  }

  const checkpoints = state.checkpoints ?? {};
  state.checkpoints = checkpoints;

  const surface = checkpointSurface(material);
  if (!surface) {
    return;
  }

  let checkpoint = checkpoints[surface];
  if (!checkpoint) {
    checkpoint = {};
    checkpoints[surface] = checkpoint;
  }

  checkpoint.updatedAt = now;

  if (isLaterOrEqual(material.published, checkpoint.latestPublished)) {
    checkpoint.latestPublished = material.published;
  }

  checkpoint.latestPublishedByDocumentType ??= {};
  checkpoint.latestIdentityByDocumentType ??= {};

  const currentDocumentTypeDate = checkpoint.latestPublishedByDocumentType[material.documentType];
  if (isLaterOrEqual(material.published, currentDocumentTypeDate)) {
    checkpoint.latestPublishedByDocumentType[material.documentType] = material.published;
    checkpoint.latestIdentityByDocumentType[material.documentType] = identityKey;
  }

  if (material.authority !== 'sec') {
    return;
  }

  if (isLaterOrEqual(material.published, checkpoint.latestSecFilingDate)) {
    checkpoint.latestSecFilingDate = material.published;
  }

  checkpoint.latestSecFilingDateByDocumentType ??= {};
  checkpoint.latestSecAccessionNoByDocumentType ??= {};

  const currentSecDocumentTypeDate = checkpoint.latestSecFilingDateByDocumentType[material.documentType];
  if (isLaterOrEqual(material.published, currentSecDocumentTypeDate)) {
    checkpoint.latestSecFilingDateByDocumentType[material.documentType] = material.published;
    if (material.accessionNo) {
      checkpoint.latestSecAccessionNoByDocumentType[material.documentType] = material.accessionNo;
    }
  }
}

export function refreshDossierStateFromTrackedSources(
  state: DossierState,
  now = new Date().toISOString()
): DossierStateRefreshResult {
  const result: DossierStateRefreshResult = { refreshed: 0, missing: [] };
  const refreshedMaterials: Record<string, DossierMaterialState> = {};
  state.checkpoints = {};

  for (const [identityKey, existing] of Object.entries(state.materials)) {
    if (!existsSync(existing.outputPath)) {
      refreshedMaterials[identityKey] = existing;
      result.missing.push(existing.outputPath);
      continue;
    }

    const material = materialInputFromSource(identityKey, existing, existing.outputPath);
    const refreshed = mergeDossierMaterialState(
      existing,
      material,
      existing.outputPath,
      existing.contentHash,
      now
    );

    refreshedMaterials[identityKey] = refreshed;
    updateDossierCheckpoints(state, refreshed, identityKey, now);
    result.refreshed++;
  }

  state.materials = refreshedMaterials;
  state.updatedAt = now;
  return result;
}
