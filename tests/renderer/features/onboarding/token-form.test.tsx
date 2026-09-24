import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { NEW_REPO_PATH, TOKEN_SETTINGS_PATH } from "@/data/onboarding.data";
import { TokenForm } from "@/features/onboarding/components/token-form/token-form.component";
import { mockMarascaApi } from "../../helpers/mock-marasca-api";

describe("TokenForm — steps", () => {
  it("has the repo made before the token, since a one-repo token can’t make it", () => {
    mockMarascaApi();
    render(<TokenForm onBack={() => undefined} />);
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(
      within(steps[0]).getByRole("button", { name: `github.com/${NEW_REPO_PATH}` }),
    ).toBeTruthy();
    expect(within(steps[1]).getByText("Only select repositories")).toBeTruthy();
    expect(within(steps[2]).getByText("Contents · Read and write")).toBeTruthy();
    expect(steps[3].textContent).toMatch(/paste it below/);
  });

  it("opens github.com/new and the token page through the app, not a raw link", async () => {
    const { invoke } = mockMarascaApi();
    render(<TokenForm onBack={() => undefined} />);
    await userEvent.click(screen.getByRole("button", { name: `github.com/${NEW_REPO_PATH}` }));
    await userEvent.click(
      screen.getByRole("button", { name: `github.com/${TOKEN_SETTINGS_PATH}` }),
    );
    expect(invoke).toHaveBeenCalledWith("github:openInBrowser", NEW_REPO_PATH);
    expect(invoke).toHaveBeenCalledWith("github:openInBrowser", TOKEN_SETTINGS_PATH);
  });
});
