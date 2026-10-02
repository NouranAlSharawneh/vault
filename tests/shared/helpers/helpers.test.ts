import { describe, expect, it } from "vitest";
import {
  inferTitle,
  projectSlug,
  slugify,
  unslug,
  relativeTime,
  countWords,
} from "@shared/helpers";

describe("slugify", () => {
  it("slugifies like the PRD", () => {
    expect(slugify("Rate limiting at the edge")).toBe("rate-limiting-at-the-edge");
    expect(slugify("ADR 019 — drop Redis")).toBe("adr-019-drop-redis");
    expect(slugify("Atlas API")).toBe("atlas-api");
    expect(slugify("  ")).toBe("untitled");
    expect(slugify("Café déjà")).toBe("cafe-deja");
  });

  it("keeps letters of every script, so different names get different folders", () => {
    const names = ["Проект", "日本語", "שלום", "Ελληνικά", "مشروع"];
    const slugs = names.map(slugify);
    expect(new Set(slugs).size).toBe(names.length);
    expect(slugs).not.toContain("untitled");
    expect(slugify("Проект план")).toBe("проект-план");
  });

  it("writes Arabic in the composed form git records, and never halves a surrogate pair", () => {
    expect(slugify("أحمد")).toBe("أحمد".normalize("NFC"));
    // 𠮷 is one letter in two UTF-16 units; the cut is by letter.
    expect(slugify("𠮷".repeat(100))).toBe("𠮷".repeat(80));
  });
});

describe("projectSlug", () => {
  it("routes empty project to _inbox", () => {
    expect(projectSlug("")).toBe("_inbox");
    expect(projectSlug("Research log")).toBe("research-log");
  });
});

describe("inferTitle", () => {
  it("takes the top heading, else the first heading, else the first line", () => {
    expect(inferTitle("intro\n## Second\n# First")).toBe("First");
    expect(inferTitle("intro\n## Second\n### Third")).toBe("Second");
    expect(inferTitle("just a line\nmore")).toBe("just a line");
    expect(inferTitle("")).toBeNull();
  });

  it("ignores headings inside code", () => {
    // A shell comment in an answer's code block used to become its title.
    expect(inferTitle("Run this:\n\n```bash\n# install deps\nnpm i\n```\n")).toBe("Run this:");
  });

  it("reads a README's HTML title ahead of the sections under it", () => {
    expect(inferTitle('<h1 align="center">Concorde</h1>\n\n## Features\n')).toBe("Concorde");
  });

  it("keeps the numbers a title starts with, and drops list markers only", () => {
    expect(inferTitle("3D printing notes")).toBe("3D printing notes");
    expect(inferTitle("2026 roadmap")).toBe("2026 roadmap");
    expect(inferTitle("- first point")).toBe("first point");
    expect(inferTitle("1. step one")).toBe("step one");
  });

  it("reads markup as the words it shows, and cuts long prose at a word", () => {
    expect(inferTitle("# **Rate** limiting [at the edge](x)")).toBe("Rate limiting at the edge");
    const long = inferTitle(
      "This paragraph goes on for a good while without ever reaching a full stop anywhere at all really",
    );
    expect(long?.endsWith("…")).toBe(true);
    expect(long!.length).toBeLessThanOrEqual(73);
  });
});

describe("unslug / countWords / relativeTime", () => {
  it("works", () => {
    expect(unslug("research-log")).toBe("Research Log");
    expect(countWords("a b  c\n d")).toBe(4);
    const now = Date.parse("2026-09-09T12:00:00Z");
    expect(relativeTime("2026-09-09T11:58:00Z", now)).toBe("2m");
    expect(relativeTime(now, now)).toBe("just now");
  });
});
