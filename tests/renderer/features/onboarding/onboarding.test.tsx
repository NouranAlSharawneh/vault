import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { Onboarding } from "@/features/onboarding/onboarding.component";
import { useApp } from "@/stores/app";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

beforeEach(() => {
  window.location.hash = "#onboarding";
  useApp.setState({
    auth: { status: "signed-in", user: { login: "nunu" } as never, method: "device" },
    config: null,
  });
  mockMarascaApi({
    "github:listRepos": [],
    "vault:defaultPath": (name: string) => `/Users/nunu/Documents/${name}`,
  });
});

describe("Onboarding — Back from the repo picker", () => {
  it("goes to welcome and stays there, signed in or not", async () => {
    render(<Onboarding />);
    expect(await screen.findByText("Where should the vault live?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    // Not sign-in: signed in, that step hands straight back to the repo picker.
    expect(screen.getByRole("button", { name: /Connect GitHub/ })).toBeTruthy();
    expect(screen.queryByText("Where should the vault live?")).toBeNull();
  });

  it("and forward again from welcome lands back on the repo picker", async () => {
    render(<Onboarding />);
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: /Connect GitHub/ }));
    expect(await screen.findByText("Where should the vault live?")).toBeTruthy();
  });
});
