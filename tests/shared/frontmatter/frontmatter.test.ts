import { describe, expect, it } from "vitest";
import { composeDoc, excerptOf, parseDoc, splitFrontmatter } from "@shared/frontmatter";

const SAMPLE = `---
title: Rate limiting at the edge
project: Atlas API
tags: [spec, infra]
created: 2026-09-09T14:22:10Z
source: claude
---

# Rate limiting at the edge

We currently rate-limit inside the application layer.
`;

describe("frontmatter", () => {
  it("splits and parses the PRD sample", () => {
    const { frontmatter, body } = parseDoc(SAMPLE);
    expect(frontmatter).toEqual({
      title: "Rate limiting at the edge",
      project: "Atlas API",
      tags: ["spec", "infra"],
      created: "2026-09-09T14:22:10Z",
      source: "claude",
    });
    expect(body.trim().startsWith("# Rate limiting")).toBe(true);
  });

  it("round-trips through composeDoc byte-for-byte", () => {
    const { frontmatter, body, extra } = parseDoc(SAMPLE);
    expect(composeDoc(frontmatter!, body, extra)).toBe(SAMPLE);
  });

  it("omits starred when false, keeps unknown keys", () => {
    const out = composeDoc(
      {
        title: "A: b",
        project: "",
        tags: [],
        created: "2026-01-01T00:00:00Z",
        source: "manual",
        starred: false,
      },
      "hello",
      { author: "x" },
    );
    expect(out).not.toContain("starred");
    expect(out).toContain('title: "A: b"');
    expect(out).toContain("author: x");
    expect(parseDoc(out).frontmatter?.title).toBe("A: b");
  });

  it("treats files without frontmatter as orphans", () => {
    expect(parseDoc("# Hello\n\nbody").frontmatter).toBeNull();
    expect(splitFrontmatter("---\nno close").yaml).toBeNull();
  });

  it("survives broken YAML", () => {
    expect(parseDoc("---\ntitle: [unclosed\n---\nbody").frontmatter).toBeNull();
  });

  it("normalises tags given as a string with hashes", () => {
    expect(parseDoc('---\ntitle: t\ntags: "#a, #b"\n---\nx').frontmatter?.tags).toEqual(["a", "b"]);
  });

  it("excerpt skips the heading and code", () => {
    expect(excerptOf("# Title\n\n```js\ncode\n```\nHello **world**")).toBe("Hello world");
  });
});
