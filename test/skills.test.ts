import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getSkillEntry, getSkillsDir, installSkillsTo, listSkills } from '../src/lib/skills.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-skills-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('skills library', () => {
  it('should list flat skills and bundled skills together', () => {
    const skills = listSkills(getSkillsDir());
    expect(skills).toContain('invest-wiki-flow');
    expect(skills).toContain('invest-wiki-dossier');
    expect(skills).toContain('invest-wiki-ingest');
    expect(skills).toContain('invest-wiki-query');
    expect(skills).toContain('invest-wiki-lint');
    expect(skills).toContain('invest-wiki-research');
    expect(skills).toContain('invest-wiki-right-business');
    expect(skills).toContain('invest-wiki-right-people');
    expect(skills).toContain('invest-wiki-right-price');
  });

  it('should resolve bundled skills to their SKILL.md entry point', () => {
    const entry = getSkillEntry(getSkillsDir(), 'invest-wiki-dossier');
    expect(entry).not.toBeNull();
    expect(entry?.type).toBe('bundle');
    expect(entry?.mainPath.endsWith('skills/invest-wiki-dossier/SKILL.md')).toBe(true);

    const workflowEntry = getSkillEntry(getSkillsDir(), 'invest-wiki-flow');
    expect(workflowEntry).not.toBeNull();
    expect(workflowEntry?.type).toBe('bundle');
    expect(workflowEntry?.mainPath.endsWith('skills/invest-wiki-flow/SKILL.md')).toBe(true);
  });

  it('should install bundled skill assets recursively', () => {
    const { installed } = installSkillsTo(testDir);

    expect(installed).toContain('invest-wiki-dossier');
    expect(installed).toContain('invest-wiki-ingest');
    expect(installed).toContain('invest-wiki-query');
    expect(installed).toContain('invest-wiki-lint');
    expect(installed).toContain('invest-wiki-research');
    expect(installed).toContain('invest-wiki-right-business');
    expect(installed).toContain('invest-wiki-right-people');
    expect(installed).toContain('invest-wiki-right-price');
    expect(installed).toContain('invest-wiki-flow');
    expect(existsSync(join(testDir, 'llm-wiki-invest.md'))).toBe(false);
    expect(existsSync(join(testDir, 'llm-wiki-invest'))).toBe(false);
    expect(existsSync(join(testDir, 'invest-wiki-flow', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-flow', 'template', 'listed-company-ingest-plan.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-dossier', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-dossier', 'agents', 'openai.yaml'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-dossier', 'template', 'us.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-ingest', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-ingest', 'template', 'listed-company-plan.md'))).toBe(false);
    expect(existsSync(join(testDir, 'invest-wiki-query', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-lint', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-research', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-right-business', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-right-people', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-right-price', 'SKILL.md'))).toBe(true);
  });

  it('should not overwrite an existing bundled skill when overwrite is false', () => {
    const bundleDir = join(testDir, 'invest-wiki-dossier');
    mkdirSync(join(bundleDir, 'template'), { recursive: true });
    writeFileSync(join(bundleDir, 'SKILL.md'), '# custom dossier skill\n');
    writeFileSync(join(bundleDir, 'template', 'us.md'), 'custom template\n');

    const result = installSkillsTo(testDir, false);

    expect(result.skipped).toContain('invest-wiki-dossier');
    expect(readFileSync(join(bundleDir, 'SKILL.md'), 'utf-8')).toBe('# custom dossier skill\n');
    expect(readFileSync(join(bundleDir, 'template', 'us.md'), 'utf-8')).toBe('custom template\n');
  });

  it('should remove stale workflow skill names when installing the renamed bundle', () => {
    writeFileSync(join(testDir, 'llm-wiki-invest.md'), '# stale flat skill\n');
    mkdirSync(join(testDir, 'llm-wiki-invest'), { recursive: true });
    writeFileSync(join(testDir, 'llm-wiki-invest', 'SKILL.md'), '# stale bundled skill\n');

    installSkillsTo(testDir);

    expect(existsSync(join(testDir, 'llm-wiki-invest.md'))).toBe(false);
    expect(existsSync(join(testDir, 'llm-wiki-invest'))).toBe(false);
    expect(existsSync(join(testDir, 'invest-wiki-flow', 'SKILL.md'))).toBe(true);
  });
});
