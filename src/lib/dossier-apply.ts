import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import {
  buildDisclosureDir,
  buildMaterialFilename,
  makeIdentityKey,
  renderDossierMarkdown,
} from './dossier.js';
import type { DossierManifest, DossierMaterialInput } from './dossier.js';
import { vaultPaths } from './config.js';
import type { MaterializerName } from './dossier-materialize.js';
import { materializeSource } from './dossier-materialize.js';
import {
  loadDossierState,
  mergeDossierMaterialState,
  saveDossierState,
  updateDossierCheckpoints,
} from './dossier-state.js';
import {
  buildCoverageBundle,
  buildQualityReport,
  COVERAGE_CONTRACT_SCHEMA_VERSION,
} from './dossier-contract.js';
import type { CoverageBlockingReason, SourceInventoryItem } from './dossier-contract.js';
import { buildUsListedCompanyPreset } from './dossier-coverage-preset.js';
import { buildSourceInventory } from './dossier-source-inventory.js';
import type { DossierMaterialOutcome } from './dossier-source-inventory.js';

export interface ApplyResult {
  created: string[];
  materialized: Array<{ path: string; materializer: MaterializerName }>;
  skippedDuplicates: string[];
  unresolved: string[];
  runDir: string;
  runId: string;
  bundlePath: string;
  sourceInventoryPath: string;
  qualityReportPath: string;
  commercialReportAllowed: boolean;
  blockingReasons: CoverageBlockingReason[];
}

