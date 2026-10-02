import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ListRow } from "@/components/ui";
import { MetadataBar } from "@/features/editor/components/metadata-bar/metadata-bar.component";
import { CommandPalette } from "@/features/main/components/command-palette/command-palette.component";
import { HistoryDrawer } from "@/features/main/components/history-drawer/history-drawer.component";
import { ListHeader } from "@/features/main/components/list-header/list-header.component";
import { useStepFocus } from "@/features/onboarding/hooks/use-step-focus.hook";
import { useApp } from "@/stores/app";
import type { CommitInfo, DocMeta } from "@shared/types";
import { mockMarascaApi } from "../helpers/mock-marasca-api";

const commit = (sha: string, message: string): CommitInfo => ({
  sha,
  shortSha: sha.slice(0, 7),
  message,
  date: "2026-09-01T00:00:00Z",
  relative: "",
  author: "nunu",
  path: "atlas-api/a.md",
});

describe("the history drawer", () => {
  const commits = [commit("aaaaaaa1", "latest"), commit("bbbbbbb2", "older")];

  it("takes focus onto the chosen commit when opened, and the arrows move through them", async () => {
    mockMarascaApi({ "doc:history": commits, "doc:diff": "" });
    const onFocusTaken = vi.fn();
    render(
      <HistoryDrawer
        path="atlas-api/a.md"
        onClose={() => undefined}
        onRestored={() => undefined}
        takeFocus
        onFocusTaken={onFocusTaken}
      />,
    );
    const latest = await screen.findByRole("button", { name: /latest/ });
    await waitFor(() => expect(document.activeElement).toBe(latest));
    expect(onFocusTaken).toHaveBeenCalled();
    // One Tab stop: the chosen commit.
    expect(screen.getByRole("button", { name: /older/ }).tabIndex).toBe(-1);

    fireEvent.keyDown(latest, { key: "ArrowDown" });
    const older = screen.getByRole("button", { name: /older/ });
    await waitFor(() => expect(older.getAttribute("aria-current")).toBe("page"));
    expect(document.activeElement).toBe(older);
  });

  it("leaves focus alone when it only remounted for the next document", async () => {
    mockMarascaApi({ "doc:history": commits, "doc:diff": "" });
    render(
      <>
        <button type="button">list</button>
        <HistoryDrawer
          path="atlas-api/a.md"
          onClose={() => undefined}
          onRestored={() => undefined}
        />
      </>,
    );
    screen.getByRole("button", { name: "list" }).focus();
    await screen.findByRole("button", { name: /latest/ });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "list" }));
  });
});

describe("the editor's metadata", () => {
  const meta = {
    title: "",
    project: "",
    tags: ["spec"],
    source: "manual" as const,
    starred: false,
  };
  const bar = (onChange = vi.fn()) =>
    render(
      <MetadataBar
        meta={meta}
        onChange={onChange}
        projects={["Atlas API"]}
        tags={[]}
        lastProject={null}
      />,
    );

  it("focuses a field when its label is clicked", async () => {
    bar();
    await userEvent.click(screen.getByText("Project"));
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Project" }));
    await userEvent.click(screen.getByText("Tags"));
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Tags" }));
  });

  it("keeps focus in the tags field when a tag is removed", async () => {
    // The × went with its chip, and focus fell to <body>.
    bar();
    await userEvent.click(screen.getByRole("button", { name: "Remove spec" }));
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Tags" }));
  });
});

describe("what changes on screen is said", () => {
  it("names the list and its count as it changes", () => {
    const { rerender } = render(
      <ListHeader title="All documents" count={48} sort="newest" onSort={() => undefined} />,
    );
    expect(screen.getByRole("status").textContent).toBe("All documents, 48 documents");
    rerender(<ListHeader title="Starred" count={1} sort="newest" onSort={() => undefined} />);
    expect(screen.getByRole("status").textContent).toBe("Starred, 1 document");
  });
});

describe("the palette", () => {
  it("says how many results a search found", async () => {
    const doc = (path: string, title: string, source: DocMeta["source"]): DocMeta => ({
      title,
      project: "Atlas API",
      projectSlug: "atlas-api",
      tags: [],
      created: "2026-09-01T00:00:00Z",
      source,
      path,
      excerpt: "",
      words: 1,
      mtime: 0,
      size: 0,
      orphan: false,
    });
    mockMarascaApi({ "search:query": [] });
    useApp.setState({
      index: {
        docs: [doc("a", "One", "chatgpt"), doc("b", "Two", "claude")],
        projects: [],
        tags: [],
        orphans: 0,
        headSha: null,
        scannedAt: 0,
      },
    });
    render(<CommandPalette onClose={() => undefined} onOpenDoc={() => undefined} />);
    fireEvent.change(screen.getByLabelText("search"), { target: { value: "source:chatgpt" } });
    await waitFor(() =>
      expect(
        screen.getAllByRole("status").some((s) => /^1 document\b/.test(s.textContent ?? "")),
      ).toBe(true),
    );
  });
});

describe("a radio row", () => {
  it("says checked, not pressed as well", () => {
    render(
      <div role="radiogroup" aria-label="repos">
        <ListRow kind="option" role="radio" aria-checked selected>
          nunu/vault
        </ListRow>
      </div>,
    );
    expect(screen.getByRole("radio").hasAttribute("aria-pressed")).toBe(false);
  });
});

function Steps() {
  const [step, setStep] = useState("welcome");
  const host = useRef<HTMLDivElement>(null);
  useStepFocus(step, host);

  return (
    <div ref={host} key={step}>
      <h2>{step}</h2>
      <button type="button" onClick={() => setStep("signin")}>
        next
      </button>
    </div>
  );
}

describe("a setup step", () => {
  it("takes focus on its heading as it appears, instead of leaving it on <body>", async () => {
    render(<Steps />);
    await userEvent.click(screen.getByRole("button", { name: "next" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "signin" })),
    );
    expect(document.title).toBe("Set up Marasca");
  });
});
