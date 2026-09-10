import type { ComponentType } from "react";
import type { AppRoute } from "@shared/types";
import { OnboardingRoute } from "./onboarding/onboarding.route";
import { MainRoute } from "./main/main.route";
import { EditorRoute } from "./editor/editor.route";
import { CaptureRoute } from "./capture/capture.route";

export const ROUTES: Record<AppRoute, ComponentType> = {
  onboarding: OnboardingRoute,
  main: MainRoute,
  editor: EditorRoute,
  capture: CaptureRoute,
};
