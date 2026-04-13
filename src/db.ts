import { loadConfig } from "./config.js";

// DB9 SQL schema for the wiki
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS wiki_index (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  page_type TEXT,
  content_hash TEXT NOT NULL,
  content_vec VECTOR(1024),
  tags TEXT[],
  source_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wiki_vec_idx ON wiki_index
  USING hnsw (content_vec vector_cosine_ops);

CREATE TABLE IF NOT EXISTS wiki_page_sources (
  page_slug TEXT REFERENCES wiki_index(slug) ON DELETE CASCADE,
  source_path TEXT NOT NULL,
  PRIMARY KEY (page_slug, source_path)
);

CREATE TABLE IF NOT EXISTS wiki_graph_edges (
  source_slug TEXT,
  target_slug TEXT,
  signal_type TEXT NOT NULL,
  weight REAL NOT NULL,
  PRIMARY KEY (source_slug, target_slug, signal_type)
);
`;

export interface Db9Client {
  sql(query: string): Promise<{ columns: string[]; rows: unknown[][] }>;
  close(): Promise<void>;
}

/**
 * Create a DB9 client using the get-db9 SDK.
 * Returns null if DB9 is not configured or unavailable.
 */
export async function createDb9Client(
  projectDir: string
): Promise<Db9Client | null> {
  const config = loadConfig(projectDir);
  if (!config.db9.enabled) return null;

  try {
    const { createDb9Client: create } = await import("get-db9");
    const client = create();

    // Get or create database
    let dbId: string;
    const dbName = config.db9.database || "llm-wiki";

    try {
      const dbs = await client.databases.list();
      const existing = dbs.find(
        (db: { name: string }) => db.name === dbName
      );
      if (existing) {
        dbId = existing.id;
      } else {
        const created = await client.databases.create({ name: dbName });
        dbId = created.id;
      }
    } catch (err) {
      console.error("Failed to connect to DB9:", err);
      return null;
    }

    return {
      async sql(query: string) {
        return client.databases.sql(dbId, query);
      },
      async close() {
        // No explicit close needed for HTTP-based client
      },
    };
  } catch (err) {
    console.error("DB9 SDK not available:", err);
    return null;
  }
}

/**
 * Initialize the DB9 schema.
 */
export async function initDb9Schema(client: Db9Client): Promise<void> {
  // Split and execute each statement separately
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await client.sql(stmt + ";");
  }
}

/**
 * Upsert a wiki page into the DB9 index.
 */
export async function upsertWikiPage(
  client: Db9Client,
  slug: string,
  title: string,
  description: string,
  pageType: string,
  contentHash: string,
  tags: string[],
  sourceCount: number,
  content: string
): Promise<void> {
  const escapedSlug = slug.replace(/'/g, "''");
  const escapedTitle = title.replace(/'/g, "''");
  const escapedDesc = description.replace(/'/g, "''");
  const escapedType = pageType.replace(/'/g, "''");
  const escapedContent = content.replace(/'/g, "''");
  const tagsArray = tags.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");

  await client.sql(`
    INSERT INTO wiki_index (slug, title, description, page_type, content_hash, content_vec, tags, source_count, updated_at)
    VALUES (
      '${escapedSlug}',
      '${escapedTitle}',
      '${escapedDesc}',
      '${escapedType}',
      '${contentHash}',
      embedding('${escapedTitle} ${escapedDesc} ${escapedContent}'),
      ARRAY[${tagsArray}]::TEXT[],
      ${sourceCount},
      NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      page_type = EXCLUDED.page_type,
      content_hash = EXCLUDED.content_hash,
      content_vec = EXCLUDED.content_vec,
      tags = EXCLUDED.tags,
      source_count = EXCLUDED.source_count,
      updated_at = NOW();
  `);
}

/**
 * Search wiki pages using vector similarity.
 */
export async function vectorSearch(
  client: Db9Client,
  query: string,
  limit: number = 10
): Promise<Map<string, number>> {
  const escapedQuery = query.replace(/'/g, "''");

  const result = await client.sql(`
    SELECT slug, 1 - (content_vec <=> embedding('${escapedQuery}')) AS similarity
    FROM wiki_index
    WHERE content_vec IS NOT NULL
    ORDER BY content_vec <=> embedding('${escapedQuery}')
    LIMIT ${limit};
  `);

  const scores = new Map<string, number>();
  for (const row of result.rows) {
    scores.set(row[0] as string, row[1] as number);
  }
  return scores;
}

/**
 * Delete a wiki page from the DB9 index.
 */
export async function deleteWikiPage(
  client: Db9Client,
  slug: string
): Promise<void> {
  const escapedSlug = slug.replace(/'/g, "''");
  await client.sql(
    `DELETE FROM wiki_index WHERE slug = '${escapedSlug}';`
  );
}

/**
 * Update page-source relationships.
 */
export async function updatePageSources(
  client: Db9Client,
  slug: string,
  sources: string[]
): Promise<void> {
  const escapedSlug = slug.replace(/'/g, "''");

  // Delete existing
  await client.sql(
    `DELETE FROM wiki_page_sources WHERE page_slug = '${escapedSlug}';`
  );

  // Insert new
  for (const src of sources) {
    const escapedSrc = src.replace(/'/g, "''");
    await client.sql(`
      INSERT INTO wiki_page_sources (page_slug, source_path)
      VALUES ('${escapedSlug}', '${escapedSrc}')
      ON CONFLICT DO NOTHING;
    `);
  }
}
