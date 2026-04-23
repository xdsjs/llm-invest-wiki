import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import matter from 'gray-matter';
import { listMarkdownFiles } from './wiki.js';

const REQUIRED_FRONTMATTER_FIELDS = [
  'title',
  'source',
  'author',
  'published',
  'created',
  'authority',
  'document_type',
  'disclosure_key',
] as const;

export interface DossierIssue {
  type: string;
  path: string;
  detail: string;
}

export interface DossierSummary {
  materialCount: number;
  disclosureCount: number;
  byAuthority: Record<string, number>;
  byDocumentType: Record<string, number>;
  latestPublished: string;
}

function splitRelativePath(filePath: string): string[] {
  return filePath.split(/[\\/]/);
}

export function summarizeDossier(dossierDir: string): DossierSummary {
  const files = listMarkdownFiles(dossierDir);
  const disclosures = new Set<string>();
  const byAuthority: Record<string, number> = {};
  const byDocumentType: Record<string, number> = {};
  let latestPublished = '';

  for (const file of files) {
    const { data } = matter(readFileSync(file, 'utf-8'));
    const rel = relative(dossierDir, file);
    const parts = splitRelativePath(rel);
    if (parts.length >= 4) {
      disclosures.add(parts.slice(0, 3).join('/'));
    }

    if (typeof data.authority === 'string' && data.authority) {
      byAuthority[data.authority] = (byAuthority[data.authority] ?? 0) + 1;
    }
    if (typeof data.document_type === 'string' && data.document_type) {
      byDocumentType[data.document_type] = (byDocumentType[data.document_type] ?? 0) + 1;
    }
    if (typeof data.published === 'string' && data.published > latestPublished) {
      latestPublished = data.published;
    }
  }

  return {
    materialCount: files.length,
    disclosureCount: disclosures.size,
    byAuthority,
    byDocumentType,
    latestPublished,
  };
}

export function auditDossier(dossierDir: string): DossierIssue[] {
  const issues: DossierIssue[] = [];

  for (const file of listMarkdownFiles(dossierDir)) {
    const raw = readFileSync(file, 'utf-8');
    const { data } = matter(raw);
    const rel = relative(dossierDir, file);
    const parts = splitRelativePath(rel);

    if (parts.length < 4) {
      issues.push({
        type: 'bad_path_layout',
        path: rel,
        detail: 'expected dossier/{document_type}/{year}/{disclosure_key}/{file}',
      });
      continue;
    }

    const [documentType, year, disclosureKey] = parts;
    const hasAnyFrontmatterField = REQUIRED_FRONTMATTER_FIELDS.some(field => data[field] != null);

    if (!hasAnyFrontmatterField) {
      issues.push({
        type: 'missing_frontmatter',
        path: rel,
        detail: 'required dossier frontmatter block is missing',
      });
      continue;
    }

    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      if (data[field] == null || data[field] === '') {
        issues.push({
          type: 'missing_field',
          path: rel,
          detail: `missing required frontmatter field: ${field}`,
        });
      }
    }

    if (typeof data.document_type === 'string' && data.document_type !== documentType) {
      issues.push({
        type: 'document_type_mismatch',
        path: rel,
        detail: `path document_type ${documentType} does not match frontmatter ${data.document_type}`,
      });
    }

    if (typeof data.disclosure_key === 'string' && data.disclosure_key !== disclosureKey) {
      issues.push({
        type: 'disclosure_key_mismatch',
        path: rel,
        detail: `path disclosure_key ${disclosureKey} does not match frontmatter ${data.disclosure_key}`,
      });
    }

    if (typeof data.published === 'string' && data.published.slice(0, 4) !== year) {
      issues.push({
        type: 'year_mismatch',
        path: rel,
        detail: `path year ${year} does not match published ${data.published}`,
      });
    }
  }

  return issues;
}
