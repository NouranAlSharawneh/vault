import { describe, expect, it } from "vitest";
import { analyseClipboard } from "@main/services/capture/analyse-clipboard";
import { detectSource } from "@main/services/capture/detect-source";

describe("analyseClipboard", () => {
  it("recognises markdown and pulls the title", () => {
    const r = analyseClipboard("# Rate limiting\n\nSome text\n\n- a\n- b\n");
    expect(r.looksLikeMarkdown).toBe(true);
    expect(r.detectedTitle).toBe("Rate limiting");
    expect(r.words).toBe(9); // countWords counts markdown marks too; the editor shows the same number
    expect(r.lines).toBe(7);
  });
  it("plain prose is not markdown but still has a title guess", () => {
    const r = analyseClipboard("Just a sentence someone copied.");
    expect(r.looksLikeMarkdown).toBe(false);
    expect(r.detectedTitle).toBe("Just a sentence someone copied.");
  });
});

describe("detectSource", () => {
  it("uses the HTML flavour first, then leading text", () => {
    expect(detectSource("x", '<div data-origin="https://claude.ai/chat">')).toBe("claude");
    expect(detectSource("x", '<meta content="chatgpt.com">')).toBe("chatgpt");
    expect(detectSource("x", '<article class="markdown-body">')).toBe("github");
    expect(detectSource("Claude said: hello", "")).toBe("claude");
    expect(detectSource("hello", "")).toBe("manual");
  });
});
