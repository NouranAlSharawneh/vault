import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirstScan } from "@/features/onboarding/components/first-scan/first-scan.component";
import { useApp } from "@/stores/app";
import type { IndexSnapshot } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const noop = () => undefined;

const snapshot = (docs: number, projects: number, tags: number) =>
  ({
    docs: Array.from({ length: docs }, (_, i) => ({ path: `d${i}.md` })),
    projects: Array.from({ length: projects }, (_, i) => ({ slug: `p${i}` })),
    tags: Array.from({ length: tags }, (_, i) => ({ tag: `t${i}` })),
    orphans: 0,
    headSha: null,
    scannedAt: 0,
  }) as unknown as IndexSnapshot;

beforeEach(() => {
  useApp.setState({ index: null, progress: { phase: "walking", done: 0, total: 0 } });
});

describe("FirstScan — counts", () => {
  it("says “1 document”, not “1 documents”", async () => {
    mockMarascaApi({ "vault:index": snapshot(1, 1, 1) });
    render(<FirstScan onDone={noop} onBack={noop} />);
    expect(await screen.findByText("document")).toBeTruthy();
    expect(screen.getByText("project")).toBeTruthy();
    expect(screen.getByText("tag")).toBeTruthy();
  });

  it("keeps the plural for none and for many", async () => {
    mockMarascaApi({ "vault:index": snapshot(0, 3, 0) });
    render(<FirstScan onDone={noop} onBack={noop} />);
    expect(await screen.findByText("3")).toBeTruthy();
    expect(screen.getByText("projects")).toBeTruthy();
    expect(screen.getByText("documents")).toBeTruthy();
    expect(screen.getByText("tags")).toBeTruthy();
  });
});

describe("FirstScan — when the folder can’t be read", () => {
  it("stops the bar and says why, instead of sitting at 10% forever", async () => {
    mockMarascaApi({ "vault:index": new Error("EACCES: permission denied, scandir '/v'") });
    render(<FirstScan onDone={noop} onBack={noop} />);
    expect(await screen.findByText("Couldn’t read the vault folder.")).toBeTruthy();
    expect(screen.getByText("EACCES: permission denied, scandir '/v'")).toBeTruthy();
    expect(screen.queryByText("documents")).toBeNull();
  });

  it("Try again reads the folder again and carries on when it works", async () => {
    let fail = true;
    const { invoke } = mockMarascaApi({
      "vault:index": () => {
        if (fail) throw new Error("ENOENT");

        return snapshot(2, 1, 1);
      },
    });
    render(<FirstScan onDone={noop} onBack={noop} />);
    await screen.findByText("Couldn’t read the vault folder.");
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("2")).toBeTruthy();
    expect(screen.queryByText("Couldn’t read the vault folder.")).toBeNull();
    expect(invoke.mock.calls.filter(([c]) => c === "vault:index")).toHaveLength(2);
  });

  it("Choose a different folder goes back to the repo step", async () => {
    mockMarascaApi({ "vault:index": new Error("ENOENT") });
    const onBack = vi.fn();
    render(<FirstScan onDone={noop} onBack={onBack} />);
    await userEvent.click(await screen.findByRole("button", { name: "Choose a different folder" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
