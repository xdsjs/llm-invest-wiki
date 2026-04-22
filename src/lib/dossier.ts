import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

export type DossierAuthority = 'sec' | 'nasdaq' | 'nyse' | 'company';

export interface DossierMaterialInput {
  companyName: string;
  ticker: string;
  market: string;
  authority: DossierAuthority;
  title: string;
  source: string;
  canonicalUrl: string;
  author: string;
  published: string;
  documentType: string;
  disclosureKey: string;
  sequence: number;
  suggestedFilename: string;
  accessionNo?: string;
  primaryDocument?: string;
  sourceChannel?: string;
  contentType?: string;
  notes?: string;
}

export interface DossierManifestCompany {
  companyName: string;
  ticker: string;
  market: string;
  cik?: string;
  exchange?: string;
}

export interface DossierManifest {
  company: DossierManifestCompany;
  generatedAt: string;
  materials: DossierMaterialInput[];
}

function yamlQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function loadDossierManifest(filePath: string): DossierManifest {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as DossierManifest;
}

export function buildDisclosureDir(
  root: string,
  input: {
    authority: DossierAuthority;
    documentType: string;
    published: string;
    disclosureKey: string;
  }
): string {
  const year = input.published.slice(0, 4);
  return posix.join(root, input.authority, input.documentType, year, input.disclosureKey);
}

export function buildMaterialFilename(sequence: number, slug: string): string {
  return `${String(sequence).padStart(2, '0')}-${slug}.md`;
}

export function makeIdentityKey(input: {
  authority: DossierAuthority;
  canonicalUrl?: string;
  published: string;
  accessionNo?: string;
  primaryDocument?: string;
}): string {
  if (input.authority === 'sec') {
    if (!input.accessionNo || !input.primaryDocument) {
      throw new Error('SEC materials require accessionNo and primaryDocument');
    }
    return `sec:${input.accessionNo}:${input.primaryDocument}`;
  }
  if (!input.canonicalUrl) {
    throw new Error(`${input.authority} materials require canonicalUrl`);
  }
  return `${input.authority}:${input.canonicalUrl}:${input.published}`;
}

export function renderDossierMarkdown(input: {
  title: string;
  source: string;
  author: string;
  published: string;
  created: string;
  authority: DossierAuthority;
  documentType: string;
  disclosureKey: string;
  body: string;
  retrievedAt?: string;
  canonicalUrl?: string;
  sourceChannel?: string;
}): string {
  const lines = [
    '---',
    `title: ${yamlQuote(input.title)}`,
    `source: ${yamlQuote(input.source)}`,
    `author: ${yamlQuote(input.author)}`,
    `published: ${yamlQuote(input.published)}`,
    `created: ${yamlQuote(input.created)}`,
    `authority: ${yamlQuote(input.authority)}`,
    `document_type: ${yamlQuote(input.documentType)}`,
    `disclosure_key: ${yamlQuote(input.disclosureKey)}`,
  ];

  if (input.retrievedAt) {
    lines.push(`retrieved_at: ${yamlQuote(input.retrievedAt)}`);
  }
  if (input.canonicalUrl) {
    lines.push(`canonical_url: ${yamlQuote(input.canonicalUrl)}`);
  }
  if (input.sourceChannel) {
    lines.push(`source_channel: ${yamlQuote(input.sourceChannel)}`);
  }

  lines.push('---', '', input.body.trim(), '');
  return lines.join('\n');
}
