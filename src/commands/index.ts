import { loadWikiPages } from "../lib/wiki.js";

interface IndexOptions {
  tag?: string;
  type?: string;
  format: string;
}

export async function indexCommand(options: IndexOptions): Promise<void> {
  const projectDir = process.cwd();
  let pages = loadWikiPages(projectDir);

  if (pages.length === 0) {
    console.log("No wiki pages found.");
    return;
  }

  // Apply filters
  if (options.tag) {
    pages = pages.filter((p) =>
      (p.frontmatter.tags || []).includes(options.tag!)
    );
  }

  if (options.type) {
    pages = pages.filter((p) => p.frontmatter.page_type === options.type);
  }

  // Sort by title
  pages.sort((a, b) =>
    (a.frontmatter.title || a.slug).localeCompare(
      b.frontmatter.title || b.slug
    )
  );

  if (options.format === "json") {
    const data = pages.map((p) => ({
      slug: p.slug,
      title: p.frontmatter.title || p.slug,
      description: p.frontmatter.description || "",
      tags: p.frontmatter.tags || [],
      page_type: p.frontmatter.page_type || "",
      sources: p.frontmatter.sources || [],
      wikilinks: p.wikilinks.length,
      updated: p.frontmatter.updated || "",
    }));
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Pretty print
  console.log(`\n📚 Wiki Index (${pages.length} pages)\n`);

  // Group by page type
  const groups = new Map<string, typeof pages>();
  for (const page of pages) {
    const type = page.frontmatter.page_type || "untyped";
    const arr = groups.get(type) || [];
    arr.push(page);
    groups.set(type, arr);
  }

  for (const [type, groupPages] of groups) {
    console.log(`─── ${type} (${groupPages.length}) ───`);
    for (const page of groupPages) {
      const title = page.frontmatter.title || page.slug;
      const tags = (page.frontmatter.tags || []).join(", ");
      const desc = page.frontmatter.description || "";
      console.log(`  ${title}`);
      console.log(`    slug: ${page.slug}`);
      if (desc) console.log(`    desc: ${desc}`);
      if (tags) console.log(`    tags: ${tags}`);
      console.log(`    links: ${page.wikilinks.length} | sources: ${(page.frontmatter.sources || []).length}`);
      console.log("");
    }
  }
}
