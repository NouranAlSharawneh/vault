import { render, screen } from "@testing-library/react";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { FirstScan } from "@/features/onboarding/components/first-scan/first-scan.component";
import { useApp } from "@/stores/app";
import type { IndexSnapshot } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

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
    mockVaultApi({ "vault:index": snapshot(1, 1, 1) });
    render(<FirstScan onDone={noop} />);
    expect(await screen.findByText("document")).toBeTruthy();
    expect(screen.getByText("project")).toBeTruthy();
    expect(screen.getByText("tag")).toBeTruthy();
  });

  it("keeps the plural for none and for many", async () => {
    mockVaultApi({ "vault:index": snapshot(0, 3, 0) });
    render(<FirstScan onDone={noop} />);
    expect(await screen.findByText("3")).toBeTruthy();
    expect(screen.getByText("projects")).toBeTruthy();
    expect(screen.getByText("documents")).toBeTruthy();
    expect(screen.getByText("tags")).toBeTruthy();
  });
});