export interface ApplyOptions {
  runId?: string;
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

function writeJsonFile(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeCompletionJson(path: string, value: unknown): void {
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeJsonFile(tmpPath, value);
  renameSync(tmpPath, path);
}

function hashToContractHash(hash: string): string {
  return hash.startsWith('sha256:') ? hash : `sha256:${hash}`;
}

function normalizeManifestForContract(manifest: DossierManifest): DossierManifest {
  if (manifest.preset && manifest.expectations) {
    return {
      ...manifest,
      schemaVersion: manifest.schemaVersion ?? COVERAGE_CONTRACT_SCHEMA_VERSION,
    };
  }

  const asOf = manifest.generatedAt.slice(0, 10);
  const preset = buildUsListedCompanyPreset({ asOf, company: manifest.company });
  return {
    ...manifest,
    schemaVersion: COVERAGE_CONTRACT_SCHEMA_VERSION,
    preset: preset.ref,
    expectations: preset.expectations,
  };
}

function renderRunResult(
  root: string,
  manifest: DossierManifest,
  result: ApplyResult,
  inventory: SourceInventoryItem[],
  qualityReport: ReturnType<typeof buildQualityReport>
): string {
  return JSON.stringify({
    runId: result.runId,
    company: manifest.company,
    generatedAt: manifest.generatedAt,
    created: result.created.map(path => toVaultRelative(root, path)),
    materialized: result.materialized.map(item => ({
      path: toVaultRelative(root, item.path),
      materializer: item.materializer,
    })),
    skippedDuplicates: result.skippedDuplicates,
    unresolved: result.unresolved.map(path => toVaultRelative(root, path)),
    sourceInventory: 'source_inventory.json',
    qualityReport: 'quality_report.json',
    commercialReportAllowed: qualityReport.commercialReportAllowed,
    blockingReasons: qualityReport.blockingReasons,
    coverageSummary: qualityReport.summary,
    inventorySummary: inventory.map(item => ({
      expectationId: item.expectationId,
      status: item.status,
      sourceId: item.sourceId,
      materializedPath: item.materializedPath,
      errorCode: item.errorCode,
    })),
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
  const contractManifest = normalizeManifestForContract(manifest);
  writeJsonFile(join(runDir, 'manifest.json'), contractManifest);

  const state = loadDossierState(paths.dossierState, contractManifest.company);
  const now = new Date().toISOString();
  const result: ApplyResult = {
    created: [],
    materialized: [],
    skippedDuplicates: [],
    unresolved: [],
    runDir,
    runId,
    bundlePath: join(runDir, 'bundle.json'),
    sourceInventoryPath: join(runDir, 'source_inventory.json'),
    qualityReportPath: join(runDir, 'quality_report.json'),
    commercialReportAllowed: false,
    blockingReasons: [],
  };
  const outcomes: DossierMaterialOutcome[] = [];
  const reservedSequences = new Set<string>();

  for (const material of contractManifest.materials) {
    try {
      const identityKey = makeIdentityKey(material);
      const seqKey = sequenceKey(material);
      if (reservedSequences.has(seqKey)) {
        throw new Error(`duplicate sequence ${material.sequence} within ${material.documentType}/${material.disclosureKey}`);
      }
      reservedSequences.add(seqKey);

      const { body, retrievedAt, materializer } = await materializeSource(material);
      const materialWithMaterializer = { ...material, materializer };
      const contentHash = hashBody(body);
      const existing = state.materials[identityKey];

      if (existing && existing.contentHash === contentHash) {
        state.materials[identityKey] = mergeDossierMaterialState(
          existing,
          materialWithMaterializer,
          existing.outputPath,
          contentHash,
          now
        );
        updateDossierCheckpoints(state, material, identityKey, now);
        result.skippedDuplicates.push(identityKey);
        outcomes.push({
          status: 'found',
          material,
          sourceId: identityKey,
          contentHash: hashToContractHash(existing.contentHash),
          outputPath: existing.outputPath,
        });
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
        created: now.slice(0, 10),
        authority: material.authority,
        documentType: material.documentType,
        disclosureKey: material.disclosureKey,
        body,
        retrievedAt,
        canonicalUrl: material.canonicalUrl,
        sourceChannel: material.sourceChannel,
        materializer,
      });

      writeFileSync(outPath, markdown);
      state.materials[identityKey] = mergeDossierMaterialState(existing, materialWithMaterializer, outPath, contentHash, now);
      updateDossierCheckpoints(state, material, identityKey, now);
      result.created.push(outPath);
      result.materialized.push({ path: outPath, materializer });
      outcomes.push({
        status: 'found',
        material,
        sourceId: identityKey,
        contentHash: hashToContractHash(contentHash),
        outputPath: outPath,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outcomes.push({
        status: 'failed',
        material,
        errorCode: message.includes('duplicate sequence')
          ? 'source_sequence_conflict'
          : 'source_materialize_failed',
        error: message,
      });
      const unresolvedPath = join(
        paths.dossierUnresolved,
        `${material.disclosureKey}-${material.documentType}-${material.sequence}.json`
      );
      const unresolvedPayload = JSON.stringify({
        material,
        error: message,
      }, null, 2);
      writeFileSync(unresolvedPath, unresolvedPayload);
      writeFileSync(
        join(runDir, 'unresolved', `${material.disclosureKey}-${material.documentType}-${material.sequence}.json`),
        unresolvedPayload
      );
      result.unresolved.push(unresolvedPath);
    }
  }

  state.updatedAt = now;
  saveDossierState(paths.dossierState, state);
  const inventory = buildSourceInventory({
    root,
    expectations: contractManifest.expectations ?? [],
    outcomes,
  });
  const qualityReport = buildQualityReport({
    runId,
    preset: contractManifest.preset ?? {
      id: 'us-listed-company',
      version: COVERAGE_CONTRACT_SCHEMA_VERSION,
    },
    inventory,
  });
  result.commercialReportAllowed = qualityReport.commercialReportAllowed;
  result.blockingReasons = qualityReport.blockingReasons;

  writeJsonFile(result.sourceInventoryPath, inventory);
  writeJsonFile(result.qualityReportPath, qualityReport);
  writeFileSync(join(runDir, 'result.json'), `${renderRunResult(root, contractManifest, result, inventory, qualityReport)}\n`);

  const bundle = buildCoverageBundle({
    runId,
    completedAt: now,
    company: contractManifest.company,
    preset: qualityReport.preset,
  });
  writeCompletionJson(result.bundlePath, bundle);
  return result;
}
