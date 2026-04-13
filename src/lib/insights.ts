import type { KnowledgeGraph, GraphNode } from "./graph.js";
import type { CommunityResult } from "./community.js";
import type { WikiConfig } from "../config.js";

export interface Insight {
  type: "unexpected_connection" | "knowledge_gap" | "hub_node" | "low_cohesion" | "stale_page";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  relatedNodes: string[];
}

/**
 * Generate insights from the knowledge graph and community detection.
 */
export function generateInsights(
  graph: KnowledgeGraph,
  communityResult: CommunityResult,
  config: WikiConfig
): Insight[] {
  const insights: Insight[] = [];

  // 1. Unexpected connections: strong edges between different communities/types
  insights.push(...findUnexpectedConnections(graph, communityResult));

  // 2. Knowledge gaps: orphan pages, sparse communities, bridge nodes
  insights.push(...findKnowledgeGaps(graph, communityResult));

  // 3. Hub nodes: nodes with abnormally high degree (may need splitting)
  insights.push(...findHubNodes(graph));

  // 4. Low cohesion communities
  insights.push(
    ...findLowCohesionCommunities(
      communityResult,
      config.graph.community_cohesion_threshold
    )
  );

  return insights;
}

function findUnexpectedConnections(
  graph: KnowledgeGraph,
  communityResult: CommunityResult
): Insight[] {
  const insights: Insight[] = [];
  const { assignments } = communityResult;

  for (const edge of graph.edges.values()) {
    const commA = assignments.get(edge.source);
    const commB = assignments.get(edge.target);
    const nodeA = graph.nodes.get(edge.source)!;
    const nodeB = graph.nodes.get(edge.target)!;

    const crossCommunity = commA !== commB;
    const crossType =
      nodeA.pageType &&
      nodeB.pageType &&
      nodeA.pageType !== nodeB.pageType;

    if (crossCommunity && edge.weight > 3.0) {
      insights.push({
        type: "unexpected_connection",
        severity: "info",
        title: `Unexpected cross-community connection`,
        description: `"${nodeA.title}" (community ${commA}) and "${nodeB.title}" (community ${commB}) have a strong connection (weight: ${edge.weight.toFixed(1)})${crossType ? ` across different types (${nodeA.pageType} ↔ ${nodeB.pageType})` : ""}. This may reveal a hidden relationship worth exploring.`,
        relatedNodes: [edge.source, edge.target],
      });
    }
  }

  return insights;
}

function findKnowledgeGaps(
  graph: KnowledgeGraph,
  communityResult: CommunityResult
): Insight[] {
  const insights: Insight[] = [];

  // Orphan pages (degree 0)
  const orphans = [...graph.nodes.values()].filter(
    (n) => n.degree === 0 && n.slug !== "index" && n.slug !== "log"
  );
  if (orphans.length > 0) {
    insights.push({
      type: "knowledge_gap",
      severity: "warning",
      title: `${orphans.length} orphan page(s) with no connections`,
      description: `These pages have no links to or from other pages: ${orphans
        .map((n) => `"${n.title}"`)
        .join(", ")}. Consider linking them to related pages or investigating if they're still relevant.`,
      relatedNodes: orphans.map((n) => n.slug),
    });
  }

  // Bridge nodes (degree 1 connecting two communities)
  const bridges = [...graph.nodes.values()].filter((n) => n.degree === 1);
  for (const bridge of bridges) {
    const neighbor = [...(graph.adjacency.get(bridge.slug) || [])][0];
    if (neighbor) {
      const bridgeComm = communityResult.assignments.get(bridge.slug);
      const neighborComm = communityResult.assignments.get(neighbor);
      if (bridgeComm !== neighborComm) {
        insights.push({
          type: "knowledge_gap",
          severity: "info",
          title: `Bridge node between communities`,
          description: `"${bridge.title}" is the only connection between community ${bridgeComm} and community ${neighborComm}. Adding more cross-references would strengthen this link.`,
          relatedNodes: [bridge.slug, neighbor],
        });
      }
    }
  }

  // Sparse communities (small member count)
  for (const comm of communityResult.communities) {
    if (comm.members.length === 1) {
      const node = graph.nodes.get(comm.members[0])!;
      if (node.slug !== "index" && node.slug !== "log") {
        insights.push({
          type: "knowledge_gap",
          severity: "info",
          title: `Isolated topic: "${node.title}"`,
          description: `This page forms its own community with no strong connections. Consider expanding coverage of this topic or linking it to related pages.`,
          relatedNodes: [node.slug],
        });
      }
    }
  }

  return insights;
}

function findHubNodes(graph: KnowledgeGraph): Insight[] {
  const insights: Insight[] = [];
  const nodes = [...graph.nodes.values()];

  if (nodes.length < 5) return insights;

  // Compute mean and std of degree
  const degrees = nodes.map((n) => n.degree);
  const mean = degrees.reduce((a, b) => a + b, 0) / degrees.length;
  const variance =
    degrees.reduce((a, b) => a + (b - mean) ** 2, 0) / degrees.length;
  const std = Math.sqrt(variance);

  // Nodes with degree > mean + 2*std
  const threshold = mean + 2 * std;
  for (const node of nodes) {
    if (node.degree > threshold && node.degree > 5) {
      insights.push({
        type: "hub_node",
        severity: "info",
        title: `Hub node: "${node.title}" (degree: ${node.degree})`,
        description: `This page has significantly more connections than average (${mean.toFixed(1)} ± ${std.toFixed(1)}). It may be too broad and could benefit from being split into more specific pages.`,
        relatedNodes: [node.slug],
      });
    }
  }

  return insights;
}

function findLowCohesionCommunities(
  communityResult: CommunityResult,
  threshold: number
): Insight[] {
  const insights: Insight[] = [];

  for (const comm of communityResult.communities) {
    if (comm.members.length >= 3 && comm.cohesion < threshold) {
      insights.push({
        type: "low_cohesion",
        severity: "warning",
        title: `Low cohesion community #${comm.id} (${comm.cohesion.toFixed(2)})`,
        description: `Community #${comm.id} has ${comm.members.length} members but low internal density (${comm.cohesion.toFixed(2)} < ${threshold}). Members: ${comm.members.join(", ")}. These pages may not be strongly related.`,
        relatedNodes: comm.members,
      });
    }
  }

  return insights;
}
