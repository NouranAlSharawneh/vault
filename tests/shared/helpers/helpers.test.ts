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
