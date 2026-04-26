import { Command } from 'commander';
import { requireVaultRoot } from '../lib/config.js';
import {
  listPendingSourceGroups,
  listPendingSourceGroupsForPath,
} from '../lib/source-ingest.js';

export const sourcesCommand = new Command('sources')
  .description('Inspect source ingest state');

sourcesCommand
  .command('pending')
  .description('List sources that have not been ingested')
  .argument('[path]', 'optional source file/directory or dossier run directory')
  .option('--all', 'include already-ingested clean sources')
  .option('--json', 'emit JSON')
  .action((inputPath: string | undefined, opts: { all?: boolean; json?: boolean }) => {
    const root = requireVaultRoot();
    const groups = inputPath
      ? listPendingSourceGroupsForPath(root, inputPath, Boolean(opts.all))
      : listPendingSourceGroups(root, Boolean(opts.all));

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
