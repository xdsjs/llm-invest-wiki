import { describe, it, expect } from "vitest";
import { buildGraph, findHubs, findStrongestEdges } from "../src/lib/graph.js";
import { detectCommunities } from "../src/lib/community.js";
import { generateInsights } from "../src/lib/insights.js";
import { extractWikilinks, type WikiPage } from "../src/lib/wiki.js";
import { contentHash } from "../src/utils/hash.js";
import type { WikiConfig } from "../src/config.js";

const defaultConfig: WikiConfig = {
  wiki: { name: "Test", language: "en", template: "general" },
  db9: { enabled: false },
  search: { bm25_weight: 1.0, vector_weight: 1.0, graph_weight: 0.5 },
  graph: {
    direct_link_weight: 3.0,
    source_overlap_weight: 4.0,
    adamic_adar_weight: 1.5,
    type_affinity_weight: 1.0,
    community_cohesion_threshold: 0.15,
  },
};

describe("buildGraph", () => {
  it("creates nodes for all pages", () => {
    const pages = [makePage("a", "A"), makePage("b", "B")];
    const graph = buildGraph(pages, defaultConfig);
    expect(graph.nodes.size).toBe(2);
  });

  it("creates edges from direct wikilinks", () => {
    const pages = [
      makePage("a", "A", "Link to [[b]]."),
      makePage("b", "B", "Link to [[a]]."),
    ];
    const graph = buildGraph(pages, defaultConfig);
    expect(graph.edges.size).toBeGreaterThan(0);

    // Find the edge
    const edge = [...graph.edges.values()][0];
    expect(edge.signals.directLink).toBeGreaterThan(0);
  });

  it("creates edges from source overlap", () => {
    const pages = [
      makePage("a", "A", "", { sources: ["src1.md"] }),
      makePage("b", "B", "", { sources: ["src1.md"] }),
    ];
    const graph = buildGraph(pages, defaultConfig);
    expect(graph.edges.size).toBeGreaterThan(0);

    const edge = [...graph.edges.values()][0];
    expect(edge.signals.sourceOverlap).toBeGreaterThan(0);
  });

  it("applies type affinity", () => {
    const pages = [
      makePage("a", "A", "", { page_type: "concept" }),
      makePage("b", "B", "", { page_type: "concept" }),
    ];
    const graph = buildGraph(pages, defaultConfig);

    const edge = [...graph.edges.values()].find(
      (e) => e.signals.typeAffinity > 0
    );
    expect(edge).toBeDefined();
  });

  it("handles empty wiki", () => {
    const graph = buildGraph([], defaultConfig);
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges.size).toBe(0);
  });
});

describe("findHubs", () => {
  it("returns nodes sorted by degree", () => {
    const pages = [
      makePage("center", "Center", "Link to [[a]] and [[b]] and [[c]]."),
      makePage("a", "A", "Link to [[center]]."),
      makePage("b", "B", "Link to [[center]]."),
      makePage("c", "C", "Link to [[center]]."),
    ];
    const graph = buildGraph(pages, defaultConfig);
    const hubs = findHubs(graph, 2);
    expect(hubs[0].slug).toBe("center");
  });
});

describe("detectCommunities", () => {
  it("detects communities", () => {
    const pages = [
      makePage("a1", "A1", "Link to [[a2]]."),
      makePage("a2", "A2", "Link to [[a1]]."),
      makePage("b1", "B1", "Link to [[b2]]."),
      makePage("b2", "B2", "Link to [[b1]]."),
    ];
    const graph = buildGraph(pages, defaultConfig);
    const result = detectCommunities(graph);

    expect(result.communities.length).toBeGreaterThanOrEqual(2);
    expect(result.assignments.size).toBe(4);
  });

  it("handles empty graph", () => {
    const graph = buildGraph([], defaultConfig);
    const result = detectCommunities(graph);
    expect(result.communities).toHaveLength(0);
    expect(result.modularity).toBe(0);
  });

  it("handles single node", () => {
    const pages = [makePage("alone", "Alone")];
    const graph = buildGraph(pages, defaultConfig);
    const result = detectCommunities(graph);
    expect(result.communities).toHaveLength(1);
  });
});

describe("generateInsights", () => {
  it("detects orphan pages", () => {
    const pages = [
      makePage("connected", "Connected", "Link to [[other]]."),
      makePage("other", "Other", "Link to [[connected]]."),
      makePage("orphan", "Orphan", ""),
    ];
    const graph = buildGraph(pages, defaultConfig);
    const communities = detectCommunities(graph);
    const insights = generateInsights(graph, communities, defaultConfig);

    const orphanInsight = insights.find(
      (i) => i.type === "knowledge_gap" && i.relatedNodes.includes("orphan")
    );
    expect(orphanInsight).toBeDefined();
  });
});

function makePage(
  slug: string,
  title: string,
  content: string = "",
  fm?: Record<string, unknown>
): WikiPage {
  return {
    slug,
    path: `wiki/${slug}.md`,
    relativePath: `${slug}.md`,
    frontmatter: {
      title,
      description: "Test",
      tags: ["test"],
      ...fm,
    },
    content,
    raw: "",
    hash: contentHash(content),
    wikilinks: extractWikilinks(content),
    mtime: Date.now(),
  };
}
