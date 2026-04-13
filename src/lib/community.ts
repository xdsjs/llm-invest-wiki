import type { KnowledgeGraph } from "./graph.js";

export interface Community {
  id: number;
  members: string[];
  cohesion: number;
  internalEdges: number;
  totalPossibleEdges: number;
}

export interface CommunityResult {
  communities: Community[];
  assignments: Map<string, number>;
  modularity: number;
}

/**
 * Louvain community detection algorithm.
 * Finds communities that maximize modularity in a weighted graph.
 */
export function detectCommunities(graph: KnowledgeGraph): CommunityResult {
  const nodes = [...graph.nodes.keys()];
  const n = nodes.length;

  if (n === 0) {
    return { communities: [], assignments: new Map(), modularity: 0 };
  }

  // Compute total edge weight (2 * sum of all edge weights for undirected)
  let totalWeight = 0;
  for (const edge of graph.edges.values()) {
    totalWeight += edge.weight;
  }

  if (totalWeight === 0) {
    // No edges — each node is its own community
    const assignments = new Map<string, number>();
    const communities: Community[] = [];
    nodes.forEach((slug, i) => {
      assignments.set(slug, i);
      communities.push({
        id: i,
        members: [slug],
        cohesion: 0,
        internalEdges: 0,
        totalPossibleEdges: 0,
      });
    });
    return { communities, assignments, modularity: 0 };
  }

  // Build adjacency with weights
  const weightedAdj = new Map<string, Map<string, number>>();
  for (const slug of nodes) {
    weightedAdj.set(slug, new Map());
  }
  for (const edge of graph.edges.values()) {
    const w = edge.weight;
    weightedAdj.get(edge.source)!.set(edge.target, w);
    weightedAdj.get(edge.target)!.set(edge.source, w);
  }

  // Node strengths (sum of incident edge weights)
  const strength = new Map<string, number>();
  for (const slug of nodes) {
    let s = 0;
    for (const w of weightedAdj.get(slug)!.values()) {
      s += w;
    }
    strength.set(slug, s);
  }

  // Initial assignment: each node in its own community
  const community = new Map<string, number>();
  nodes.forEach((slug, i) => community.set(slug, i));

  const m2 = 2 * totalWeight; // 2m

  // Phase 1: Local moves
  let improved = true;
  let iterations = 0;
  const maxIterations = 100;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (const node of nodes) {
      const currentComm = community.get(node)!;
      const ki = strength.get(node)!;

      // Sum of weights to nodes in each neighboring community
      const commWeights = new Map<number, number>();
      const neighbors = weightedAdj.get(node)!;
      for (const [neighbor, w] of neighbors) {
        const nComm = community.get(neighbor)!;
        commWeights.set(nComm, (commWeights.get(nComm) || 0) + w);
      }

      // Sum of strengths in each community
      const commStrength = new Map<number, number>();
      for (const [slug, comm] of community) {
        commStrength.set(comm, (commStrength.get(comm) || 0) + strength.get(slug)!);
      }

      // Modularity gain for removing node from current community
      const sigmaIn = commWeights.get(currentComm) || 0;
      const sigmaTot = commStrength.get(currentComm)! - ki;

      let bestComm = currentComm;
      let bestGain = 0;

      for (const [targetComm, kiin] of commWeights) {
        if (targetComm === currentComm) continue;

        const sigmaTotTarget = commStrength.get(targetComm)!;

        // Modularity gain for moving node to target community
        const gain =
          (kiin - sigmaIn) / m2 -
          (ki * (sigmaTotTarget - sigmaTot)) / (m2 * m2) * 2;

        if (gain > bestGain) {
          bestGain = gain;
          bestComm = targetComm;
        }
      }

      if (bestComm !== currentComm) {
        community.set(node, bestComm);
        improved = true;
      }
    }
  }

  // Renumber communities to be contiguous
  const commIds = [...new Set(community.values())];
  const remap = new Map<number, number>();
  commIds.forEach((id, i) => remap.set(id, i));

  const assignments = new Map<string, number>();
  for (const [slug, comm] of community) {
    assignments.set(slug, remap.get(comm)!);
  }

  // Build community objects
  const commMembers = new Map<number, string[]>();
  for (const [slug, comm] of assignments) {
    const arr = commMembers.get(comm) || [];
    arr.push(slug);
    commMembers.set(comm, arr);
  }

  const communities: Community[] = [];
  for (const [id, members] of commMembers) {
    // Compute cohesion: density of internal edges
    let internalEdges = 0;
    let internalWeight = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const w = weightedAdj.get(members[i])?.get(members[j]);
        if (w !== undefined) {
          internalEdges++;
          internalWeight += w;
        }
      }
    }

    const totalPossible = (members.length * (members.length - 1)) / 2;
    const cohesion = totalPossible > 0 ? internalEdges / totalPossible : 0;

    communities.push({
      id,
      members,
      cohesion,
      internalEdges,
      totalPossibleEdges: totalPossible,
    });
  }

  // Compute modularity
  let modularity = 0;
  for (const edge of graph.edges.values()) {
    const ci = assignments.get(edge.source)!;
    const cj = assignments.get(edge.target)!;
    if (ci === cj) {
      const ki = strength.get(edge.source)!;
      const kj = strength.get(edge.target)!;
      modularity += edge.weight - (ki * kj) / m2;
    }
  }
  modularity /= totalWeight;

  return { communities, assignments, modularity };
}
