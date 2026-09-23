import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { REPO_LIST_LIMIT } from "@/constants";
import { RepoPicker } from "@/features/onboarding/components/repo-picker/repo-picker.component";
import { useApp } from "@/stores/app";
import { CREATE_REPO_FORBIDDEN } from "@shared/constants";
import type { AuthMethod, GitHubRepo, VaultConfig } from "@shared/types";
import { mockVaultApi } from "../../helpers/mock-vault-api";

const noop = () => undefined;

const repo = (fullName: string) =>
  ({ fullName, private: true, defaultBranch: "main" }) as unknown as GitHubRepo;

const signIn = (method: AuthMethod = "oauth") =>
  useApp.setState({
    auth: { status: "signed-in", user: { login: "nunu" } as never, method },
    config: null,
  });

const base = {
  "vault:defaultPath": (name: string) => `/Users/nunu/Documents/${name}`,
  "vault:setup": { root: "/v", remote: null, branch: "main" } as VaultConfig,
};

beforeEach(() => signIn());

describe("RepoPicker — when the repo list fails", () => {
  it("says so inside the list box, with Try again", async () => {
    mockVaultApi({ ...base, "github:listRepos": new Error("Network unreachable") });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    expect(
      await screen.findByText(/Couldn’t load your repos \(Network unreachable\)/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("Loading repos…")).toBeNull();
  });

  it("Try again asks again and shows the repos", async () => {
    let fail = true;
    mockVaultApi({
      ...base,
      "github:listRepos": () => {
        if (fail) throw new Error("Network unreachable");

        return [repo("nunu/notes")];
      },
    });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    await screen.findByText(/Couldn’t load your repos/);
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("nunu/notes")).toBeTruthy();
    expect(screen.queryByText(/Couldn’t load your repos/)).toBeNull();
  });

  it("keeps create-new usable, and a failed Continue does not wipe the list error", async () => {
    const onDone = vi.fn();
    const { invoke } = mockVaultApi({
      ...base,
      "github:listRepos": new Error("Network unreachable"),
      "github:createRepo": new Error("name already exists on this account"),
    });
    render(<RepoPicker onDone={onDone} onBack={noop} />);
    await screen.findByText(/Couldn’t load your repos/);
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(invoke).toHaveBeenCalledWith("github:createRepo", "vault", true);
    expect(await screen.findByText("name already exists on this account")).toBeTruthy();
    expect(screen.getByText(/Couldn’t load your repos/)).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("RepoPicker — signed in with a pasted token", () => {
  const forbidden = new Error(
    `Error invoking remote method 'github:createRepo': Error: ${CREATE_REPO_FORBIDDEN}`,
  );

  it("OAuth: create-new is picked and recommended", async () => {
    mockVaultApi({ ...base, "github:listRepos": [repo("nunu/notes")] });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    await screen.findByText("nunu/notes");
    expect(screen.getByText("recommended")).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: /Create a new private repo/ }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("PAT: nothing recommends create-new, and the one repo the token sees is picked", async () => {
    signIn("pat");
    mockVaultApi({ ...base, "github:listRepos": [repo("nunu/vault")] });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    await screen.findByText("nunu/vault");
    expect(screen.queryByText("recommended")).toBeNull();
    expect(screen.getByRole("radio", { name: /nunu\/vault/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(
      screen.getByRole("radio", { name: /Create a new private repo/ }).getAttribute("aria-checked"),
    ).toBe("false");
  });

  it("PAT with several repos: nothing is picked for them, so Continue waits", async () => {
    signIn("pat");
    mockVaultApi({ ...base, "github:listRepos": [repo("nunu/a"), repo("nunu/b")] });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    await screen.findByText("nunu/a");
    expect(screen.getByRole("button", { name: /Continue/ })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByText("nunu/b"));
    expect(screen.getByRole("button", { name: /Continue/ })).toHaveProperty("disabled", false);
  });

  it("a 403 from create says what to do, moves to the list and refreshes it", async () => {
    signIn("pat");
    let made = false;
    const { invoke } = mockVaultApi({
      ...base,
      "github:listRepos": () => (made ? [repo("nunu/vault")] : []),
      "github:createRepo": forbidden,
    });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    await screen.findByText("No repos match.");
    await userEvent.click(screen.getByRole("radio", { name: /Create a new private repo/ }));
    made = true; // they go and make it on GitHub while the request is out
    await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(await screen.findByText(CREATE_REPO_FORBIDDEN)).toBeTruthy();
    expect(screen.queryByText(/Resource not accessible/)).toBeNull();
    expect(await screen.findByText("nunu/vault")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /nunu\/vault/ }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(invoke.mock.calls.filter(([c]) => c === "github:listRepos")).toHaveLength(2);
  });
});

describe("RepoPicker — long lists", () => {
  const many = Array.from({ length: 120 }, (_, i) => repo(`nunu/repo-${i}`));

  it("says the list is cut short and how to find the rest", async () => {
    mockVaultApi({ ...base, "github:listRepos": many });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    expect(
      await screen.findByText(`Showing ${REPO_LIST_LIMIT} of 120 — type to filter.`),
    ).toBeTruthy();
  });

  it("counts what the filter matches, and goes quiet once it all fits", async () => {
    mockVaultApi({ ...base, "github:listRepos": many });
    render(<RepoPicker onDone={noop} onBack={noop} />);
    await screen.findByText("nunu/repo-0");
    await userEvent.type(screen.getByPlaceholderText("Filter your repos…"), "repo-1");
    // repo-1, repo-10…19, repo-100…119
    expect(screen.queryByText(/Showing \d+ of/)).toBeNull();
    await userEvent.clear(screen.getByPlaceholderText("Filter your repos…"));
    expect(screen.getByText(/Showing \d+ of 120/)).toBeTruthy();
  });
});
