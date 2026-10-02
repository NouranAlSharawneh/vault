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
  it("prefers the first heading", () => {
    expect(inferTitle("intro\n## Second\n# First")).toBe("Second");
    expect(inferTitle("just a line\nmore")).toBe("just a line");
    expect(inferTitle("")).toBeNull();
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
