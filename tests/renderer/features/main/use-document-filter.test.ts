import { describe, expect, it } from "vitest";
import { applyFilter, touchedAt } from "@/features/main/hooks/use-document-filter.hook";
import type { DocMeta, IndexSnapshot } from "@shared/types";

const NOW = Date.parse("2026-09-10T12:00:00Z");
const doc = (over: Partial<DocMeta>): DocMeta => ({
  title: "t",
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: [],
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path: "atlas-api/t.md",
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
  ...over,
});
const index: IndexSnapshot = {
  docs: [
    doc({
      path: "a",
      title: "Beta",
      created: "2026-09-09T00:00:00Z",
      tags: ["spec"],
      starred: true,
    }),
    doc({ path: "b", title: "Alpha", created: "2026-08-01T00:00:00Z", tags: ["spec", "infra"] }),
    doc({
      path: "c",
      title: "Gamma",
      created: "2026-07-01T00:00:00Z",
      projectSlug: "research-log",
      project: "Research log",
    }),
  ],
  projects: [
    { name: "Atlas API", slug: "atlas-api", count: 2 },
    { name: "Research log", slug: "research-log", count: 1 },
  ],
  tags: [],
  orphans: 0,
  headSha: null,
  scannedAt: 0,
};
const base = { collection: "all" as const, project: null, tags: [], sort: "newest" as const };

describe("applyFilter", () => {
  it("newest first by default", () => {
    expect(applyFilter(index, base, [], NOW).docs.map((d) => d.path)).toEqual(["a", "b", "c"]);
  });
  it("project selection sets the title", () => {
    const r = applyFilter(index, { ...base, project: "research-log" }, [], NOW);
    expect(r.title).toBe("Research log");
    expect(r.docs.map((d) => d.path)).toEqual(["c"]);
  });
  it("recent = last 7 days; starred", () => {
    expect(
      applyFilter(index, { ...base, collection: "recent" }, [], NOW).docs.map((d) => d.path),
    ).toEqual(["a"]);
    expect(applyFilter(index, { ...base, collection: "starred" }, [], NOW).title).toBe("Starred");
  });
  it("tags are AND-ed; sort by title", () => {
    expect(
      applyFilter(index, { ...base, tags: ["spec", "infra"] }, [], NOW).docs.map((d) => d.path),
    ).toEqual(["b"]);
    expect(
      applyFilter(index, { ...base, sort: "title" }, [], NOW).docs.map((d) => d.title),
    ).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("shows the trash in its own order and ignores tags there", () => {
    const trashed = [
      {
        meta: doc({ path: ".trash/a", title: "Old" }),
        path: ".trash/a",
        originalPath: "a",
        trashedAt: "2026-01-03T00:00:00Z",
      },
      {
        meta: doc({ path: ".trash/b", title: "Older" }),
        path: ".trash/b",
        originalPath: "b",
        trashedAt: "2026-01-02T00:00:00Z",
      },
    ];
    const r = applyFilter(index, { ...base, collection: "trash", tags: ["nope"] }, trashed, NOW);
    expect(r.title).toBe("Trash");
    expect(r.docs.map((d) => d.path)).toEqual([".trash/a", ".trash/b"]);
  });
});

describe("Recent keeps its own order", () => {
  const recent: IndexSnapshot = {
    ...index,
    docs: [
      // Created a while ago but edited yesterday — this is the most recently touched.
      doc({
        path: "x",
        title: "Zulu",
        created: "2026-09-01T00:00:00Z",
        mtime: Date.parse("2026-09-09T00:00:00Z"),
      }),
      doc({
        path: "y",
        title: "Alpha",
        created: "2026-09-08T00:00:00Z",
        mtime: Date.parse("2026-09-08T00:00:00Z"),
      }),
      doc({
        path: "z",
        title: "Mike",
        created: "2020-01-01T00:00:00Z",
        mtime: Date.parse("2020-01-01T00:00:00Z"),
      }),
    ],
  };
  const filter = (sort: "newest" | "oldest" | "title") =>
    applyFilter(recent, { collection: "recent", project: null, tags: [], sort }, [], NOW).docs.map(
      (d) => d.title,
    );

  it("ignores a sort carried over from another collection", () => {
    // Sorted by title or oldest-first, Recent would be indistinguishable from All
    // documents — and the control that set it isn't even shown on this tab.
    expect(filter("newest")).toEqual(["Zulu", "Alpha"]);
    expect(filter("title")).toEqual(["Zulu", "Alpha"]);
    expect(filter("oldest")).toEqual(["Zulu", "Alpha"]);
  });

  it("ranks by last touched, not by created", () => {
    expect(filter("newest")[0]).toBe("Zulu");
  });

  it("still drops anything outside the window", () => {
    expect(filter("newest")).not.toContain("Mike");
  });

  it("keeps a doc whose `created` doesn't parse but which was edited this week", () => {
    const odd: IndexSnapshot = {
      ...index,
      docs: [doc({ path: "w", title: "Undated", created: "someday", mtime: NOW - 3_600_000 })],
    };
    const r = applyFilter(odd, { ...base, collection: "recent" }, [], NOW);
    expect(r.docs.map((d) => d.title)).toEqual(["Undated"]);
  });
});

describe("touchedAt", () => {
  it("is the later of created and mtime", () => {
    const edited = Date.parse("2026-09-09T00:00:00Z");
    expect(touchedAt(doc({ created: "2026-09-01T00:00:00Z", mtime: edited }))).toBe(edited);
    expect(touchedAt(doc({ created: "2026-09-10T00:00:00Z", mtime: edited }))).toBe(
      Date.parse("2026-09-10T00:00:00Z"),
    );
  });

  it("never comes out NaN", () => {
    expect(touchedAt(doc({ created: "", mtime: 5 }))).toBe(5);
    expect(touchedAt(doc({ created: "nope", mtime: Number.NaN }))).toBe(0);
  });
});

describe("date sorts", () => {
  // As text, "2026-09-01T23:00:00-05:00" sorts before "2026-09-02T01:00:00Z"; as an
  // instant it is two hours later. A date-only value and a bad one join in.
  const mixed: IndexSnapshot = {
    ...index,
    docs: [
      doc({ path: "utc", created: "2026-09-02T01:00:00Z" }),
      doc({ path: "offset", created: "2026-09-01T23:00:00-05:00" }),
      doc({ path: "day", created: "2026-08-30" }),
      doc({ path: "bad", created: "not a date" }),
    ],
  };
  const order = (sort: "newest" | "oldest") =>
    applyFilter(mixed, { ...base, sort }, [], NOW).docs.map((d) => d.path);

  it("orders by the instant, not the string", () => {
    expect(order("newest")).toEqual(["offset", "utc", "day", "bad"]);
    expect(order("oldest")).toEqual(["day", "utc", "offset", "bad"]);
  });
});
