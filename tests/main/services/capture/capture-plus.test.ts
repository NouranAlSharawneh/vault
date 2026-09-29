import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp" },
  clipboard: { read: vi.fn(async () => []) },
  nativeImage: { createFromBuffer: () => ({ getSize: () => ({ width: 1, height: 1 }) }) },
}));

import { analyseClipboard } from "@main/services/capture/analyse-clipboard";
import { clipboardImageName, imageCapture } from "@main/services/capture/clipboard-image";
import { htmlToMarkdown } from "@main/services/capture/html-to-markdown";
import { liveNotifications, notifyCaptureSaved } from "@main/services/capture/notify-saved";
import type { NotificationClass } from "@main/services/capture/notify-saved";

describe("a copied web page", () => {
  const html =
    '<meta charset="utf-8"><!--StartFragment--><h2>Setup</h2><p>Read the <a href="https://x.dev/docs">docs</a>.</p>' +
    "<ul><li>Install</li><li>Run</li></ul><table><tr><th>Region</th><th>Limit</th></tr><tr><td>eu</td><td>100</td></tr></table><!--EndFragment-->";

  it("comes back as markdown, with GitHub's tables", () => {
    const md = htmlToMarkdown(html);
    expect(md).toContain("## Setup");
    expect(md).toContain("[docs](https://x.dev/docs)");
    // One space after the marker, as the rest of the vault writes lists.
    expect(md).toMatch(/^- Install$/m);
    expect(md).toContain("| Region | Limit |");
    expect(md).not.toContain("StartFragment");
  });

  it("is offered converted when its plain text lost the structure", () => {
    const clip = analyseClipboard("Setup\nRead the docs.\nInstall\nRun", html);
    expect(clip.looksLikeMarkdown).toBe(false);
    expect(clip.converted).toContain("## Setup");
  });

  it("is not offered when the text is markdown already, or the page had no structure", () => {
    expect(analyseClipboard("# Setup\n\n- Install", html).converted).toBeUndefined();
    expect(
      analyseClipboard("Just a sentence.", "<p>Just a sentence.</p>").converted,
    ).toBeUndefined();
  });
});

describe("an image on the clipboard", () => {
  const at = new Date(2026, 8, 29, 18, 40);

  it("is named by its day and its content, so the same image is the same clip", () => {
    const a = clipboardImageName(Buffer.from("one"), "png", at);
    expect(a).toMatch(/^clipboard-2026-09-29-[0-9a-f]{6}\.png$/);
    expect(clipboardImageName(Buffer.from("one"), "png", at)).toBe(a);
    expect(clipboardImageName(Buffer.from("two"), "png", at)).not.toBe(a);
  });

  it("becomes a document linking it, resolved from the folder it was written to", () => {
    const clip = imageCapture(
      "clipboard-2026-09-29-abc123.png",
      "/tmp/marasca-clipboard",
      {
        width: 1280,
        height: 720,
        bytes: 2048,
      },
      at,
    );
    expect(clip.text).toBe("![Clipboard image 2026-09-29](clipboard-2026-09-29-abc123.png)\n");
    expect(clip.assetDir).toBe("/tmp/marasca-clipboard");
    expect(clip.detectedTitle).toBe("Clipboard image 2026-09-29");
    expect(clip.image).toEqual({ width: 1280, height: 720, bytes: 2048 });
  });
});

describe("the notification after a capture", () => {
  type Listener = (...args: unknown[]) => void;

  const shown: FakeNotification[] = [];

  class FakeNotification {
    static supported = true;

    static isSupported = () => FakeNotification.supported;

    listeners = new Map<string, Listener>();

    constructor(public options: { title?: string; actions?: { text?: string }[] }) {}

    on(event: string, listener: Listener) {
      this.listeners.set(event, listener);

      return this;
    }

    show() {
      shown.push(this);
    }

    emit(event: string, ...args: unknown[]) {
      this.listeners.get(event)?.(...args);
    }
  }

  const deps = () => ({
    Notification: FakeNotification as unknown as NotificationClass,
    open: vi.fn(),
    undo: vi.fn(async () => undefined),
  });

  it("offers Open and Undo, and Undo takes the capture back", async () => {
    shown.length = 0;
    const d = deps();
    expect(notifyCaptureSaved("atlas-api/spec.md", "Spec", d)).toBe(true);
    const note = shown[0];
    expect(note.options.actions?.map((a) => a.text)).toEqual(["Open", "Undo"]);
    note.emit("action", {}, 1);
    await vi.waitFor(() => expect(d.undo).toHaveBeenCalledWith("atlas-api/spec.md"));
    // And says it did.
    await vi.waitFor(() => expect(shown.at(-1)?.options.title).toBe("Capture undone"));
    expect(d.open).not.toHaveBeenCalled();
  });

  it("opens the document on Open, or on a click on the notification", () => {
    shown.length = 0;
    const d = deps();
    notifyCaptureSaved("a.md", "A", d);
    shown[0].emit("action", {}, 0);
    notifyCaptureSaved("b.md", "B", d);
    shown[1].emit("click");
    expect(d.open.mock.calls).toEqual([["a.md"], ["b.md"]]);
    // Held only while it can still be answered.
    expect(liveNotifications()).toBe(0);
  });

  it("says no when the system can't show one, so the sheet says it instead", () => {
    FakeNotification.supported = false;
    expect(notifyCaptureSaved("a.md", "A", deps())).toBe(false);
    FakeNotification.supported = true;
  });
});
