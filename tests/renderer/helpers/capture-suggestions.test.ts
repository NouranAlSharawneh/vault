import { describe, expect, it } from "vitest";
import { recentProjects, suggestTags } from "@/helpers";
import type { DocMeta, IndexSnapshot } from "@shared/types";

const tag = (name: string, count = 1) => ({ tag: name, count });

describe("suggestTags", () => {
  const tags = [
    tag("infra", 9),
    tag("rate-limiting", 2),
    tag("react", 5),
    tag("ux", 30),
    tag("spec"),
  ];

  it("offers the vault's tags the clip talks about, a heading's first", () => {
    const text = "# Rate limiting at the edge\n\nThe infra team owns the edge. React to spikes.";
    expect(suggestTags(text, tags, [])).toEqual(["rate-limiting", "infra", "react"]);
  });

  it("skips tags already chosen, tags too short to mean anything, and code", () => {
    const text = "Our ux review of the spec.\n\n```js\nimport React from 'react'\n```";
    // "ux" is two letters; "react" is only in code; "spec" is in the prose.
    expect(suggestTags(text, tags, ["spec"])).toEqual([]);
    expect(suggestTags(text, tags, [])).toEqual(["spec"]);
  });

  it("matches whole words only", () => {
    expect(suggestTags("An infrastructure note", tags, [])).toEqual([]);
  });
});

const doc = (slug: string, day: number): DocMeta => ({
  title: slug,
  project: slug,
  projectSlug: slug,
  tags: [],
  created: "2026-01-01T00:00:00Z",
  source: "claude",
  path: `${slug}/x.md`,
  excerpt: "",
  words: 1,
  mtime: Date.UTC(2026, 8, day),
  size: 0,
  orphan: false,
});

describe("recentProjects", () => {
  const index = (docs: DocMeta[]): IndexSnapshot => ({
    docs,
    projects: [
      { name: "Alpha", slug: "alpha", count: 1 },
      { name: "Beta", slug: "beta", count: 1 },
      { name: "Inbox", slug: "_inbox", count: 1 },
    ],
    tags: [],
    orphans: 0,
    headSha: null,
    scannedAt: 0,
  });

  it("puts the project written to most recently first, and leaves the inbox out", () => {
    expect(
      recentProjects(index([doc("alpha", 1), doc("beta", 5), doc("_inbox", 9)]), null),
    ).toEqual(["Beta", "Alpha"]);
  });

  it("puts the project captured into last ahead of everything", () => {
    expect(recentProjects(index([doc("alpha", 1), doc("beta", 5)]), "alpha")).toEqual([
      "Alpha",
      "Beta",
    ]);
  });
});
