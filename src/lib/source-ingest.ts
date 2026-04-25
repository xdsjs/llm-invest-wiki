import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import { vaultPaths } from './config.js';
import { listMarkdownFiles } from './wiki.js';

const INGEST_TRACKING_FIELDS = new Set(['ingested', 'ingest_hash', 'wiki_pages']);

export type SourceIngestStatus = 'new' | 'changed' | 'clean';

export interface SourceIngestEntry {
  path: string;
  groupPath: string;
  status: SourceIngestStatus;
  title: string;
  published: string;
  authority: string;
  documentType: string;
  disclosureKey: string;
  ingested: string;
  ingestHash: string;
  currentHash: string;
  wikiPages: string[];
}

export interface SourceIngestGroup {
  path: string;
  sources: SourceIngestEntry[];
}

function stableValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = stableValue((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function canonicalData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(data).sort()) {
    if (!INGEST_TRACKING_FIELDS.has(key)) {
      out[key] = stableValue(data[key]);
    }
  }
  return out;
}

export function sourceContentHash(filePath: string): string {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const canonical = JSON.stringify(canonicalData(parsed.data as Record<string, unknown>));
  return createHash('sha256')
    .update(canonical)
    .update('\n')
    .update(parsed.content)
    .digest('hex')
    .slice(0, 16);
}

function stringField(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return typeof value === 'string' ? value : '';
}

function stringArrayField(data: Record<string, unknown>, key: string): string[] {
  const value = data[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function changedByMtimeFallback(filePath: string, ingested: string): boolean {
  const parsed = Date.parse(ingested);
  if (Number.isNaN(parsed)) {
    return true;
  }

  const threshold = /^\d{4}-\d{2}-\d{2}$/.test(ingested)
    ? parsed + 24 * 60 * 60 * 1000 - 1
    : parsed;
  return statSync(filePath).mtimeMs > threshold;
}

export function inspectSourceFile(root: string, filePath: string): SourceIngestEntry {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const relPath = relative(root, filePath);
  const currentHash = sourceContentHash(filePath);
  const ingested = stringField(data, 'ingested');
  const ingestHash = stringField(data, 'ingest_hash');
  let status: SourceIngestStatus = 'new';

  if (ingested) {
    if (ingestHash) {
      status = ingestHash === currentHash ? 'clean' : 'changed';
    } else {
      status = changedByMtimeFallback(filePath, ingested) ? 'changed' : 'clean';
    }
  }

  return {
    path: relPath,
    groupPath: dirname(relPath),
    status,
    title: stringField(data, 'title'),
    published: stringField(data, 'published') || stringField(data, 'date'),
    authority: stringField(data, 'authority'),
    documentType: stringField(data, 'document_type'),
    disclosureKey: stringField(data, 'disclosure_key'),
    ingested,
    ingestHash,
    currentHash,
    wikiPages: stringArrayField(data, 'wiki_pages'),
  };
}

export function listSourceIngestEntries(root: string): SourceIngestEntry[] {
  const paths = vaultPaths(root);
  return listMarkdownFiles(paths.sources)
    .map(filePath => inspectSourceFile(root, filePath))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function listPendingSourceGroups(root: string, includeClean = false): SourceIngestGroup[] {
  const groups = new Map<string, SourceIngestEntry[]>();

  for (const entry of listSourceIngestEntries(root)) {
    if (!includeClean && entry.status === 'clean') {
      continue;
    }
    const entries = groups.get(entry.groupPath) ?? [];
    entries.push(entry);
    groups.set(entry.groupPath, entries);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, sources]) => ({ path, sources }));
}

export function resolveSourcePath(root: string, inputPath: string): string {
  const paths = vaultPaths(root);
  const resolved = resolve(root, inputPath);
  const relToSources = relative(paths.sources, resolved);
  if (relToSources.startsWith('..') || isAbsolute(relToSources) || relToSources === '') {
    throw new Error(`source path must be inside sources/: ${inputPath}`);
  }
  if (!existsSync(resolved)) {
    throw new Error(`source path does not exist: ${inputPath}`);
  }
  return resolved;
}

export function markSourcesIngested(root: string, inputPaths: string[], wikiPages: string[]): SourceIngestEntry[] {
  const today = new Date().toISOString().slice(0, 10);
  const updated: SourceIngestEntry[] = [];

  for (const inputPath of inputPaths) {
    const filePath = resolveSourcePath(root, inputPath);
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const nextData = {
      ...data,
      ingested: today,
      ingest_hash: sourceContentHash(filePath),
      wiki_pages: wikiPages,
    };
    writeFileSync(filePath, matter.stringify(parsed.content, nextData));
    updated.push(inspectSourceFile(root, filePath));
  }

  return updated;
}
