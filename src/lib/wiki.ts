import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename, extname } from "node:path";
import { parseFrontmatter, type ParsedPage, type Frontmatter } from "../utils/frontmatter.js";
import { contentHash } from "../utils/hash.js";

export interface WikiPage {
  slug: string;
  path: string;
  relativePath: string;
  frontmatter: Frontmatter;
  content: string;
  raw: string;
  hash: string;
  wikilinks: string[];
  mtime: number;
}

export interface SourceFile {
  path: string;
  relativePath: string;
  mtime: number;
  size: number;
}

// Match [[wikilink]] and [[wikilink|alias]]
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * Extract all wikilinks from markdown content.
 */
export function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(WIKILINK_RE.source, "g");
  while ((match = re.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return [...new Set(links)];
}

/**
 * Convert a wikilink target to a slug.
 * Uses the shortest unique filename form (Obsidian convention).
 */
export function wikilinkToSlug(link: string): string {
  // Remove .md extension if present
  const name = link.endsWith(".md") ? link.slice(0, -3) : link;
  // Convert path separators and spaces
  return name
    .replace(/\\/g, "/")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * Convert a file path to a slug.
 */
export function pathToSlug(relativePath: string): string {
  return relativePath
    .replace(/\.md$/, "")
    .replace(/\\/g, "/")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * Recursively collect all markdown files in a directory.
 */
export function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Recursively collect all files in a directory.
 */
export function collectAllFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAllFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Load all wiki pages from the wiki/ directory.
 */
export function loadWikiPages(projectDir: string): WikiPage[] {
  const wikiDir = join(projectDir, "wiki");
  const files = collectMarkdownFiles(wikiDir);

  return files.map((filePath) => {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = parseFrontmatter(raw);
    const relPath = relative(wikiDir, filePath);
    const stat = statSync(filePath);

    return {
      slug: pathToSlug(relPath),
      path: filePath,
      relativePath: relPath,
      frontmatter: parsed.frontmatter,
      content: parsed.content,
      raw,
      hash: contentHash(raw),
      wikilinks: extractWikilinks(parsed.content),
      mtime: stat.mtimeMs,
    };
  });
}

/**
 * Load all source files from the sources/ directory.
 */
export function loadSourceFiles(projectDir: string): SourceFile[] {
  const sourcesDir = join(projectDir, "sources");
  const files = collectAllFiles(sourcesDir);

  return files.map((filePath) => {
    const stat = statSync(filePath);
    return {
      path: filePath,
      relativePath: relative(sourcesDir, filePath),
      mtime: stat.mtimeMs,
      size: stat.size,
    };
  });
}

/**
 * Resolve a wikilink to a page slug.
 * Uses shortest unique match (Obsidian convention).
 */
export function resolveWikilink(
  link: string,
  pages: WikiPage[]
): WikiPage | undefined {
  const normalizedLink = link.toLowerCase().replace(/\s+/g, "-");

  // Exact slug match
  const exact = pages.find((p) => p.slug === normalizedLink);
  if (exact) return exact;

  // Basename match (shortest unique form)
  const baseLink = basename(normalizedLink);
  const matches = pages.filter(
    (p) => basename(p.slug) === baseLink
  );

  if (matches.length === 1) return matches[0];

  // Partial path match
  const partialMatches = pages.filter((p) => p.slug.endsWith(normalizedLink));
  if (partialMatches.length === 1) return partialMatches[0];

  return undefined;
}

/**
 * Find duplicate filenames across wiki pages.
 */
export function findDuplicateFilenames(pages: WikiPage[]): Map<string, WikiPage[]> {
  const nameMap = new Map<string, WikiPage[]>();
  for (const page of pages) {
    const name = basename(page.slug);
    const arr = nameMap.get(name) || [];
    arr.push(page);
    nameMap.set(name, arr);
  }

  const duplicates = new Map<string, WikiPage[]>();
  for (const [name, group] of nameMap) {
    if (group.length > 1) {
      duplicates.set(name, group);
    }
  }
  return duplicates;
}

/**
 * Find broken wikilinks (links that don't resolve to any page).
 */
export function findBrokenLinks(pages: WikiPage[]): Array<{ page: WikiPage; link: string }> {
  const broken: Array<{ page: WikiPage; link: string }> = [];
  for (const page of pages) {
    for (const link of page.wikilinks) {
      if (!resolveWikilink(link, pages)) {
        broken.push({ page, link });
      }
    }
  }
  return broken;
}

/**
 * Find ambiguous wikilinks (links that match multiple pages).
 */
export function findAmbiguousLinks(
  pages: WikiPage[]
): Array<{ page: WikiPage; link: string; matches: WikiPage[] }> {
  const ambiguous: Array<{ page: WikiPage; link: string; matches: WikiPage[] }> = [];
  for (const page of pages) {
    for (const link of page.wikilinks) {
      const normalizedLink = link.toLowerCase().replace(/\s+/g, "-");
      const baseLink = basename(normalizedLink);
      const matches = pages.filter((p) => basename(p.slug) === baseLink);
      if (matches.length > 1) {
        ambiguous.push({ page, link, matches });
      }
    }
  }
  return ambiguous;
}

/**
 * Find orphan pages (no incoming links and not referenced by any source).
 */
export function findOrphanPages(pages: WikiPage[]): WikiPage[] {
  const linkedSlugs = new Set<string>();
  for (const page of pages) {
    for (const link of page.wikilinks) {
      const target = resolveWikilink(link, pages);
      if (target) {
        linkedSlugs.add(target.slug);
      }
    }
  }

  return pages.filter(
    (p) =>
      !linkedSlugs.has(p.slug) &&
      // index and log are special pages, not orphans
      p.slug !== "index" &&
      p.slug !== "log"
  );
}

/**
 * Find pages missing required frontmatter fields.
 */
export function findMissingFrontmatter(
  pages: WikiPage[]
): Array<{ page: WikiPage; missing: string[] }> {
  const results: Array<{ page: WikiPage; missing: string[] }> = [];
  const requiredFields = ["title", "description", "tags"];

  for (const page of pages) {
    const missing: string[] = [];
    for (const field of requiredFields) {
      const value = page.frontmatter[field];
      if (value === undefined || value === null || value === "") {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      results.push({ page, missing });
    }
  }
  return results;
}
