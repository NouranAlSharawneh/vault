import { describe, expect, it } from "vitest";
import { composeDoc, excerptOf, parseDoc, splitFrontmatter } from "@shared/frontmatter";

/** Vault's own layout: content first, metadata as a fenced YAML block at the end. */
const SAMPLE = `# Rate limiting at the edge

We currently rate-limit inside the application layer.

---

\`\`\`yaml
title: Rate limiting at the edge
project: Atlas API
tags: [spec, infra]
created: 2026-09-09T14:22:10Z
source: claude
\`\`\`
`;

/** Classic head frontmatter, as Obsidian/Jekyll and older Vault files write it. */
const LEGACY = `---
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
    expect(body.endsWith("layer.\n")).toBe(true);
    expect(composeDoc(frontmatter!, body, extra)).toBe(SAMPLE);
  });

  it("still reads a classic head block and moves it to the bottom on save", () => {
    const parsed = parseDoc(LEGACY);
    expect(parsed.frontmatter).toEqual(parseDoc(SAMPLE).frontmatter);
    expect(splitFrontmatter(LEGACY).position).toBe("top");
    expect(composeDoc(parsed.frontmatter!, parsed.body, parsed.extra)).toBe(SAMPLE);
  });

  it("does not mistake a yaml code block inside the body for metadata", () => {
    const body = "# Config\n\n---\n\n```yaml\nkey: value\n```\n\nMore text after it.\n";
    expect(parseDoc(body).frontmatter).toBeNull();
    const withMeta = body + "\n---\n\n```yaml\ntitle: Config\nsource: manual\n```\n";
    const parsed = parseDoc(withMeta);
    expect(parsed.frontmatter?.title).toBe("Config");
    expect(parsed.body).toBe(body);
  });

  it("writes a file with only metadata when the body is empty", () => {
    const out = composeDoc(
      { title: "T", project: "", tags: [], created: "2026-01-01T00:00:00Z", source: "manual" },
      "",
    );
    expect(out.startsWith("---\n\n```yaml\n")).toBe(true);
    expect(parseDoc(out).body).toBe("");
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
    expect(parseDoc("body\n\n---\n\n```yaml\ntitle: [unclosed\n```\n").frontmatter).toBeNull();
  });

  it("normalises tags given as a string with hashes", () => {
    expect(parseDoc('---\ntitle: t\ntags: "#a, #b"\n---\nx').frontmatter?.tags).toEqual(["a", "b"]);
  });

  it("excerpt skips the heading and code", () => {
    expect(excerptOf("# Title\n\n```js\ncode\n```\nHello **world**")).toBe("Hello world");
  });
});
