// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssetPanel } from "@/components/asset-panel";
import type { AssetPlan } from "@/components/asset-panel/asset-panel.types";

const plan: AssetPlan = {
  refs: [
    {
      ref: "clipboard-2026-09-29-abc123.png",
      name: "clipboard-2026-09-29-abc123.png",
      status: "found",
      bytes: 1500,
    } as AssetPlan["refs"][number],
  ],
  baseDir: "/var/folders/xy/T/marasca-clipboard",
  detected: false,
  pending: false,
  lookingFor: 0,
  excluded: [],
  found: 1,
  missing: 0,
  stranded: 0,
  bytes: 1500,
  chooseFolder: vi.fn(async () => undefined),
  toggle: vi.fn(),
  whenSettled: async () => undefined,
  request: undefined,
};

describe("the image panel for a clipboard image", () => {
  it("says where the image is in words, not a temporary folder, and offers no folder to pick", () => {
    render(<AssetPanel plan={plan} dark baseLabel="on the clipboard" />);
    const panel = screen.getByTestId("asset-panel");
    expect(panel.textContent).toContain("1 on the clipboard");
    expect(panel.textContent).not.toContain("/var/folders");
    expect(screen.queryByRole("button", { name: /folder/i })).toBeNull();
  });

  it("names the folder, and lets it be changed, for everything else", () => {
    render(<AssetPanel plan={plan} dark />);
    expect(screen.getByTestId("asset-panel").textContent).toContain("found in");
    expect(screen.getByRole("button", { name: /Change folder/ })).toBeTruthy();
  });
});
