import type { ComponentType } from "react";
import type { AppRoute } from "@shared/types";
import { CaptureRoute } from "./capture/capture.route";
import { EditorRoute } from "./editor/editor.route";
import { MainRoute } from "./main/main.route";
import { OnboardingRoute } from "./onboarding/onboarding.route";
import { SettingsRoute } from "./settings/settings.route";

export const ROUTES: Record<AppRoute, ComponentType> = {
  onboarding: OnboardingRoute,
  main: MainRoute,
  editor: EditorRoute,
  capture: CaptureRoute,
  settings: SettingsRoute,
};
