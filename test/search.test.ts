import { describe, it, expect } from 'vitest';
import { tokenize, bm25Search } from '../src/lib/search.js';
import type { WikiPage } from '../src/lib/wiki.js';

function makePage(slug: string, title: string, content: string, overrides: Partial<WikiPage> = {}): WikiPage {
  return {
    path: `wiki/${slug}.md`,
    relativePath: `${slug}.md`,
    slug,
    title,
    content,
    tags: [],
    sources: [],
    aliases: [],
    wikilinks: [],
    mtime: Date.now(),
    ...overrides,
  };
}

describe('tokenize', () => {
  it('should tokenize English text', () => {
    const tokens = tokenize('Hello World');
    expect(tokens).toEqual(['hello', 'world']);
  });

  it('should handle CJK bigrams', () => {
    const tokens = tokenize('分布式共识');
    expect(tokens).toContain('分');
    expect(tokens).toContain('分布');
    expect(tokens).toContain('布');
    expect(tokens).toContain('布式');
    expect(tokens).toContain('式');
    expect(tokens).toContain('式共');
    expect(tokens).toContain('共');
    expect(tokens).toContain('共识');
    expect(tokens).toContain('识');
  });

  it('should handle mixed CJK and English', () => {
    const tokens = tokenize('Raft 共识算法');
    expect(tokens).toContain('raft');
    expect(tokens).toContain('共识');
    expect(tokens).toContain('算法');
  });

  it('should handle empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('bm25Search', () => {
  const pages: WikiPage[] = [
    makePage('raft', 'Raft', 'Raft is a consensus algorithm for distributed systems.'),
    makePage('paxos', 'Paxos', 'Paxos is the original consensus algorithm by Lamport.'),
    makePage('javascript', 'JavaScript', 'JavaScript is a programming language for the web.'),
  ];

  it('should find relevant pages', () => {
    const results = bm25Search(pages, 'consensus algorithm');
    expect(results.length).toBe(2);
    expect(results.map(r => r.page.slug)).toContain('raft');
    expect(results.map(r => r.page.slug)).toContain('paxos');
  });

  it('should not match irrelevant pages', () => {
    const results = bm25Search(pages, 'consensus algorithm');
    expect(results.map(r => r.page.slug)).not.toContain('javascript');
  });

  it('should rank by relevance', () => {
    const results = bm25Search(pages, 'raft');
    expect(results[0].page.slug).toBe('raft');
  });

  it('should return empty for no matches', () => {
    const results = bm25Search(pages, 'quantum computing');
    expect(results).toEqual([]);
  });

  it('should respect limit', () => {
    const results = bm25Search(pages, 'algorithm', 1);
    expect(results.length).toBe(1);
  });

  it('should handle empty pages', () => {
    const results = bm25Search([], 'test');
    expect(results).toEqual([]);
  });

  it('should search CJK content', () => {
    const cjkPages = [
      makePage('consensus-zh', '共识算法', '共识算法是分布式系统的核心问题'),
      makePage('web-zh', 'Web开发', 'JavaScript 是 Web 开发的主要语言'),
    ];
    const results = bm25Search(cjkPages, '共识');
    expect(results.length).toBe(1);
    expect(results[0].page.slug).toBe('consensus-zh');
  });
});
