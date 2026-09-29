import { describe, expect, it } from "vitest";
import { matchesFilters, parseQuery } from "@shared/query";
import type { DocMeta } from "@shared/types";

const doc = (over: Partial<DocMeta>): DocMeta => ({
  title: "t",
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: ["spec"],
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path: "atlas-api/t.md",
  excerpt: "",
  words: 10,
  mtime: 0,
  size: 0,
  orphan: false,
  ...over,
});

describe("query", () => {
  const now = Date.parse("2026-09-09T00:00:00Z");
  it("parses operators and free text", () => {
    const q = parseQuery(
      'rate limit project:"Atlas API" tags:spec created:>30d is:starred source:claude',
      now,
    );
    expect(q.text).toBe("rate limit");
    expect(q.project).toEqual(["atlas api"]);
    expect(q.tags).toEqual(["spec"]);
    expect(q.starred).toBe(true);
    expect(q.source).toEqual(["claude"]);
    expect(q.createdAfter).toBe(now - 30 * 86_400_000);
  });
  it("filters docs", () => {
    expect(matchesFilters(doc({}), parseQuery('project:"atlas api"', now))).toBe(true);
    expect(matchesFilters(doc({}), parseQuery("project:other", now))).toBe(false);
    expect(matchesFilters(doc({ tags: [] }), parseQuery("tags:empty", now))).toBe(true);
    expect(matchesFilters(doc({}), parseQuery("tags:empty", now))).toBe(false);
    expect(matchesFilters(doc({}), parseQuery("created:>30d", now))).toBe(true);
    expect(
      matchesFilters(doc({ created: "2025-01-01T00:00:00Z" }), parseQuery("created:>30d", now)),
    ).toBe(false);
    expect(matchesFilters(doc({ unpushed: true }), parseQuery("is:unpushed", now))).toBe(true);
  });

  it("ignores a source nobody ships", () => {
    // `from:banana` used to be cast straight into the union and land as a filter that
    // nothing could match. Dropping it leaves a search that still returns documents.
    const q = parseQuery("from:banana", now);

    expect(q.source).toEqual([]);
    expect(matchesFilters(doc({}), q)).toBe(true);
  });

  it("takes a source whatever case it was typed in", () => {
    expect(parseQuery("from:Claude", now).source).toEqual(["claude"]);
  });

  it("reads a calendar date as a whole local day, and a bare one as that day", () => {
    const q = parseQuery("created:2026-01-01", now);
    expect(q.createdAfter).toBe(new Date(2026, 0, 1).getTime());
    expect(q.createdBefore).toBe(new Date(2026, 0, 2).getTime() - 1);
    // Written at 01:00 local on the first: inside, wherever the machine is.
    const early = new Date(2026, 0, 1, 1).toISOString();
    expect(matchesFilters(doc({ created: early }), q)).toBe(true);
    expect(matchesFilters(doc({ created: early }), parseQuery("created:>=2026-01-01", now))).toBe(
      true,
    );
    expect(matchesFilters(doc({ created: early }), parseQuery("created:>2026-01-01", now))).toBe(
      false,
    );
  });

  it("takes no date from a lone number", () => {
    // `created:>1` used to parse as the year 2001.
    expect(parseQuery("created:>1", now).createdAfter).toBeUndefined();
  });
});
