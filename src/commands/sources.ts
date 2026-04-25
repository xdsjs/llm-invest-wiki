import { Command } from 'commander';
import { requireVaultRoot } from '../lib/config.js';
import {
  listPendingSourceGroups,
  markSourcesIngested,
} from '../lib/source-ingest.js';

function parsePages(pages: string): string[] {
  return pages
    .split(',')
    .map(page => page.trim())
    .filter(Boolean);
}

export const sourcesCommand = new Command('sources')
  .description('Inspect and mark source ingest state');

sourcesCommand
  .command('pending')
  .description('List sources that have not been ingested or have changed since ingest')
  .option('--all', 'include already-ingested clean sources')
  .option('--json', 'emit JSON')
  .action((opts: { all?: boolean; json?: boolean }) => {
    const root = requireVaultRoot();
    const groups = listPendingSourceGroups(root, Boolean(opts.all));

    if (opts.json) {
      console.log(JSON.stringify({ groups }, null, 2));
      return;
    }

    const sourceCount = groups.reduce((sum, group) => sum + group.sources.length, 0);
    if (sourceCount === 0) {
      console.log('No pending sources.');
      return;
    }

    console.log(`Pending sources: ${sourceCount}`);
    console.log('');
    for (const group of groups) {
      console.log(group.path);
      for (const source of group.sources) {
        const summaryParts = [
          source.title,
          source.authority && source.documentType ? `${source.authority}/${source.documentType}` : '',
          source.published,
        ].filter(Boolean);
        const summary = summaryParts.length > 0 ? ` — ${summaryParts.join(' | ')}` : '';
        console.log(`  - ${source.path.split('/').pop()} [${source.status}]${summary}`);
      }
      console.log('');
    }
  });

sourcesCommand
  .command('mark-ingested')
  .description('Mark source files as ingested after the agent updates wiki pages')
  .argument('<paths...>', 'source file paths under sources/')
  .requiredOption('--pages <pages>', 'comma-separated wiki page paths created or updated from these sources')
  .action((inputPaths: string[], opts: { pages: string }) => {
    const root = requireVaultRoot();
    const pages = parsePages(opts.pages);
    if (pages.length === 0) {
      throw new Error('--pages must include at least one wiki page path');
    }

    const updated = markSourcesIngested(root, inputPaths, pages);
    console.log(`Marked ingested: ${updated.length}`);
    for (const source of updated) {
      console.log(`  ${source.path}`);
    }
  });
