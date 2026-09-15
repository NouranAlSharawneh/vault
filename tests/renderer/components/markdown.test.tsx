import { render } from "@testing-library/react";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/markdown";
import { mockVaultApi } from "../helpers/mock-vault-api";

const html = (source: string, docPath = "notes/doc.md") => {
  mockVaultApi();

  return render(<Markdown source={source} docPath={docPath} />).container;
};

describe("Markdown — raw HTML", () => {
  it("renders the HTML a GitHub README leans on instead of dropping it", () => {
    const c = html(
      '<p align="center"><img width="1834" alt="banner" src="https://x.test/b.png" /></p>',
    );
    const p = c.querySelector("p");
    expect(p?.getAttribute("align")).toBe("center");
    const img = c.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://x.test/b.png");
    expect(img?.getAttribute("width")).toBe("1834");
  });

  it("keeps a row of badge images inline rather than one per line", () => {
    const c = html('<img src="https://img.shields.io/badge/a.svg" /> <img src="https://b.svg" />');
    for (const img of c.querySelectorAll("img")) {
      expect(img.className).toContain("inline-block");
    }
  });
});

describe("Markdown — sanitising", () => {
  it("drops script tags", () => {
    const c = html("# hi\n\n<script>window.pwned = 1</script>");
    expect(c.querySelector("script")).toBeNull();
    expect(c.textContent).not.toContain("pwned");
  });

  it("drops event-handler attributes", () => {
    const c = html('<img src="https://x.test/a.png" onerror="window.pwned = 1">');
    expect(c.querySelector("img")?.getAttribute("onerror")).toBeNull();
  });

  it("drops javascript: links", () => {
    const c = html('<a href="javascript:window.pwned=1">click</a>');
    expect(c.querySelector("a")?.getAttribute("href")).toBeNull();
  });

  it("drops style attributes, the same way GitHub does", () => {
    const c = html('<div style="display: flex"><span>a</span></div>');
    expect(c.querySelector("div[style]")).toBeNull();
  });
});

describe("Markdown — picture", () => {
  it("shows the light fallback and no dark-mode source, since the UI is light-only", () => {
    const c = html(
      '<picture><source media="(prefers-color-scheme: dark)" srcset="https://x.test/dark.svg"><img alt="snake" src="https://x.test/light.svg"></picture>',
    );
    expect(c.querySelector("source")).toBeNull();
    expect(c.querySelector("img")?.getAttribute("src")).toBe("https://x.test/light.svg");
  });
});

describe("Markdown — GitHub alerts", () => {
  it("renders > [!NOTE] as an alert, not a plain quote", () => {
    const c = html("> [!NOTE]\n> Reach out any time.");
    const alert = c.querySelector(".markdown-alert");
    expect(alert?.className).toContain("markdown-alert-note");
    expect(alert?.querySelector(".markdown-alert-title")).not.toBeNull();
    expect(alert?.querySelector("svg.octicon")).not.toBeNull();
    expect(alert?.textContent).toContain("Reach out any time.");
  });

  it("keeps an ordinary blockquote ordinary", () => {
    const c = html("> just a quote");
    expect(c.querySelector(".markdown-alert")).toBeNull();
    expect(c.querySelector("blockquote")?.textContent).toContain("just a quote");
  });
});

describe("Markdown — GFM still works alongside raw HTML", () => {
  it("renders tables", () => {
    const c = html("| a | b |\n|---|---|\n| 1 | 2 |");
    expect(c.querySelectorAll("td")).toHaveLength(2);
  });

  it("resolves a relative image through the vault protocol", () => {
    const c = html("![hero](assets/hero.png)");
    expect(c.querySelector("img")?.getAttribute("src")).toContain("vault://");
  });

  it("keeps the language class a fenced block needs", () => {
    const c = html("```ts\nconst a = 1;\n```");
    expect(c.querySelector("code")?.className).toContain("language-ts");
  });
});
