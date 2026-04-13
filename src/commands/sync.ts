import { loadConfig } from "../config.js";
import { loadWikiPages, loadSourceFiles } from "../lib/wiki.js";
import { loadSyncState, saveSyncState, type SyncState } from "../lib/sync-state.js";
import {
  createDb9Client,
  initDb9Schema,
  upsertWikiPage,
  deleteWikiPage,
  updatePageSources,
  type Db9Client,
} from "../db.js";

interface SyncOptions {
  full?: boolean;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);

  if (!config.db9.enabled) {
    console.log(
      "DB9 is not enabled. Set db9.enabled = true in llm-wiki.toml to use sync."
    );
    return;
  }

  const client = await createDb9Client(projectDir);
  if (!client) {
    console.error("Failed to connect to DB9.");
    process.exit(1);
  }

  try {
    // Ensure schema exists
    await initDb9Schema(client);

    const pages = loadWikiPages(projectDir);
    const sources = loadSourceFiles(projectDir);
    const prevState = loadSyncState(projectDir);
    const isFullSync = options.full || !prevState.lastSyncAt;

    console.log(
      `\n🔄 ${isFullSync ? "Full" : "Incremental"} sync to DB9...\n`
    );

    let upserted = 0;
    let deleted = 0;
    let skipped = 0;

    // Determine which pages changed
    const currentSlugs = new Set(pages.map((p) => p.slug));

    for (const page of pages) {
      const prev = prevState.wikiFiles[page.relativePath];

      if (
        !isFullSync &&
        prev &&
        prev.hash === page.hash &&
        prev.mtime === page.mtime
      ) {
        skipped++;
        continue;
      }

      await upsertWikiPage(
        client,
        page.slug,
        page.frontmatter.title || page.slug,
        page.frontmatter.description || "",
        page.frontmatter.page_type || "",
        page.hash,
        page.frontmatter.tags || [],
        (page.frontmatter.sources || []).length,
        page.content
      );

      // Update page-source relationships
      if (page.frontmatter.sources) {
        await updatePageSources(client, page.slug, page.frontmatter.sources);
      }

      upserted++;
    }

    // Delete pages that no longer exist locally
    const prevSlugs = new Set(
      Object.keys(prevState.wikiFiles).map((p) =>
        p.replace(/\.md$/, "").replace(/\\/g, "/").replace(/\s+/g, "-").toLowerCase()
      )
    );

    for (const slug of prevSlugs) {
      if (!currentSlugs.has(slug)) {
        await deleteWikiPage(client, slug);
        deleted++;
      }
    }

    // Save sync state
    const newState: SyncState = {
      lastSyncAt: new Date().toISOString(),
      wikiFiles: {},
      sourceFiles: {},
    };

    for (const page of pages) {
      newState.wikiFiles[page.relativePath] = {
        hash: page.hash,
        mtime: page.mtime,
      };
    }

    for (const source of sources) {
      newState.sourceFiles[source.relativePath] = {
        mtime: source.mtime,
      };
    }

    saveSyncState(projectDir, newState);

    console.log(`  Upserted: ${upserted}`);
    console.log(`  Deleted:  ${deleted}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`\n✓ Sync complete.`);
  } finally {
    await client.close();
  }
}
