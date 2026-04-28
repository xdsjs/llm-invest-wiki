import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findVaultRoot, vaultPaths } from '../lib/config.js';
import { installSkillsTo } from '../lib/skills.js';
import { CLAUDE_MD_TEMPLATE } from '../template/CLAUDE.md.js';
import { AGENTS_MD_TEMPLATE } from '../template/AGENTS.md.js';
import { CONFIG_TEMPLATE } from '../template/config.toml.js';
import { agentTemplate } from '../template/wiki-agent.md.js';
import { LOG_TEMPLATE } from '../template/wiki-log.md.js';
import { PURPOSE_TEMPLATE } from '../template/wiki-purpose.md.js';
import { SCHEMA_TEMPLATE } from '../template/wiki-schema.md.js';

export const initCommand = new Command('init')
  .description('Initialize a new llm-wiki-invest vault')
  .argument('[directory]', 'directory to initialize', '.')
  .action((directory: string) => {
    const targetDir = join(process.cwd(), directory);

    // Check if already initialized
    if (findVaultRoot(targetDir)) {
      console.error('Error: This directory is already inside an llm-wiki-invest vault.');
      process.exit(1);
    }

    const paths = vaultPaths(targetDir);

    // Create directories
    mkdirSync(paths.wiki, { recursive: true });
    mkdirSync(paths.wikiRight, { recursive: true });
    mkdirSync(paths.sources, { recursive: true });
    mkdirSync(paths.llmWikiDir, { recursive: true });
    mkdirSync(paths.ingestPlans, { recursive: true });
    mkdirSync(paths.dossierRuns, { recursive: true });

    // Install skills first (before vault marker) so a failure here leaves
    // the dir in a re-runnable state instead of half-initialized.
    // overwrite=false so a user's customized skill file is preserved.
    const claudeSkills = installSkillsTo(paths.claudeSkillsDir, false);
    const agentsSkills = installSkillsTo(paths.agentsSkillsDir, false);

    // Create files (only if they don't exist)
    const filesToCreate: [string, string][] = [
      [paths.purpose, PURPOSE_TEMPLATE],
      [paths.schema, SCHEMA_TEMPLATE],
      [paths.agent, agentTemplate()],
      [paths.config, CONFIG_TEMPLATE],
      [paths.log, LOG_TEMPLATE],
      [paths.claudeMd, CLAUDE_MD_TEMPLATE],
      [paths.agentsMd, AGENTS_MD_TEMPLATE],
    ];

    for (const [path, content] of filesToCreate) {
      if (!existsSync(path)) {
        writeFileSync(path, content);
      }
    }

    const skillSummary = (r: { installed: string[]; skipped: string[] }) => {
      const parts: string[] = [];
      if (r.installed.length) parts.push(`${r.installed.length} installed`);
      if (r.skipped.length) parts.push(`${r.skipped.length} kept`);
      return parts.join(', ') || 'no skills';
    };

    console.log(`Initialized llm-wiki-invest vault in ${targetDir}`);
    console.log('');
    console.log('Created:');
    console.log('  wiki/            — AI-maintained wiki pages');
    console.log('  wiki/right/      — Human-facing investment judgment pages');
    console.log('  sources/         — Read-only source documents and official dossier materials');
    console.log('  wiki-purpose.md  — Wiki purpose and scope');
    console.log('  wiki-schema.md   — Page conventions and structure');
    console.log('  wiki-agent.md    — Agent identity and ingest rules');
    console.log('  wiki-log.md      — Change log');
    console.log('  .llm-wiki-invest/ingest-plans/ — Agent-authored ingest plans');
    console.log('  .llm-wiki-invest/dossier-runs/ — Dossier run records');
    console.log('  CLAUDE.md        — Agent bootstrap (Claude Code)');
    console.log('  AGENTS.md        — Agent bootstrap (Codex)');
    console.log('  .llm-wiki-invest/ — Config and state');
    console.log(`  .claude/skills/  — ${skillSummary(claudeSkills)}`);
    console.log(`  .agents/skills/  — ${skillSummary(agentsSkills)}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Edit wiki-purpose.md to define your wiki\'s scope');
    console.log('  2. Edit wiki-schema.md to set naming conventions');
    console.log('  3. Use your AI agent with /ingest to start building the wiki');
    console.log('');
    console.log('To upgrade skills later: `llm-wiki-invest skill install`');
  });
