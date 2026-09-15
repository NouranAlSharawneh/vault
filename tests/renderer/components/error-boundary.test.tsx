// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary/error-boundary.component";

const Boom = (): never => {
  throw new Error("SYNC_PRESENTATION[state] is undefined");
};

afterEach(() => vi.restoreAllMocks());

describe("ErrorBoundary", () => {
  it("keeps the window and names the error instead of unmounting everything", () => {
    // React logs the caught error itself; the boundary adds its own line.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("This window hit an error")).toBeTruthy();
    expect(screen.getByText(/SYNC_PRESENTATION/)).toBeTruthy();
    // The sentence that matters: nothing on disk has been touched.
    expect(screen.getByText(/nothing here has touched them/)).toBeTruthy();
  });

  it("offers a reload, because quitting was the only way out before", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload, hash: "" },
      writable: true,
    });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByText(/Reload this window/));
    expect(reload).toHaveBeenCalled();
  });

  it("stays out of the way when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>the app</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("the app")).toBeTruthy();
    expect(screen.queryByText("This window hit an error")).toBeNull();
  });
});
