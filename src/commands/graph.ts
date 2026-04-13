import { loadConfig } from "../config.js";
import { loadWikiPages } from "../lib/wiki.js";
import { buildGraph, graphToJSON, findHubs, findStrongestEdges } from "../lib/graph.js";
import { detectCommunities } from "../lib/community.js";
import { generateInsights } from "../lib/insights.js";

interface GraphOptions {
  insights?: boolean;
  json?: boolean;
  communities?: boolean;
}

export async function graphCommand(options: GraphOptions): Promise<void> {
  const projectDir = process.cwd();
  const config = loadConfig(projectDir);

  const pages = loadWikiPages(projectDir);
  if (pages.length === 0) {
    console.log("No wiki pages found.");
    return;
  }

  console.log(`\nBuilding knowledge graph from ${pages.length} pages...`);

  // Build graph
  const graph = buildGraph(pages, config);

  // Community detection
  const communityResult = detectCommunities(graph);

  // Apply community assignments to nodes
  for (const [slug, commId] of communityResult.assignments) {
    const node = graph.nodes.get(slug);
    if (node) node.community = commId;
  }

  if (options.json) {
    const data = {
      ...graphToJSON(graph),
      communities: communityResult.communities,
      modularity: communityResult.modularity,
      insights: options.insights
        ? generateInsights(graph, communityResult, config)
        : [],
    };
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  // Pretty print
  console.log(`\n🕸 Knowledge Graph\n`);
  console.log("─── Overview ───");
  console.log(`  Nodes:       ${graph.nodes.size}`);
  console.log(`  Edges:       ${graph.edges.size}`);
  console.log(`  Communities: ${communityResult.communities.length}`);
  console.log(`  Modularity:  ${communityResult.modularity.toFixed(4)}`);

  // Hubs
  const hubs = findHubs(graph, 5);
  if (hubs.length > 0 && hubs[0].degree > 0) {
    console.log("\n─── Top Hubs ───");
    for (const hub of hubs) {
      if (hub.degree === 0) break;
      console.log(`  ${hub.title} — degree: ${hub.degree}, community: ${hub.community}`);
    }
  }

  // Strongest edges
  const strongEdges = findStrongestEdges(graph, 5);
  if (strongEdges.length > 0) {
    console.log("\n─── Strongest Connections ───");
    for (const edge of strongEdges) {
      const srcTitle = graph.nodes.get(edge.source)?.title || edge.source;
      const tgtTitle = graph.nodes.get(edge.target)?.title || edge.target;
      console.log(
        `  ${srcTitle} ↔ ${tgtTitle} (weight: ${edge.weight.toFixed(1)})`
      );
    }
  }

  // Communities
  if (options.communities || true) {
    console.log("\n─── Communities ───");
    const sortedComms = [...communityResult.communities].sort(
      (a, b) => b.members.length - a.members.length
    );
    for (const comm of sortedComms) {
      const cohesionIndicator =
        comm.cohesion < config.graph.community_cohesion_threshold
          ? " ⚠ low cohesion"
          : "";
      console.log(
        `  Community #${comm.id} (${comm.members.length} members, cohesion: ${comm.cohesion.toFixed(2)})${cohesionIndicator}`
      );
      for (const member of comm.members.slice(0, 10)) {
        const node = graph.nodes.get(member);
        console.log(`    - ${node?.title || member}`);
      }
      if (comm.members.length > 10) {
        console.log(`    ... and ${comm.members.length - 10} more`);
      }
    }
  }

  // Insights
  if (options.insights) {
    const insights = generateInsights(graph, communityResult, config);
    if (insights.length > 0) {
      console.log("\n─── Insights ───");
      for (const insight of insights) {
        const icon =
          insight.severity === "critical"
            ? "🔴"
            : insight.severity === "warning"
              ? "🟡"
              : "🔵";
        console.log(`  ${icon} ${insight.title}`);
        console.log(`     ${insight.description}`);
        console.log("");
      }
    } else {
      console.log("\n  No notable insights found.");
    }
  }

  console.log("");
}
