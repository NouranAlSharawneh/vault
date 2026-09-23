import { getSettings } from "../../store/settings.store";
import { getMainWindow, openMainWindow } from "../../windows";
import { session } from "./session";
import type { LaunchRoute } from "./session.types";

/** Where a fresh main window starts: Main once a vault is set up and open, onboarding otherwise. */
export function launchRoute(): LaunchRoute {
  return getSettings().onboarded && session.vault ? "main" : "onboarding";
}

/**
 * Launch, a second launch, the dock icon and Window ▸ Vault all come here. An open main
 * window is only brought forward — navigating it would pull you out of Settings or
 * onboarding halfway through. A new one opens where launch would put it.
 */
export function showMainWindow(): void {
  if (getMainWindow()) openMainWindow();
  else openMainWindow(launchRoute());
}
