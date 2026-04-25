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
    expect(skills).toContain('llm-wiki-invest');
    expect(skills).toContain('invest-wiki-dossier');
    expect(skills).toContain('invest-wiki-ingest');
  });

  it('should resolve bundled skills to their SKILL.md entry point', () => {
    const entry = getSkillEntry(getSkillsDir(), 'invest-wiki-dossier');
    expect(entry).not.toBeNull();
    expect(entry?.type).toBe('bundle');
    expect(entry?.mainPath.endsWith('skills/invest-wiki-dossier/SKILL.md')).toBe(true);
  });

  it('should install bundled skill assets recursively', () => {
    const { installed } = installSkillsTo(testDir);

    expect(installed).toContain('invest-wiki-dossier');
    expect(installed).toContain('invest-wiki-ingest');
    expect(existsSync(join(testDir, 'llm-wiki-invest.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-dossier', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-dossier', 'agents', 'openai.yaml'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-dossier', 'template', 'us.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-ingest', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(testDir, 'invest-wiki-ingest', 'template', 'listed-company-plan.md'))).toBe(true);
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
});
