import { describe, expect, it } from "vitest";
import { classifyHref } from "@/helpers";

const DOC = "atlas-api/specs/rate-limits.md";

describe("classifyHref", () => {
  it("keeps a #fragment in the document, decoded", () => {
    expect(classifyHref("#setup", DOC)).toEqual({ kind: "anchor", id: "setup" });
    expect(classifyHref("#caf%C3%A9", DOC)).toEqual({ kind: "anchor", id: "café" });
    expect(classifyHref("#", DOC)).toEqual({ kind: "none" });
  });

  it("resolves a relative .md link against the linking doc's folder, GitHub-style", () => {
    expect(classifyHref("overview.md", DOC)).toEqual({
      kind: "doc",
      path: "atlas-api/specs/overview.md",
    });
    expect(classifyHref("../notes/a%20b.md#usage", DOC)).toEqual({
      kind: "doc",
      path: "atlas-api/notes/a b.md",
    });
    expect(classifyHref("/research-log/log.MD", DOC)).toEqual({
      kind: "doc",
      path: "research-log/log.MD",
    });
  });

  it("never resolves outside the vault", () => {
    expect(classifyHref("../../../../etc/x.md", DOC)).toEqual({ kind: "doc", path: "etc/x.md" });
  });

  it("sends web pages and mail to the system", () => {
    expect(classifyHref("https://example.com/a.md", DOC)).toEqual({
      kind: "external",
      url: "https://example.com/a.md",
    });
    expect(classifyHref("mailto:me@example.com", DOC)).toEqual({
      kind: "external",
      url: "mailto:me@example.com",
    });
  });

  it("does nothing with other files and schemes", () => {
    expect(classifyHref("assets/diagram.png", DOC)).toEqual({ kind: "none" });
    expect(classifyHref("file:///etc/passwd", DOC)).toEqual({ kind: "none" });
    expect(classifyHref("//cdn.example.com/x.md", DOC)).toEqual({ kind: "none" });
  });
});
