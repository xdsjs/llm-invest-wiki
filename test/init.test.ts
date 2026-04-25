import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '..', 'dist', 'cli.js');
let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `llm-wiki-invest-init-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('init command', () => {
  it('should create vault structure', () => {
    execSync(`node ${CLI} init`, { cwd: testDir });
    expect(existsSync(join(testDir, 'wiki'))).toBe(true);
    expect(existsSync(join(testDir, 'dossier'))).toBe(false);
    expect(existsSync(join(testDir, 'sources'))).toBe(true);
    expect(existsSync(join(testDir, 'wiki-purpose.md'))).toBe(true);
    expect(existsSync(join(testDir, 'wiki-schema.md'))).toBe(true);
    expect(existsSync(join(testDir, 'wiki-log.md'))).toBe(true);
    expect(existsSync(join(testDir, '.llm-wiki-invest/config.toml'))).toBe(true);
    expect(existsSync(join(testDir, '.llm-wiki-invest/ingest-plans'))).toBe(true);
    expect(existsSync(join(testDir, '.llm-wiki-invest/dossier-runs'))).toBe(true);
    // v0.4.2 rename: old unprefixed names must not be created
    expect(existsSync(join(testDir, 'purpose.md'))).toBe(false);
    expect(existsSync(join(testDir, 'schema.md'))).toBe(false);
    expect(existsSync(join(testDir, 'log.md'))).toBe(false);
  });

  it('should generate agent bootstrap files', () => {
    execSync(`node ${CLI} init`, { cwd: testDir });
    expect(existsSync(join(testDir, 'CLAUDE.md'))).toBe(true);
    expect(existsSync(join(testDir, 'AGENTS.md'))).toBe(true);
  });

  it('should auto-install skills to both agent dirs', () => {
    execSync(`node ${CLI} init`, { cwd: testDir });
    const claudeSkill = join(testDir, '.claude/skills/invest-wiki-flow');
    const agentsSkill = join(testDir, '.agents/skills/invest-wiki-flow');
    const claudeDossier = join(testDir, '.claude/skills/invest-wiki-dossier');
    const agentsDossier = join(testDir, '.agents/skills/invest-wiki-dossier');
    const claudeIngest = join(testDir, '.claude/skills/invest-wiki-ingest');
    const agentsIngest = join(testDir, '.agents/skills/invest-wiki-ingest');
    const claudeQuery = join(testDir, '.claude/skills/invest-wiki-query');
    const agentsQuery = join(testDir, '.agents/skills/invest-wiki-query');
    const claudeLint = join(testDir, '.claude/skills/invest-wiki-lint');
    const agentsLint = join(testDir, '.agents/skills/invest-wiki-lint');
    const claudeResearch = join(testDir, '.claude/skills/invest-wiki-research');
    const agentsResearch = join(testDir, '.agents/skills/invest-wiki-research');
    expect(existsSync(join(claudeSkill, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(claudeSkill, 'template/listed-company-ingest-plan.md'))).toBe(true);
    expect(existsSync(join(agentsSkill, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(agentsSkill, 'template/listed-company-ingest-plan.md'))).toBe(true);
    expect(existsSync(join(testDir, '.claude/skills/llm-wiki-invest.md'))).toBe(false);
    expect(existsSync(join(testDir, '.agents/skills/llm-wiki-invest.md'))).toBe(false);
    expect(existsSync(join(testDir, '.claude/skills/llm-wiki-invest'))).toBe(false);
    expect(existsSync(join(testDir, '.agents/skills/llm-wiki-invest'))).toBe(false);
    expect(existsSync(join(claudeDossier, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(claudeDossier, 'agents/openai.yaml'))).toBe(true);
    expect(existsSync(join(claudeDossier, 'template/us.md'))).toBe(true);
    expect(existsSync(join(agentsDossier, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(agentsDossier, 'agents/openai.yaml'))).toBe(true);
    expect(existsSync(join(agentsDossier, 'template/us.md'))).toBe(true);
    expect(existsSync(join(claudeIngest, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(claudeIngest, 'template/listed-company-plan.md'))).toBe(false);
    expect(existsSync(join(agentsIngest, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(agentsIngest, 'template/listed-company-plan.md'))).toBe(false);
    expect(existsSync(join(claudeQuery, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(agentsQuery, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(claudeLint, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(agentsLint, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(claudeResearch, 'SKILL.md'))).toBe(true);
    expect(existsSync(join(agentsResearch, 'SKILL.md'))).toBe(true);
    // Content must match (not just empty file)
    const claudeContent = readFileSync(join(claudeSkill, 'SKILL.md'), 'utf-8');
    const agentsContent = readFileSync(join(agentsSkill, 'SKILL.md'), 'utf-8');
    expect(claudeContent.length).toBeGreaterThan(100);
    expect(claudeContent).toEqual(agentsContent);
  });

  it('should not clobber pre-existing customized skill files', () => {
    const claudeSkillDir = join(testDir, '.claude/skills');
    mkdirSync(claudeSkillDir, { recursive: true });
    const customContent = '# My Custom Skill\n\nDo not overwrite me.\n';
    writeFileSync(join(claudeSkillDir, 'llm-wiki-invest.md'), customContent);

    execSync(`node ${CLI} init`, { cwd: testDir });

    expect(readFileSync(join(claudeSkillDir, 'llm-wiki-invest.md'), 'utf-8')).toEqual(customContent);
    // Fresh dir still gets the bundled skill
    expect(existsSync(join(testDir, '.claude/skills/llm-wiki-invest'))).toBe(false);
    expect(existsSync(join(testDir, '.agents/skills/invest-wiki-flow/SKILL.md'))).toBe(true);
  });

  it('should not overwrite existing files', () => {
    execSync(`node ${CLI} init`, { cwd: testDir });
    // Should fail if already initialized
    expect(() => execSync(`node ${CLI} init`, { cwd: testDir, stdio: 'pipe' })).toThrow();
  });
});
