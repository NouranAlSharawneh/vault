import { ArrowLeft, RotateCcw } from "lucide-react";
import { Component } from "react";
import { Button } from "@/components/ui";
import type { ErrorBoundaryProps, ErrorBoundaryState } from "./error-boundary.types";

/**
 * The last line before a blank window.
 *
 * Without one, any throw during render unmounts the whole tree: white in the main window,
 * nothing at all in the transparent capture sheet, and in the editor it takes the draft
 * with it. There is no way back but quitting, and no clue what happened. This keeps the
 * window, names the error, and offers the one action that helps.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    // The smoke run fails on console errors, so this is also how a crash reaches CI.
    console.error("render failed:", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // A crash on one route used to come straight back: reload keeps the hash. The main
    // window gets a way to its library instead of the page that broke.
    const offMain = /^#(settings|onboarding)/.test(window.location.hash);

    return (
      // Painted, and rounded: the capture sheet is a transparent window, so an unpainted
      // panel would leave this message sitting on the desktop.
      <div className="flex h-full flex-col rounded-lg bg-paper">
        {/* Something to hold: the window has no title bar of its own to drag it by. */}
        <div className="h-12 shrink-0 drag" />
        <div
          role="alert"
          className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 pt-0 text-center"
        >
          <h1 className="text-lg font-medium text-ink">This window hit an error</h1>
          <p className="max-w-100 text-sm text-ink-3">
            Your documents are files on disk and nothing here has touched them. Reloading the window
            is safe.
          </p>
          <pre className="max-h-40 max-w-140 overflow-auto rounded-sm border border-line bg-paper-2 p-3 text-left font-mono text-2xs text-ink-2 select-text">
            {error.message || String(error)}
          </pre>
          <div className="flex gap-2">
            {offMain && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.hash = "main";
                  window.location.reload();
                }}
              >
                <ArrowLeft size={11} /> Back to the vault
              </Button>
            )}
            <Button variant="primary" size="sm" autoFocus onClick={() => window.location.reload()}>
              <RotateCcw size={11} /> Reload this window
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
