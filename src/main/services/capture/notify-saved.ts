import type { NotificationConstructorOptions } from "electron";
import { fire } from "../../lib/fire";

/** The bits of Electron's Notification this uses, so a test can hand in its own. */
export interface NotificationLike {
  on(event: "click" | "close", listener: () => void): unknown;
  on(event: "action", listener: (event: unknown, index: number) => void): unknown;
  show(): void;
}

export interface NotificationClass {
  new (options: NotificationConstructorOptions): NotificationLike;
  isSupported(): boolean;
}

export interface NotifySavedDeps {
  Notification: NotificationClass;
  /** Open the document in the main window. */
  open: (path: string) => void;
  /** Take the capture back: the document goes to the trash. */
  undo: (path: string) => Promise<unknown>;
}

/** Order of the notification's buttons; `action` reports the index. */
const OPEN = 0;
const UNDO = 1;

/**
 * Held until the notification is dealt with: one that is garbage-collected stops
 * delivering its clicks, and Open and Undo would do nothing.
 */
const live = new Set<NotificationLike>();

/**
 * Say a capture was saved, out of the way: the sheet is already gone, and focus is back
 * in the app the clip came from. The notification offers the two things you might want
 * next — Open it in Marasca, or Undo (which moves it to the trash). A click on the
 * notification itself opens it. False when this system can't show notifications: the
 * sheet then says so itself, as it always did.
 */
export function notifyCaptureSaved(path: string, title: string, deps: NotifySavedDeps): boolean {
  if (!deps.Notification.isSupported()) return false;
  const note = new deps.Notification({
    title: "Saved to Marasca",
    body: `${title} · ${path}`,
    silent: true,
    actions: [
      { type: "button", text: "Open" },
      { type: "button", text: "Undo" },
    ],
    closeButtonText: "Close",
  });
  live.add(note);
  const done = () => live.delete(note);

  const undo = () =>
    deps.undo(path).then(
      () => {
        const gone = new deps.Notification({
          title: "Capture undone",
          body: `${title} is in the trash.`,
          silent: true,
        });
        gone.show();
      },
      (e: unknown) => {
        const failed = new deps.Notification({
          title: "Couldn’t undo the capture",
          body: e instanceof Error ? e.message : String(e),
          silent: true,
        });
        failed.show();
      },
    );

  note.on("click", () => {
    done();
    deps.open(path);
  });
  note.on("action", (_event, index) => {
    done();
    if (index === OPEN) deps.open(path);
    else if (index === UNDO) fire(undo(), "undoing a capture");
  });
  note.on("close", done);
  note.show();

  return true;
}

/** How many notifications are still waiting for an answer (for tests). */
export function liveNotifications(): number {
  return live.size;
}
