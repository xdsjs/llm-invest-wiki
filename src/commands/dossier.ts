import { Command } from 'commander';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, sep } from 'node:path';
import { requireVaultRoot, vaultPaths } from '../lib/config.js';
import { loadDossierManifest } from '../lib/dossier.js';
import type { DossierState } from '../lib/dossier.js';
import { applyManifest } from '../lib/dossier-apply.js';
import {
  createInitialDossierState,
  readDossierState,
  refreshDossierStateFromTrackedSources,
  saveDossierState,
} from '../lib/dossier-state.js';
import { auditDossier, summarizeDossier } from '../lib/dossier-audit.js';
import {
  fetchSecSubmissionsByCik,
  parseFormsOption,
  summarizeRecentSubmissions,
} from '../lib/sec-submissions.js';

function countUnresolvedFiles(dir: string): number {
  if (!existsSync(dir)) {
    return 0;
  }

  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      count++;
    }
  }
  return count;
}

export const dossierCommand = new Command('dossier')
  .description('Manage read-only official source materials');

dossierCommand
  .command('fetch-sec-submissions')
  .description('Fetch SEC submissions JSON or a recent-filings summary by CIK')
  .requiredOption('--cik <cik>', 'SEC CIK')
  .option('--recent', 'emit a recent-filings summary instead of the full submissions payload')
  .option('--forms <forms>', 'comma-separated form filters, e.g. 10-K,10-Q,8-K,DEF 14A')
  .action(async (opts: {
    cik: string;
    recent?: boolean;
    forms?: string;
  }) => {
    const payload = await fetchSecSubmissionsByCik(opts.cik);
    if (!opts.recent) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(JSON.stringify(
      summarizeRecentSubmissions(payload, parseFormsOption(opts.forms)),
      null,
      2
    ));
  });

dossierCommand
  .command('init')
  .description('Initialize dossier state for the current vault')
  .requiredOption('--market <market>', 'market code')
  .requiredOption('--ticker <ticker>', 'ticker symbol')
  .requiredOption('--company-name <name>', 'legal company name')
  .option('--cik <cik>', 'SEC CIK')
  .option('--exchange <exchange>', 'primary exchange')
  .action((opts: {
    market: string;
    ticker: string;
    companyName: string;
    cik?: string;
    exchange?: string;
  }) => {
    const root = requireVaultRoot();
    const paths = vaultPaths(root);

    mkdirSync(paths.dossierSources, { recursive: true });
    mkdirSync(dirname(paths.dossierState), { recursive: true });

    const state = createInitialDossierState({
      market: opts.market,
      ticker: opts.ticker,
      companyName: opts.companyName,
      cik: opts.cik,
      exchange: opts.exchange,
    });

    saveDossierState(paths.dossierState, state);
    console.log(`Initialized dossier state for ${opts.ticker}`);
  });

dossierCommand
  .command('refresh-state')
  .description('Backfill dossier-state material metadata and checkpoints from tracked source files')
  .action(() => {
    const root = requireVaultRoot();
    const paths = vaultPaths(root);
    if (!existsSync(paths.dossierState)) {
      throw new Error('dossier state does not exist; run dossier init first');
    }

    const state = readDossierState(paths.dossierState);
    const result = refreshDossierStateFromTrackedSources(state);
    saveDossierState(paths.dossierState, state);

    console.log(`Refreshed materials: ${result.refreshed}`);
    if (result.missing.length > 0) {
      console.log(`Missing tracked files: ${result.missing.length}`);
      for (const filePath of result.missing) {
        console.log(`  ${relative(root, filePath).split(sep).join('/')}`);
      }
    }
  });

dossierCommand
  .command('apply')
  .description('Materialize a reviewed dossier manifest into the current vault')
  .argument('<manifest>', 'path to reviewed dossier manifest json')
  .option('--run-id <id>', 'stable dossier run id for audit records')
  .action(async (manifestPath: string, opts: { runId?: string }) => {
    const root = requireVaultRoot();
    const manifest = loadDossierManifest(manifestPath);
    const result = await applyManifest(root, manifest, { runId: opts.runId });

    console.log(`Created: ${result.created.length}`);
    console.log(`Skipped duplicates: ${result.skippedDuplicates.length}`);
    console.log(`Unresolved: ${result.unresolved.length}`);
    console.log(`Run: ${relative(root, result.runDir).split(sep).join('/')}`);
  });

dossierCommand
  .command('status')
  .description('Show official source coverage and unresolved summary')
  .action(() => {
    const root = requireVaultRoot();
    const paths = vaultPaths(root);
    const summary = summarizeDossier(paths.dossierSources);
    const unresolvedCount = countUnresolvedFiles(paths.dossierUnresolved);

    if (existsSync(paths.dossierState)) {
      const state = JSON.parse(readFileSync(paths.dossierState, 'utf-8')) as Partial<DossierState>;
      if (state.ticker || state.companyName) {
        console.log(`Dossier: ${state.ticker ?? 'unknown'}${state.companyName ? ` — ${state.companyName}` : ''}`);
      }
      if (state.market) {
        console.log(`Market: ${state.market}`);
      }
      if (state.updatedAt) {
        console.log(`State Updated: ${state.updatedAt}`);
      }
      if (state.checkpoints && Object.keys(state.checkpoints).length > 0) {
        console.log('');
        console.log('Checkpoints:');
        for (const [surface, checkpoint] of Object.entries(state.checkpoints).sort(([a], [b]) => a.localeCompare(b))) {
          const latest = checkpoint?.latestSecFilingDate ?? checkpoint?.latestPublished ?? 'unknown';
          console.log(`  ${surface}: ${latest}`);
        }
      }
      console.log('');
    }

    console.log(`Materials: ${summary.materialCount}`);
    console.log(`Disclosures: ${summary.disclosureCount}`);
    console.log(`Unresolved: ${unresolvedCount}`);
    if (summary.latestPublished) {
      console.log(`Latest Published: ${summary.latestPublished}`);
    }

    if (Object.keys(summary.byAuthority).length > 0) {
      console.log('');
      console.log('By Authority:');
      for (const [authority, count] of Object.entries(summary.byAuthority).sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`  ${authority}: ${count}`);
      }
    }

    if (Object.keys(summary.byDocumentType).length > 0) {
      console.log('');
      console.log('By Document Type:');
      for (const [documentType, count] of Object.entries(summary.byDocumentType).sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`  ${documentType}: ${count}`);
      }
    }
  });

dossierCommand
  .command('check')
  .description('Audit official source structure and required frontmatter')
  .action(() => {
    const root = requireVaultRoot();
    const paths = vaultPaths(root);
    const issues = auditDossier(paths.dossierSources);

    if (issues.length === 0) {
      console.log('Dossier check: OK');
      return;
    }

    console.log(`Dossier issues: ${issues.length}`);
    for (const issue of issues) {
      console.log(`- ${issue.type}: ${issue.path} — ${issue.detail}`);
    }
    process.exitCode = 1;
  });
