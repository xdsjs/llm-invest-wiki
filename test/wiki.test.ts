import { describe, it, expect } from 'vitest';
import { extractSourceRefs, extractWikilinks } from '../src/lib/wiki.js';

describe('extractWikilinks', () => {
  it('should extract simple wikilinks', () => {
    const links = extractWikilinks('See [[raft]] and [[paxos]] for details.');
    expect(links).toEqual(['raft', 'paxos']);
  });

  it('should extract wikilinks with display text', () => {
    const links = extractWikilinks('See [[raft|Raft Algorithm]] for details.');
    expect(links).toEqual(['raft']);
  });

  it('should extract wikilinks with paths', () => {
    const links = extractWikilinks('See [[papers/raft-2014|Raft Paper]].');
    expect(links).toEqual(['papers/raft-2014']);
  });

  it('should deduplicate wikilinks', () => {
    const links = extractWikilinks('[[raft]] is great. See [[raft]] again.');
    expect(links).toEqual(['raft']);
  });

  it('should handle no wikilinks', () => {
    const links = extractWikilinks('No links here.');
    expect(links).toEqual([]);
  });

  it('should handle wikilinks with spaces', () => {
    const links = extractWikilinks('See [[ distributed consensus ]].');
    expect(links).toEqual(['distributed consensus']);
  });

  it('should not extract markdown links', () => {
    const links = extractWikilinks('See [raft](https://raft.github.io).');
    expect(links).toEqual([]);
  });

  it('should exclude source refs from wiki graph links', () => {
    const links = extractWikilinks('Revenue grew.[^src-1]\n\n[^src-1]: [[sources/10-q/2026/q1.md|Q1 10-Q]]');
    expect(links).toEqual([]);
  });

  it('should extract source refs without the sources prefix', () => {
    const refs = extractSourceRefs('See [[sources/10-q/2026/q1.md|Q1 10-Q]] and [[sources/earnings.md]].');
    expect(refs).toEqual(['10-q/2026/q1.md', 'earnings.md']);
  });
});
