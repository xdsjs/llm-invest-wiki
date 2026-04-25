import { existsSync, readdirSync, mkdirSync, copyFileSync, cpSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function getSkillsDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  let packageRoot = dirname(currentFile);

  while (true) {
    if (existsSync(join(packageRoot, 'package.json')) && existsSync(join(packageRoot, 'skills'))) {
      break;
    }

    const parent = dirname(packageRoot);
    if (parent === packageRoot) {
      throw new Error('Package root not found while resolving skills directory.');
    }
    packageRoot = parent;
  }

  return join(packageRoot, 'skills');
}

export interface SkillEntry {
  name: string;
  type: 'file' | 'bundle';
  sourcePath: string;
  mainPath: string;
}

export function listSkillEntries(skillsDir: string): SkillEntry[] {
  return readdirSync(skillsDir)
    .sort()
    .flatMap(name => {
      const path = join(skillsDir, name);
      const stat = statSync(path);

      if (stat.isFile() && name.endsWith('.md')) {
        return [{
          name: name.replace(/\.md$/, ''),
          type: 'file' as const,
          sourcePath: path,
          mainPath: path,
        }];
      }

      if (stat.isDirectory()) {
        const mainPath = join(path, 'SKILL.md');
        if (existsSync(mainPath)) {
          return [{
            name,
            type: 'bundle' as const,
            sourcePath: path,
            mainPath,
          }];
        }
      }

      return [];
    });
}

export function listSkills(skillsDir: string): string[] {
  return listSkillEntries(skillsDir).map(entry => entry.name);
}

export function getSkillEntry(skillsDir: string, name: string): SkillEntry | null {
  return listSkillEntries(skillsDir).find(entry => entry.name === name) ?? null;
}

export interface InstallResult {
  installed: string[];
  skipped: string[];
}

const RENAMED_SKILL_DESTINATIONS: Record<string, string[]> = {
  'invest-wiki-flow': ['llm-wiki-invest', 'llm-wiki-invest.md'],
};

export function installSkillsTo(targetDir: string, overwrite = true): InstallResult {
  const skillsDir = getSkillsDir();
  if (!existsSync(skillsDir)) {
    throw new Error('Skills directory not found. Package may be corrupted.');
  }
  mkdirSync(targetDir, { recursive: true });
  const entries = listSkillEntries(skillsDir);
  const installed: string[] = [];
  const skipped: string[] = [];

  for (const entry of entries) {
    const dest = entry.type === 'file'
      ? join(targetDir, `${entry.name}.md`)
      : join(targetDir, entry.name);
    const alternateDest = entry.type === 'file'
      ? join(targetDir, entry.name)
      : join(targetDir, `${entry.name}.md`);

    if (!overwrite && (existsSync(dest) || existsSync(alternateDest))) {
      skipped.push(entry.name);
      continue;
    }

    if (overwrite) {
      for (const legacyName of RENAMED_SKILL_DESTINATIONS[entry.name] ?? []) {
        const legacyDest = join(targetDir, legacyName);
        if (legacyDest !== dest && existsSync(legacyDest)) {
          rmSync(legacyDest, { recursive: true, force: true });
        }
      }
    }

    if (overwrite && existsSync(alternateDest)) {
      rmSync(alternateDest, { recursive: true, force: true });
    }

    if (entry.type === 'file') {
      copyFileSync(entry.sourcePath, dest);
    } else {
      if (existsSync(dest)) {
        rmSync(dest, { recursive: true, force: true });
      }
      cpSync(entry.sourcePath, dest, { recursive: true });
    }

    installed.push(entry.name);
  }

  return { installed, skipped };
}
