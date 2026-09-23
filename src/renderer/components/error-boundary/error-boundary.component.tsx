import { RotateCcw } from "lucide-react";
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

    return (
      // Painted, and rounded: the capture sheet is a transparent window, so an unpainted
      // panel would leave this message sitting on the desktop.
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg bg-paper p-8 text-center">
        <h1 className="text-lg font-medium text-ink">This window hit an error</h1>
        <p className="max-w-100 text-sm text-ink-3">
          Your documents are files on disk and nothing here has touched them. Reloading the window
          is safe.
        </p>
        <pre className="max-h-40 max-w-140 overflow-auto rounded-sm border border-line bg-paper-2 p-3 text-left font-mono text-2xs text-ink-2">
          {error.message || String(error)}
        </pre>
        <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
          <RotateCcw size={11} /> Reload this window
        </Button>
      </div>
    );
  }
}
