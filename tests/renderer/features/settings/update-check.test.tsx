import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { UpdateCheck } from "@/features/settings/components/update-check/update-check.component";
import type { UpdateCheck as UpdateCheckResult } from "@shared/types";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

const checkButton = () => screen.getByRole("button", { name: /Check for updates/ });

function setup(answer: UpdateCheckResult | Error) {
  const mock = mockMarascaApi({ "app:checkForUpdates": answer, "app:openExternal": undefined });
  render(<UpdateCheck version="0.0.1" />);

  return mock;
}

describe("UpdateCheck", () => {
  it("shows this version and doesn't touch the network until asked", () => {
    const { invoke } = setup({ status: "up-to-date", current: "0.0.1", latest: "0.0.1" });
    expect(screen.getByText("You’re on version 0.0.1.")).toBeTruthy();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says so when you're up to date", async () => {
    setup({ status: "up-to-date", current: "0.0.1", latest: "0.0.1" });
    await userEvent.click(checkButton());
    expect(await screen.findByText("You’re up to date (0.0.1).")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
  });

  it("offers the download page when a newer version is out", async () => {
    const url = "https://github.com/NouranAlSharawneh/vault/releases/tag/v0.0.2";
    const { invoke } = setup({ status: "available", current: "0.0.1", latest: "0.0.2", url });
    await userEvent.click(checkButton());
    expect(await screen.findByText("Version 0.0.2 is out. You’re on 0.0.1.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Download 0\.0\.2/ }));
    expect(invoke).toHaveBeenCalledWith("app:openExternal", url);
  });

  it("explains an empty release list instead of claiming you're up to date", async () => {
    setup({ status: "none", current: "0.0.1" });
    await userEvent.click(checkButton());
    expect(await screen.findByText(/No releases published yet/)).toBeTruthy();
  });

  it("says it couldn't check when GitHub is unreachable, and can try again", async () => {
    const { invoke } = setup(new Error("offline"));
    await userEvent.click(checkButton());
    expect(await screen.findByText(/Couldn’t reach GitHub/)).toBeTruthy();
    await userEvent.click(checkButton());
    expect(invoke.mock.calls.filter((c) => c[0] === "app:checkForUpdates")).toHaveLength(2);
  });
});
