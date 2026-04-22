import { Command } from 'commander';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { requireVaultRoot, vaultPaths } from '../lib/config.js';
import { loadDossierManifest } from '../lib/dossier.js';
import type { DossierState } from '../lib/dossier.js';
import { applyManifest } from '../lib/dossier-apply.js';

export const dossierCommand = new Command('dossier')
  .description('Manage read-only dossier materials');

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

    mkdirSync(paths.dossier, { recursive: true });
    mkdirSync(dirname(paths.dossierState), { recursive: true });

    const state: DossierState = {
      market: opts.market,
      ticker: opts.ticker,
      companyName: opts.companyName,
      cik: opts.cik ?? null,
      exchange: opts.exchange ?? null,
      template: opts.market,
      initializedAt: new Date().toISOString(),
      materials: {},
    };

    writeFileSync(paths.dossierState, JSON.stringify(state, null, 2));
    console.log(`Initialized dossier state for ${opts.ticker}`);
  });

dossierCommand
  .command('apply')
  .description('Materialize a reviewed dossier manifest into the current vault')
  .argument('<manifest>', 'path to reviewed dossier manifest json')
  .action(async (manifestPath: string) => {
    const root = requireVaultRoot();
    const manifest = loadDossierManifest(manifestPath);
    const result = await applyManifest(root, manifest);

    console.log(`Created: ${result.created.length}`);
    console.log(`Skipped duplicates: ${result.skippedDuplicates.length}`);
    console.log(`Unresolved: ${result.unresolved.length}`);
  });
