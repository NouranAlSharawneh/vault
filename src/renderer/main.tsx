import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/app.component";
import "./styles/global.css";

// The capture sheet is a transparent macOS window. Painting the body here — before
// React renders anything — is what stops it flashing (or sticking on) an opaque box
// while the app boots. Doing it in a mounted component is always one paint too late,
// and never happens at all if boot fails.
if (window.location.hash.startsWith("#capture")) {
  document.body.style.background = "transparent";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
