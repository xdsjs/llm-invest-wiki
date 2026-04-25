import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import {
  buildDisclosureDir,
  buildMaterialFilename,
  makeIdentityKey,
  renderDossierMarkdown,
} from './dossier.js';
import type {
  DossierManifest,
  DossierManifestCompany,
  DossierMaterialInput,
  DossierState,
} from './dossier.js';
import { vaultPaths } from './config.js';
import { materializeSource } from './dossier-materialize.js';

export interface ApplyResult {
  created: string[];
  skippedDuplicates: string[];
  unresolved: string[];
  runDir: string;
  runId: string;
}

export interface ApplyOptions {
  runId?: string;
}

function createInitialState(company: DossierManifestCompany): DossierState {
  return {
    market: company.market,
    ticker: company.ticker,
    companyName: company.companyName,
    cik: company.cik ?? null,
    exchange: company.exchange ?? null,
    template: company.market,
    initializedAt: new Date().toISOString(),
    materials: {},
  };
}

function loadDossierState(statePath: string, company: DossierManifestCompany): DossierState {
  if (!existsSync(statePath)) {
    return createInitialState(company);
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
    materials: state.materials ?? {},
  };
}

function saveDossierState(statePath: string, state: DossierState): void {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

function sequenceKey(material: DossierMaterialInput): string {
  return [
    material.documentType,
    material.published.slice(0, 4),
    material.disclosureKey,
    String(material.sequence),
  ].join(':');
}

function hasSequenceConflict(outDir: string, sequence: number, targetName: string): boolean {
  if (!existsSync(outDir)) {
    return false;
  }

  const prefix = `${String(sequence).padStart(2, '0')}-`;
  for (const entry of readdirSync(outDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    if (entry.name.startsWith(prefix) && entry.name !== targetName) {
      return true;
    }
  }

  return false;
}

function slugifyRunPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'run';
}

function defaultRunId(manifest: DossierManifest): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:]/g, '-');
  return `${timestamp}-${slugifyRunPart(manifest.company.ticker)}`;
}

function assertValidRunId(runId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) {
    throw new Error(`invalid dossier run id: ${runId}`);
  }
}

function allocateRunDir(baseDir: string, manifest: DossierManifest, runId?: string): { runId: string; runDir: string } {
  const selectedRunId = runId ?? defaultRunId(manifest);
  assertValidRunId(selectedRunId);

  if (runId) {
    const selectedDir = join(baseDir, selectedRunId);
    if (existsSync(selectedDir)) {
      throw new Error(`dossier run already exists: ${selectedRunId}`);
    }
    return { runId: selectedRunId, runDir: selectedDir };
  }

  let candidate = selectedRunId;
  let counter = 2;
  while (existsSync(join(baseDir, candidate))) {
    candidate = `${selectedRunId}-${counter++}`;
  }

  return { runId: candidate, runDir: join(baseDir, candidate) };
}

function toVaultRelative(root: string, path: string): string {
  return relative(root, path).split(sep).join('/');
}

