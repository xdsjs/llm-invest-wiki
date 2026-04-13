import type { WikiPage } from "./wiki.js";
import { resolveWikilink } from "./wiki.js";
import type { WikiConfig } from "../config.js";

export interface GraphNode {
  slug: string;
  title: string;
  pageType?: string;
  tags: string[];
  degree: number;
  community?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  signals: {
    directLink: number;
    sourceOverlap: number;
    adamicAdar: number;
    typeAffinity: number;
  };
}

export interface KnowledgeGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  adjacency: Map<string, Set<string>>;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

/**
 * Build the knowledge graph using the four-signal relevance model.
 */
export function buildGraph(
  pages: WikiPage[],
  config: WikiConfig
): KnowledgeGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const adjacency = new Map<string, Set<string>>();

  // Initialize nodes
  for (const page of pages) {
    nodes.set(page.slug, {
      slug: page.slug,
      title: page.frontmatter.title || page.slug,
      pageType: page.frontmatter.page_type,
      tags: page.frontmatter.tags || [],
      degree: 0,
    });
    adjacency.set(page.slug, new Set());
  }

  const weights = config.graph;

  // Signal 1: Direct links via [[wikilinks]]
  for (const page of pages) {
    for (const link of page.wikilinks) {
      const target = resolveWikilink(link, pages);
      if (target && target.slug !== page.slug) {
        const key = edgeKey(page.slug, target.slug);
        const edge = edges.get(key) || createEdge(page.slug, target.slug);
        edge.signals.directLink += weights.direct_link_weight;
        edges.set(key, edge);

        adjacency.get(page.slug)!.add(target.slug);
        adjacency.get(target.slug)!.add(page.slug);
      }
    }
  }

  // Signal 2: Source overlap — pages sharing the same source files
  const sourceToPages = new Map<string, string[]>();
  for (const page of pages) {
    const sources = page.frontmatter.sources || [];
    for (const src of sources) {
      const arr = sourceToPages.get(src) || [];
      arr.push(page.slug);
      sourceToPages.set(src, arr);
    }
  }

  for (const [, pageSlugs] of sourceToPages) {
    if (pageSlugs.length < 2) continue;
    for (let i = 0; i < pageSlugs.length; i++) {
      for (let j = i + 1; j < pageSlugs.length; j++) {
        const key = edgeKey(pageSlugs[i], pageSlugs[j]);
        const edge =
          edges.get(key) || createEdge(pageSlugs[i], pageSlugs[j]);
        edge.signals.sourceOverlap += weights.source_overlap_weight;
        edges.set(key, edge);

        adjacency.get(pageSlugs[i])!.add(pageSlugs[j]);
        adjacency.get(pageSlugs[j])!.add(pageSlugs[i]);
      }
    }
  }

  // Signal 3: Adamic-Adar — shared neighbors weighted by inverse log degree
  const slugs = [...nodes.keys()];
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = slugs[i];
      const b = slugs[j];
      const neighborsA = adjacency.get(a)!;
      const neighborsB = adjacency.get(b)!;

      let adamicAdar = 0;
      for (const common of neighborsA) {
        if (neighborsB.has(common)) {
          const degree = adjacency.get(common)!.size;
          if (degree > 1) {
            adamicAdar += 1 / Math.log2(degree);
          }
        }
      }

      if (adamicAdar > 0) {
        const key = edgeKey(a, b);
        const edge = edges.get(key) || createEdge(a, b);
        edge.signals.adamicAdar += adamicAdar * weights.adamic_adar_weight;
        edges.set(key, edge);

        adjacency.get(a)!.add(b);
        adjacency.get(b)!.add(a);
      }
    }
  }

  // Signal 4: Type affinity — same page_type bonus
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const a = nodes.get(slugs[i])!;
      const b = nodes.get(slugs[j])!;

      if (a.pageType && b.pageType && a.pageType === b.pageType) {
        const key = edgeKey(slugs[i], slugs[j]);
        const edge = edges.get(key) || createEdge(slugs[i], slugs[j]);
        edge.signals.typeAffinity += weights.type_affinity_weight;
        edges.set(key, edge);
      }
    }
  }

  // Compute final edge weights and node degrees
  for (const edge of edges.values()) {
    edge.weight =
      edge.signals.directLink +
      edge.signals.sourceOverlap +
      edge.signals.adamicAdar +
      edge.signals.typeAffinity;
  }

  // Compute degrees
  for (const [slug] of nodes) {
    const neighbors = adjacency.get(slug)!;
    nodes.get(slug)!.degree = neighbors.size;
  }

  return { nodes, edges, adjacency };
}

function createEdge(source: string, target: string): GraphEdge {
  return {
    source: source < target ? source : target,
    target: source < target ? target : source,
    weight: 0,
    signals: {
      directLink: 0,
      sourceOverlap: 0,
      adamicAdar: 0,
      typeAffinity: 0,
    },
  };
}

/**
 * Get the top-N most connected nodes (hubs).
 */
export function findHubs(graph: KnowledgeGraph, topN: number = 10): GraphNode[] {
  return [...graph.nodes.values()]
    .sort((a, b) => b.degree - a.degree)
    .slice(0, topN);
}

/**
 * Get the strongest edges in the graph.
 */
export function findStrongestEdges(
  graph: KnowledgeGraph,
  topN: number = 10
): GraphEdge[] {
  return [...graph.edges.values()]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

/**
 * Serialize graph to JSON-compatible format.
 */
export function graphToJSON(graph: KnowledgeGraph): {
  nodes: GraphNode[];
  edges: GraphEdge[];
} {
  return {
    nodes: [...graph.nodes.values()],
    edges: [...graph.edges.values()],
  };
}
