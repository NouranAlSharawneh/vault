// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { Main } from "@/features/main/main.component";
import { useApp } from "@/stores/app";
import { initialLibrary, useLibrary } from "@/stores/library";
import type { DocMeta, SyncStatus, VaultConfig } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const doc = (path: string, title: string): DocMeta => ({
  title,
  project: "Atlas API",
  projectSlug: "atlas-api",
  tags: [],
  created: "2026-09-01T00:00:00Z",
  source: "claude",
  path,
  excerpt: "",
  words: 1,
  mtime: 0,
  size: 0,
  orphan: false,
});

const config: VaultConfig = {
  root: "/v",
  remote: null,
  branch: "main",
  lastProject: null,
  lastSource: "manual",
  hotkey: "Control+Alt+V",
  pushDebounceMs: 3000,
};

const sync: SyncStatus = {
  state: "synced",
  ahead: 0,
  behind: 0,
  branch: "main",
  lastPushAt: null,
  lastError: null,
  remote: null,
  conflicts: 0,
  failure: null,
};

beforeEach(() => {
  useLibrary.setState(initialLibrary());
  useApp.setState({
    config,
    sync,
    trash: [],
    index: {
      docs: [doc("atlas-api/a.md", "Alpha"), doc("atlas-api/b.md", "Beta")],
      projects: [],
      tags: [],
      orphans: 0,
      headSha: null,
      scannedAt: 0,
    },
  } as never);
});

describe("History from the library", () => {
  it("opens for the selected document while its text is still loading", async () => {
    // ⌘Y straight after an arrow key found no loaded document and did nothing.
    mockMarascaApi({
      "doc:read": () => new Promise(() => undefined),
      "doc:history": [],
    });
    useLibrary.setState({ selected: "atlas-api/b.md" });
    render(<Main />);
    fireEvent.keyDown(window, { key: "y", metaKey: true });
    await waitFor(() =>
      expect(screen.getByRole("complementary", { name: "Document history" })).toBeTruthy(),
    );
  });
});
