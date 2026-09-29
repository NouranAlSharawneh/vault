import { type BrowserWindow, screen } from "electron";
import { BOUNDS_SAVE_DEBOUNCE_MS } from "@shared/constants";
import { getSettings, updateSettings } from "../store/settings.store";
import type { SavedBounds } from "../store/settings.types";

type Area = { x: number; y: number; width: number; height: number };

type Minimum = { minWidth: number; minHeight: number };

/** How much of the title bar must be on a screen for a saved spot to count as visible. */
const GRAB = { width: 120, height: 40 };

function overlaps(b: Area, a: Area): boolean {
  const w = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x);
  const h = Math.min(b.y + GRAB.height, a.y + a.height) - Math.max(b.y, a.y);

  return w >= GRAB.width && h >= GRAB.height;
}

/**
 * Where a window opens, from where it was last. A spot whose title bar is no longer on
 * any screen (the external display is unplugged) keeps its size but not its place, and a
 * size bigger than the screen it lands on is cut down to fit. Null: open as new.
 */
export function fitBounds(
  saved: SavedBounds | undefined,
  areas: Area[],
  min: Minimum,
  keepPlace = true,
): Partial<Area> | null {
  if (!saved || !areas.length) return null;
  const home = (keepPlace && areas.find((a) => overlaps(saved, a))) || null;
  const room = home ?? areas[0];
  const width = Math.max(min.minWidth, Math.min(saved.width, room.width));
  const height = Math.max(min.minHeight, Math.min(saved.height, room.height));
  if (!home) return { width, height };

  return {
    width,
    height,
    x: Math.min(Math.max(saved.x, room.x), room.x + room.width - width),
    y: Math.min(Math.max(saved.y, room.y), room.y + room.height - height),
  };
}

/** The saved bounds for `key`, fitted to the screens attached now. */
export function savedBoundsFor(key: "main" | "editor", min: Minimum): Partial<Area> {
  const areas = screen.getAllDisplays().map((d) => d.workArea);
  // An editor keeps its size only: every new one on exactly the last one's spot would
  // stack them invisibly on top of each other.
  const fitted = fitBounds(getSettings().windowBounds?.[key], areas, min, key === "main");

  return fitted ?? {};
}

/** Save where `win` is whenever it settles after a move or a resize. */
export function rememberBounds(win: BrowserWindow, key: "main" | "editor"): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const saveNow = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
    const bounds = win.getNormalBounds();
    updateSettings({ windowBounds: { ...getSettings().windowBounds, [key]: bounds } });
  };
  const save = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(saveNow, BOUNDS_SAVE_DEBOUNCE_MS);
  };
  win.on("resize", save);
  win.on("move", save);
  // A move made just before closing is still waiting on the debounce.
  win.on("close", () => {
    if (timer) saveNow();
  });
}
