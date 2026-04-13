import type { WikiPage } from "./wiki.js";
import type { KnowledgeGraph } from "./graph.js";
import type { WikiConfig } from "../config.js";

export interface SearchResult {
  slug: string;
  title: string;
  score: number;
  scores: {
    bm25: number;
    vector: number;
    graph: number;
  };
  snippet: string;
}

// ─── BM25 Implementation ────────────────────────────────────────────

const k1 = 1.2;
const b = 0.75;

/**
 * Tokenize text for BM25, with CJK bigram support.
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const normalized = text.toLowerCase();

  // Split on whitespace and punctuation for Latin text
  const latinTokens = normalized.match(/[a-z0-9_]+/g) || [];
  tokens.push(...latinTokens);

  // CJK bigram tokenization
  const cjkChars = normalized.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  if (cjkChars && cjkChars.length >= 2) {
    // Also add individual CJK characters
    tokens.push(...cjkChars);
    // Add bigrams
    const cjkStr = cjkChars.join("");
    for (let i = 0; i < cjkStr.length - 1; i++) {
      tokens.push(cjkStr.slice(i, i + 2));
    }
  } else if (cjkChars) {
    tokens.push(...cjkChars);
  }

  return tokens;
}

export interface BM25Index {
  // term -> { slug -> term frequency }
  invertedIndex: Map<string, Map<string, number>>;
  // slug -> document length (in tokens)
  docLengths: Map<string, number>;
  // average document length
  avgDocLength: number;
  // total number of documents
  docCount: number;
}

/**
 * Build a BM25 inverted index from wiki pages.
 */
export function buildBM25Index(pages: WikiPage[]): BM25Index {
  const invertedIndex = new Map<string, Map<string, number>>();
  const docLengths = new Map<string, number>();
  let totalLength = 0;

  for (const page of pages) {
    const text = `${page.frontmatter.title || ""} ${page.frontmatter.description || ""} ${(page.frontmatter.tags || []).join(" ")} ${page.content}`;
    const tokens = tokenize(text);
    docLengths.set(page.slug, tokens.length);
    totalLength += tokens.length;

    // Count term frequencies
    const termFreq = new Map<string, number>();
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    for (const [term, freq] of termFreq) {
      if (!invertedIndex.has(term)) {
        invertedIndex.set(term, new Map());
      }
      invertedIndex.get(term)!.set(page.slug, freq);
    }
  }

  return {
    invertedIndex,
    docLengths,
    avgDocLength: pages.length > 0 ? totalLength / pages.length : 0,
    docCount: pages.length,
  };
}

/**
 * Search using BM25 scoring.
 */
export function searchBM25(
  query: string,
  index: BM25Index
): Map<string, number> {
  const queryTokens = tokenize(query);
  const scores = new Map<string, number>();

  for (const term of queryTokens) {
    const postings = index.invertedIndex.get(term);
    if (!postings) continue;

    // IDF
    const df = postings.size;
    const idf = Math.log(1 + (index.docCount - df + 0.5) / (df + 0.5));

    for (const [slug, tf] of postings) {
      const dl = index.docLengths.get(slug) || 0;
      const normalizedTf =
        (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / index.avgDocLength)));
      const score = idf * normalizedTf;

      scores.set(slug, (scores.get(slug) || 0) + score);
    }
  }

  return scores;
}

// ─── Graph Expansion ────────────────────────────────────────────────

/**
 * Expand search results by traversing the graph from hit nodes.
 */
export function graphExpand(
  hitSlugs: Set<string>,
  graph: KnowledgeGraph,
  hops: number = 1
): Map<string, number> {
  const scores = new Map<string, number>();
  let frontier = hitSlugs;

  for (let hop = 0; hop < hops; hop++) {
    const nextFrontier = new Set<string>();
    const decay = 1 / (hop + 2); // Diminishing weight with distance

    for (const slug of frontier) {
      const neighbors = graph.adjacency.get(slug);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (hitSlugs.has(neighbor)) continue; // Already a direct hit

        // Find edge weight
        const key =
          slug < neighbor ? `${slug}::${neighbor}` : `${neighbor}::${slug}`;
        const edge = graph.edges.get(key);
        const edgeWeight = edge ? edge.weight : 1;

        const score = edgeWeight * decay;
        scores.set(neighbor, Math.max(scores.get(neighbor) || 0, score));
        nextFrontier.add(neighbor);
      }
    }
    frontier = nextFrontier;
  }

  return scores;
}

// ─── Reciprocal Rank Fusion ─────────────────────────────────────────

const RRF_K = 60;

/**
 * Combine multiple ranked lists using Reciprocal Rank Fusion.
 */
export function reciprocalRankFusion(
  rankedLists: Array<{ scores: Map<string, number>; weight: number }>
): Map<string, number> {
  const fusedScores = new Map<string, number>();

  for (const { scores, weight } of rankedLists) {
    // Sort by score descending
    const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);

    for (let rank = 0; rank < sorted.length; rank++) {
      const [slug] = sorted[rank];
      const rrfScore = weight / (RRF_K + rank + 1);
      fusedScores.set(slug, (fusedScores.get(slug) || 0) + rrfScore);
    }
  }

  return fusedScores;
}

// ─── Hybrid Search ──────────────────────────────────────────────────

/**
 * Perform hybrid search combining BM25, vector, and graph signals.
 */
export function hybridSearch(
  query: string,
  pages: WikiPage[],
  bm25Index: BM25Index,
  graph: KnowledgeGraph | null,
  config: WikiConfig,
  vectorScores?: Map<string, number>
): SearchResult[] {
  // 1. BM25 search
  const bm25Scores = searchBM25(query, bm25Index);

  // 2. Vector search (passed in from DB9 if available)
  const vecScores = vectorScores || new Map<string, number>();

  // 3. Graph expansion from BM25 + vector hits
  let graphScores = new Map<string, number>();
  if (graph) {
    const hitSlugs = new Set([...bm25Scores.keys(), ...vecScores.keys()]);
    graphScores = graphExpand(hitSlugs, graph, 2);
  }

  // 4. Reciprocal Rank Fusion
  const rankedLists = [
    { scores: bm25Scores, weight: config.search.bm25_weight },
  ];

  if (vecScores.size > 0) {
    rankedLists.push({ scores: vecScores, weight: config.search.vector_weight });
  }

  if (graphScores.size > 0) {
    rankedLists.push({
      scores: graphScores,
      weight: config.search.graph_weight,
    });
  }

  const fusedScores = reciprocalRankFusion(rankedLists);

  // Build results
  const pageMap = new Map(pages.map((p) => [p.slug, p]));
  const results: SearchResult[] = [];

  for (const [slug, score] of fusedScores) {
    const page = pageMap.get(slug);
    if (!page) continue;

    // Generate snippet (first 200 chars of content)
    const snippet = page.content
      .replace(/^#+\s+.*$/m, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 200);

    results.push({
      slug,
      title: page.frontmatter.title || slug,
      score,
      scores: {
        bm25: bm25Scores.get(slug) || 0,
        vector: vecScores.get(slug) || 0,
        graph: graphScores.get(slug) || 0,
      },
      snippet,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