function renderRunReport(root: string, manifest: DossierManifest, result: ApplyResult): string {
  const lines = [
    `# Dossier Run: ${result.runId}`,
    '',
    `Company: ${manifest.company.ticker} — ${manifest.company.companyName}`,
    `Generated: ${manifest.generatedAt}`,
    `Run Dir: ${toVaultRelative(root, result.runDir)}`,
    '',
    '## Summary',
    '',
    `Created: ${result.created.length}`,
    `Skipped duplicates: ${result.skippedDuplicates.length}`,
    `Unresolved: ${result.unresolved.length}`,
    '',
  ];

  if (result.created.length > 0) {
    lines.push('## Created Sources', '');
    for (const path of result.created) {
      lines.push(`- ${toVaultRelative(root, path)}`);
    }
    lines.push('');
  }

  if (result.skippedDuplicates.length > 0) {
    lines.push('## Skipped Duplicates', '');
    for (const key of result.skippedDuplicates) {
      lines.push(`- ${key}`);
    }
    lines.push('');
  }

  if (result.unresolved.length > 0) {
    lines.push('## Unresolved', '');
    for (const path of result.unresolved) {
      lines.push(`- ${toVaultRelative(root, path)}`);
    }
    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function renderRunResult(root: string, manifest: DossierManifest, result: ApplyResult): string {
  return JSON.stringify({
    runId: result.runId,
    company: manifest.company,
    generatedAt: manifest.generatedAt,
    created: result.created.map(path => toVaultRelative(root, path)),
    skippedDuplicates: result.skippedDuplicates,
    unresolved: result.unresolved.map(path => toVaultRelative(root, path)),
  }, null, 2);
}

export async function applyManifest(
  root: string,
  manifest: DossierManifest,
  options: ApplyOptions = {}
): Promise<ApplyResult> {
  const paths = vaultPaths(root);
  mkdirSync(paths.dossierSources, { recursive: true });
  mkdirSync(paths.dossierUnresolved, { recursive: true });
  mkdirSync(paths.dossierRuns, { recursive: true });
  mkdirSync(dirname(paths.dossierState), { recursive: true });

  const { runId, runDir } = allocateRunDir(paths.dossierRuns, manifest, options.runId);
  mkdirSync(runDir, { recursive: true });
  mkdirSync(join(runDir, 'unresolved'), { recursive: true });
  writeFileSync(join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const state = loadDossierState(paths.dossierState, manifest.company);
  const result: ApplyResult = { created: [], skippedDuplicates: [], unresolved: [], runDir, runId };
  const reservedSequences = new Set<string>();

  for (const material of manifest.materials) {
    const identityKey = makeIdentityKey(material);

    try {
      const seqKey = sequenceKey(material);
      if (reservedSequences.has(seqKey)) {
        throw new Error(`duplicate sequence ${material.sequence} within ${material.documentType}/${material.disclosureKey}`);
      }
      reservedSequences.add(seqKey);

      const { body, retrievedAt } = await materializeSource(material);
      const contentHash = hashBody(body);
      const existing = state.materials[identityKey];

      if (existing && existing.contentHash === contentHash) {
        result.skippedDuplicates.push(identityKey);
        continue;
      }

      const relDir = buildDisclosureDir('sources', {
        documentType: material.documentType,
        published: material.published,
        disclosureKey: material.disclosureKey,
      });
      const outDir = join(root, relDir);
      mkdirSync(outDir, { recursive: true });

      const outPath = join(outDir, buildMaterialFilename(material.sequence, material.suggestedFilename));
      if (hasSequenceConflict(outDir, material.sequence, buildMaterialFilename(material.sequence, material.suggestedFilename))) {
        throw new Error(`duplicate sequence ${material.sequence} already exists in ${material.documentType}/${material.disclosureKey}`);
      }

      const markdown = renderDossierMarkdown({
        title: material.title,
        source: material.source,
        author: material.author,
        published: material.published,
        created: new Date().toISOString().slice(0, 10),
        authority: material.authority,
        documentType: material.documentType,
        disclosureKey: material.disclosureKey,
        body,
        retrievedAt,
        canonicalUrl: material.canonicalUrl,
        sourceChannel: material.sourceChannel,
      });

      writeFileSync(outPath, markdown);
      state.materials[identityKey] = { outputPath: outPath, contentHash };
      result.created.push(outPath);
    } catch (error) {
      const unresolvedPath = join(
        paths.dossierUnresolved,
        `${material.disclosureKey}-${material.documentType}-${material.sequence}.json`
      );
      const unresolvedPayload = JSON.stringify({
        material,
        error: error instanceof Error ? error.message : String(error),
      }, null, 2);
      writeFileSync(unresolvedPath, unresolvedPayload);
      writeFileSync(
        join(runDir, 'unresolved', `${material.disclosureKey}-${material.documentType}-${material.sequence}.json`),
        unresolvedPayload
      );
      result.unresolved.push(unresolvedPath);
    }
  }

  saveDossierState(paths.dossierState, state);
  writeFileSync(join(runDir, 'result.json'), `${renderRunResult(root, manifest, result)}\n`);
  writeFileSync(join(runDir, 'report.md'), renderRunReport(root, manifest, result));
  return result;
}
