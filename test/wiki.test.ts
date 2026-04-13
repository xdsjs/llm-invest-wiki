import { describe, it, expect } from "vitest";
import {
  extractWikilinks,
  wikilinkToSlug,
  pathToSlug,
  resolveWikilink,
  findBrokenLinks,
  findOrphanPages,
  findDuplicateFilenames,
  findMissingFrontmatter,
  type WikiPage,
} from "../src/lib/wiki.js";
import { parseFrontmatter, serializeFrontmatter } from "../src/utils/frontmatter.js";
import { contentHash } from "../src/utils/hash.js";

// ─── extractWikilinks ──────────────────────────────────────────────

describe("extractWikilinks", () => {
  it("extracts basic wikilinks", () => {
    const content = "See [[machine-learning]] and [[deep-learning]].";
    expect(extractWikilinks(content)).toEqual([
      "machine-learning",
      "deep-learning",
    ]);
  });

  it("extracts aliased wikilinks", () => {
    const content = "See [[machine-learning|ML]] for details.";
    expect(extractWikilinks(content)).toEqual(["machine-learning"]);
  });

  it("deduplicates links", () => {
    const content =
      "See [[ml]] and then [[ml]] again.";
    expect(extractWikilinks(content)).toEqual(["ml"]);
  });

  it("handles nested paths", () => {
    const content = "See [[concepts/machine-learning]].";
    expect(extractWikilinks(content)).toEqual(["concepts/machine-learning"]);
  });

  it("returns empty for no links", () => {
    expect(extractWikilinks("No links here.")).toEqual([]);
  });
});

// ─── pathToSlug ────────────────────────────────────────────────────

describe("pathToSlug", () => {
  it("converts basic path", () => {
    expect(pathToSlug("concepts/machine-learning.md")).toBe(
      "concepts/machine-learning"
    );
  });

  it("normalizes spaces", () => {
    expect(pathToSlug("My Page.md")).toBe("my-page");
  });

  it("normalizes backslashes", () => {
    expect(pathToSlug("concepts\\deep-learning.md")).toBe(
      "concepts/deep-learning"
    );
  });
});

// ─── parseFrontmatter ──────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("parses standard frontmatter", () => {
    const raw = `---
title: Test Page
description: A test
tags: [ai, ml]
---
Content here.`;
    const parsed = parseFrontmatter(raw);
    expect(parsed.frontmatter.title).toBe("Test Page");
    expect(parsed.frontmatter.description).toBe("A test");
    expect(parsed.frontmatter.tags).toEqual(["ai", "ml"]);
    expect(parsed.content).toBe("Content here.");
  });

  it("handles missing frontmatter", () => {
    const raw = "Just content, no frontmatter.";
    const parsed = parseFrontmatter(raw);
    expect(parsed.frontmatter.title).toBe("");
    expect(parsed.content).toBe(raw);
  });

  it("handles empty frontmatter", () => {
    const raw = `---
title: ""
---
Content.`;
    const parsed = parseFrontmatter(raw);
    expect(parsed.frontmatter.title).toBe("");
    expect(parsed.content).toBe("Content.");
  });
});

// ─── serializeFrontmatter ──────────────────────────────────────────

describe("serializeFrontmatter", () => {
  it("round-trips frontmatter", () => {
    const fm = { title: "Test", description: "Desc", tags: ["a", "b"] };
    const content = "Body text.";
    const serialized = serializeFrontmatter(fm, content);

    const parsed = parseFrontmatter(serialized);
    expect(parsed.frontmatter.title).toBe("Test");
    expect(parsed.frontmatter.tags).toEqual(["a", "b"]);
    expect(parsed.content).toBe("Body text.");
  });
});

// ─── resolveWikilink ───────────────────────────────────────────────

describe("resolveWikilink", () => {
  const pages: WikiPage[] = [
    makePage("concepts/machine-learning", "Machine Learning"),
    makePage("concepts/deep-learning", "Deep Learning"),
    makePage("entities/geoffrey-hinton", "Geoffrey Hinton"),
  ];

  it("resolves exact slug", () => {
    const page = resolveWikilink("concepts/machine-learning", pages);
    expect(page?.slug).toBe("concepts/machine-learning");
  });

  it("resolves by basename (shortest unique)", () => {
    const page = resolveWikilink("geoffrey-hinton", pages);
    expect(page?.slug).toBe("entities/geoffrey-hinton");
  });

  it("returns undefined for missing", () => {
    expect(resolveWikilink("nonexistent", pages)).toBeUndefined();
  });
});

// ─── findBrokenLinks ───────────────────────────────────────────────

describe("findBrokenLinks", () => {
  it("finds broken links", () => {
    const pages: WikiPage[] = [
      makePage("a", "A", "See [[b]] and [[nonexistent]]."),
      makePage("b", "B", "Links to [[a]]."),
    ];
    const broken = findBrokenLinks(pages);
    expect(broken).toHaveLength(1);
    expect(broken[0].link).toBe("nonexistent");
  });
});

// ─── findOrphanPages ───────────────────────────────────────────────

describe("findOrphanPages", () => {
  it("finds orphan pages", () => {
    const pages: WikiPage[] = [
      makePage("a", "A", "Links to [[b]]."),
      makePage("b", "B", ""),
      makePage("orphan", "Orphan", "No one links here."),
    ];
    const orphans = findOrphanPages(pages);
    expect(orphans.map((p) => p.slug)).toEqual(["a", "orphan"]);
  });

  it("excludes index and log", () => {
    const pages: WikiPage[] = [
      makePage("index", "Index", ""),
      makePage("log", "Log", ""),
      makePage("orphan", "Orphan", ""),
    ];
    const orphans = findOrphanPages(pages);
    expect(orphans.map((p) => p.slug)).toEqual(["orphan"]);
  });
});

// ─── findMissingFrontmatter ────────────────────────────────────────

describe("findMissingFrontmatter", () => {
  it("detects missing fields", () => {
    const pages: WikiPage[] = [
      makePage("a", "A", "", { title: "A", description: "", tags: [] }),
    ];
    const missing = findMissingFrontmatter(pages);
    expect(missing).toHaveLength(1);
    expect(missing[0].missing).toContain("description");
  });
});

// ─── contentHash ───────────────────────────────────────────────────

describe("contentHash", () => {
  it("produces consistent hashes", () => {
    expect(contentHash("hello")).toBe(contentHash("hello"));
    expect(contentHash("hello")).not.toBe(contentHash("world"));
  });

  it("produces 16-char hex string", () => {
    const hash = contentHash("test");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

// ─── Helper ────────────────────────────────────────────────────────

function makePage(
  slug: string,
  title: string,
  content: string = "",
  fm?: Partial<import("../src/utils/frontmatter.js").Frontmatter>
): WikiPage {
  const frontmatter = {
    title,
    description: fm?.description ?? "Test description",
    tags: fm?.tags ?? ["test"],
    ...fm,
  };
  return {
    slug,
    path: `wiki/${slug}.md`,
    relativePath: `${slug}.md`,
    frontmatter,
    content,
    raw: "",
    hash: contentHash(content),
    wikilinks: extractWikilinks(content),
    mtime: Date.now(),
  };
}
