import { loadConfig } from "../config.js";
import { loadWikiPages } from "../lib/wiki.js";
import { buildBM25Index, hybridSearch } from "../lib/search.js";
import { buildGraph } from "../lib/graph.js";
import { createDb9Client, vectorSearch } from "../db.js";

interface SearchOptions {
  limit: string;
  format: string;
}

export async function searchCommand(
  query: string,
  options: SearchOptions
): Promise<void> {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);
  const limit = parseInt(options.limit, 10) || 10;

  const pages = loadWikiPages(projectDir);
  if (pages.length === 0) {
    console.log("No wiki pages found. Run ingest to add content.");
    return;
  }

  // Build BM25 index
  const bm25Index = buildBM25Index(pages);

  // Build graph for expansion
  const graph = buildGraph(pages, config);

  // Try vector search via DB9
  let vecScores: Map<string, number> | undefined;
  if (config.db9.enabled) {
    const client = await createDb9Client(projectDir);
    if (client) {
      try {
        vecScores = await vectorSearch(client, query, limit * 2);
      } catch {
        // Vector search not available, continue with BM25 + graph only
      }
      await client.close();
    }
  }

  // Hybrid search
  const results = hybridSearch(
    query,
    pages,
    bm25Index,
    graph,
    config,
    vecScores
  ).slice(0, limit);

  if (results.length === 0) {
    console.log(`No results found for: "${query}"`);
    return;
  }

  if (options.format === "json") {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Pretty print
  console.log(`\n🔍 Search results for: "${query}" (${results.length} results)\n`);
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(
      `  ${i + 1}. ${r.title} (${r.slug})`
    );
    console.log(
      `     Score: ${r.score.toFixed(4)} [BM25: ${r.scores.bm25.toFixed(3)}, Vec: ${r.scores.vector.toFixed(3)}, Graph: ${r.scores.graph.toFixed(3)}]`
    );
    if (r.snippet) {
      console.log(`     ${r.snippet.slice(0, 100)}...`);
    }
    console.log("");
  }
}
