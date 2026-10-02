import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IS_MAC } from "@/constants";
import { App } from "./app/app.component";
import { ErrorBoundary } from "./components/error-boundary/error-boundary.component";
import { installWindowEvents } from "./lib/window-events";
import "./styles/global.css";

// The capture sheet is a transparent macOS window. Painting the body here — before
// React renders anything — is what stops it flashing (or sticking on) an opaque box
// while the app boots. Doing it in a mounted component is always one paint too late,
// and never happens at all if boot fails.
if (window.location.hash.startsWith("#capture")) {
  document.body.style.background = "transparent";
}

// Drives `--titlebar-inset`: only macOS puts its window buttons inside our content,
// so only macOS headers reserve a gutter for them. Set before the first paint so the
// title bar never renders at the wrong inset and shifts.
document.documentElement.classList.toggle("is-mac", IS_MAC);

// A file dropped anywhere nothing takes it is not an instruction to leave the app:
// Chromium's default is to navigate the window to it. A markdown file opens in an editor
// instead; text dragged into a field is untouched. And the network coming back retries
// sync at once.
installWindowEvents();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
