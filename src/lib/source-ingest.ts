import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import { vaultPaths } from './config.js';
import { listMarkdownFiles } from './wiki.js';

export type SourceIngestStatus = 'new' | 'clean';

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
  wikiPages: string[];
}

export interface SourceIngestGroup {
  path: string;
  sources: SourceIngestEntry[];
}

interface DossierRunResult {
  created?: unknown;
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

export function inspectSourceFile(root: string, filePath: string): SourceIngestEntry {
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const relPath = relative(root, filePath);
  const ingested = stringField(data, 'ingested');
  const status: SourceIngestStatus = ingested ? 'clean' : 'new';

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
    wikiPages: stringArrayField(data, 'wiki_pages'),
  };
}

export function listSourceIngestEntries(root: string): SourceIngestEntry[] {
  const paths = vaultPaths(root);
  return listMarkdownFiles(paths.sources)
    .map(filePath => inspectSourceFile(root, filePath))
    .sort((a, b) => a.path.localeCompare(b.path));
}

function groupSourceEntries(entries: SourceIngestEntry[], includeClean = false): SourceIngestGroup[] {
  const groups = new Map<string, SourceIngestEntry[]>();

  for (const entry of entries) {
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

export function listPendingSourceGroups(root: string, includeClean = false): SourceIngestGroup[] {
  return groupSourceEntries(listSourceIngestEntries(root), includeClean);
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function resolveDossierRunCreatedSourceFiles(root: string, inputPath: string): string[] {
  const paths = vaultPaths(root);
  const resolved = resolve(root, inputPath);
  const resultPath = resolved.endsWith('result.json') ? resolved : join(resolved, 'result.json');
  const relToRuns = relative(paths.dossierRuns, resultPath);
  if (relToRuns.startsWith('..') || isAbsolute(relToRuns)) {
    return [];
  }
  if (!existsSync(resultPath)) {
    throw new Error(`dossier run result does not exist: ${inputPath}`);
  }

  const result = JSON.parse(readFileSync(resultPath, 'utf-8')) as DossierRunResult;
  if (!Array.isArray(result.created)) {
    return [];
  }

  return result.created
    .filter((path): path is string => typeof path === 'string')
    .map(path => resolveSourcePath(root, path));
}

function listSourceFilesForPath(root: string, inputPath: string): string[] {
  const paths = vaultPaths(root);
  const resolved = resolve(root, inputPath);

  if (isInside(paths.dossierRuns, resolved)) {
    return resolveDossierRunCreatedSourceFiles(root, inputPath);
  }

  if (!isInside(paths.sources, resolved)) {
    throw new Error(`pending path must be inside sources/ or .llm-wiki-invest/dossier-runs/: ${inputPath}`);
  }
  if (!existsSync(resolved)) {
    throw new Error(`pending path does not exist: ${inputPath}`);
  }
  if (statSync(resolved).isFile()) {
    if (!resolved.endsWith('.md')) {
      return [];
    }
    return [resolved];
  }
  return listMarkdownFiles(resolved).sort((a, b) => a.localeCompare(b));
}

export function listPendingSourceGroupsForPath(
  root: string,
  inputPath: string,
  includeClean = false
): SourceIngestGroup[] {
  const entries = listSourceFilesForPath(root, inputPath)
    .map(filePath => inspectSourceFile(root, filePath))
    .sort((a, b) => a.path.localeCompare(b.path));
  return groupSourceEntries(entries, includeClean);
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
