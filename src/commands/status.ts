import { loadConfig } from "../config.js";
import {
  loadWikiPages,
  loadSourceFiles,
  findBrokenLinks,
  findAmbiguousLinks,
  findOrphanPages,
  findMissingFrontmatter,
  findDuplicateFilenames,
} from "../lib/wiki.js";

interface StatusOptions {
  json?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);

  const pages = loadWikiPages(projectDir);
  const sources = loadSourceFiles(projectDir);

  // Health checks
  const brokenLinks = findBrokenLinks(pages);
  const ambiguousLinks = findAmbiguousLinks(pages);
  const orphanPages = findOrphanPages(pages);
  const missingFrontmatter = findMissingFrontmatter(pages);
  const duplicateFilenames = findDuplicateFilenames(pages);

  // Collect all tags
  const allTags = new Map<string, number>();
  for (const page of pages) {
    for (const tag of page.frontmatter.tags || []) {
      allTags.set(tag, (allTags.get(tag) || 0) + 1);
    }
  }

  // Collect page types
  const pageTypes = new Map<string, number>();
  for (const page of pages) {
    const type = page.frontmatter.page_type || "untyped";
    pageTypes.set(type, (pageTypes.get(type) || 0) + 1);
  }

  // Total wikilinks
  let totalLinks = 0;
  for (const page of pages) {
    totalLinks += page.wikilinks.length;
  }

  const status = {
    wiki: {
      name: config.wiki.name,
      template: config.wiki.template,
      language: config.wiki.language,
    },
    statistics: {
      pages: pages.length,
      sources: sources.length,
      wikilinks: totalLinks,
      tags: allTags.size,
      pageTypes: Object.fromEntries(pageTypes),
      tagDistribution: Object.fromEntries(
        [...allTags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
      ),
    },
    issues: {
      brokenLinks: brokenLinks.map((bl) => ({
        page: bl.page.slug,
        link: bl.link,
      })),
      ambiguousLinks: ambiguousLinks.map((al) => ({
        page: al.page.slug,
        link: al.link,
        matches: al.matches.map((m) => m.slug),
      })),
      orphanPages: orphanPages.map((p) => p.slug),
      missingFrontmatter: missingFrontmatter.map((mf) => ({
        page: mf.page.slug,
        missing: mf.missing,
      })),
      duplicateFilenames: Object.fromEntries(
        [...duplicateFilenames.entries()].map(([name, group]) => [
          name,
          group.map((p) => p.slug),
        ])
      ),
    },
    health: {
      brokenLinksCount: brokenLinks.length,
      ambiguousLinksCount: ambiguousLinks.length,
      orphanPagesCount: orphanPages.length,
      missingFrontmatterCount: missingFrontmatter.length,
      duplicateFilenamesCount: duplicateFilenames.size,
      totalIssues:
        brokenLinks.length +
        ambiguousLinks.length +
        orphanPages.length +
        missingFrontmatter.length +
        duplicateFilenames.size,
    },
  };

  if (options.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  // Pretty print
  console.log(`\n📊 ${config.wiki.name} — Status\n`);
  console.log("─── Statistics ───");
  console.log(`  Pages:     ${pages.length}`);
  console.log(`  Sources:   ${sources.length}`);
  console.log(`  Wikilinks: ${totalLinks}`);
  console.log(`  Tags:      ${allTags.size}`);

  if (pageTypes.size > 0) {
    console.log("\n  Page types:");
    for (const [type, count] of pageTypes) {
      console.log(`    ${type}: ${count}`);
    }
  }

  if (allTags.size > 0) {
    console.log("\n  Top tags:");
    const topTags = [...allTags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    for (const [tag, count] of topTags) {
      console.log(`    ${tag}: ${count}`);
    }
  }

  console.log("\n─── Health ───");

  const totalIssues = status.health.totalIssues;
  if (totalIssues === 0) {
    console.log("  ✓ No issues found!");
  } else {
    console.log(`  ⚠ ${totalIssues} issue(s) found:\n`);

    if (brokenLinks.length > 0) {
      console.log(`  🔗 Broken links (${brokenLinks.length}):`);
      for (const bl of brokenLinks) {
        console.log(`    ${bl.page.slug} → [[${bl.link}]]`);
      }
    }

    if (ambiguousLinks.length > 0) {
      console.log(`\n  🔀 Ambiguous links (${ambiguousLinks.length}):`);
      for (const al of ambiguousLinks) {
        console.log(
          `    ${al.page.slug} → [[${al.link}]] matches: ${al.matches.map((m) => m.slug).join(", ")}`
        );
      }
    }

    if (orphanPages.length > 0) {
      console.log(`\n  🏝 Orphan pages (${orphanPages.length}):`);
      for (const p of orphanPages) {
        console.log(`    ${p.slug}`);
      }
    }

    if (missingFrontmatter.length > 0) {
      console.log(
        `\n  📝 Missing frontmatter (${missingFrontmatter.length}):`
      );
      for (const mf of missingFrontmatter) {
        console.log(`    ${mf.page.slug}: missing ${mf.missing.join(", ")}`);
      }
    }

    if (duplicateFilenames.size > 0) {
      console.log(`\n  📋 Duplicate filenames (${duplicateFilenames.size}):`);
      for (const [name, group] of duplicateFilenames) {
        console.log(`    ${name}: ${group.map((p) => p.slug).join(", ")}`);
      }
    }
  }

  console.log("");
}
