import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount rendered trees between tests so `screen` queries never see stale DOM.
afterEach(cleanup);
