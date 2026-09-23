// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/features/main/components/sidebar/sidebar.component";
import type { VaultConfig } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const config: VaultConfig = {
  root: "/vault",
  remote: "me/vault",
  branch: "main",
  lastProject: null,
  lastSource: "claude",
  hotkey: "Alt+Space",
  pushDebounceMs: 0,
};

describe("the sidebar footer", () => {
  it("has a visible way into Settings", () => {
    mockVaultApi();
    const onSettings = vi.fn();
    render(
      <Sidebar
        index={null}
        config={config}
        filter={{ collection: "all", project: null, tags: [], sort: "newest" }}
        onCollection={vi.fn()}
        onProject={vi.fn()}
        onTag={vi.fn()}
        onSettings={onSettings}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    expect(onSettings).toHaveBeenCalledOnce();
    // Trash stays in Settings; the sidebar must not grow a row for it again.
    expect(screen.queryByText("Trash")).toBeNull();
  });
});

describe("the sidebar tags", () => {
  it("count in words that agree with the number", () => {
    mockVaultApi();
    render(
      <Sidebar
        index={{
          docs: [],
          projects: [],
          tags: [
            { tag: "spec", count: 1 },
            { tag: "infra", count: 3 },
          ],
          orphans: 0,
          headSha: null,
          scannedAt: 0,
        }}
        config={config}
        filter={{ collection: "all", project: null, tags: [], sort: "newest" }}
        onCollection={vi.fn()}
        onProject={vi.fn()}
        onTag={vi.fn()}
        onSettings={vi.fn()}
      />,
    );
    expect(screen.getByText("#spec").closest("[title]")?.getAttribute("title")).toBe("1 doc");
    expect(screen.getByText("#infra").closest("[title]")?.getAttribute("title")).toBe("3 docs");
  });
});
