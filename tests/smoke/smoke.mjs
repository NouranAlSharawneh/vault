// Headless smoke test: boot Electron under xvfb with a throwaway HOME, walk the
// local onboarding path against a generated 800-doc vault, screenshot each step.
//   xvfb-run -a node scripts/smoke.mjs
import { _electron as electron } from "playwright";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "vault-home-"));
const root = join(home, "Documents", "vault");
const PROJECTS = ["Atlas API", "Onboarding v2", "Research log"];
for (let i = 0; i < 800; i++) {
  const project = PROJECTS[i % 3];
  const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  mkdirSync(join(root, slug), { recursive: true });
  writeFileSync(
    join(root, slug, `doc-${i}.md`),
    `# Doc ${i}\n\nBody of document ${i} about ${project}.\n\n---\n\n\`\`\`yaml\ntitle: Doc ${i}\nproject: ${project}\ntags: [spec${i % 2 ? ", infra" : ""}]\ncreated: 2026-0${1 + (i % 9)}-0${1 + (i % 9)}T10:00:00Z\nsource: claude\n\`\`\`\n`,
  );
}
// One doc embeds a repo-relative image, served back through vault://asset.
const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
mkdirSync(join(root, "research-log", "assets"), { recursive: true });
writeFileSync(join(root, "research-log", "assets", "hero.png"), Buffer.from(PNG_1x1, "base64"));
// Badges on one line must stay on one line (Tailwind's preflight makes img a block).
writeFileSync(
  join(root, "research-log", "badges.md"),
  "# Badges\n\n![a](assets/hero.png) ![b](assets/hero.png) ![c](assets/hero.png)\n\n---\n\n```yaml\ntitle: Badges\nproject: Research log\ntags: [spec]\ncreated: 2026-01-02T10:00:00Z\nsource: manual\n```\n",
);
writeFileSync(
  join(root, "research-log", "with-image.md"),
  "# With image\n\n![hero](assets/hero.png)\n\n---\n\n```yaml\ntitle: With image\nproject: Research log\ntags: [spec]\ncreated: 2026-01-01T10:00:00Z\nsource: manual\n```\n",
);
const { execSync: sh } = await import("node:child_process");
sh(
  "git init -q -b main && git add -A && git -c user.name=smoke -c user.email=smoke@test commit -qm seed",
  { cwd: root },
);
const out = process.env.SMOKE_OUT ?? "/tmp";
const app = await electron.launch({
  args: ["."],
  env: {
    ...process.env,
    HOME: home,
    NODE_ENV: "production",
    ELECTRON_DISABLE_SANDBOX: "1",
    // Fake OAuth App so the sign-in screen shows every method (no network is hit).
    VAULT_GITHUB_CLIENT_ID: "smoke-client-id",
    VAULT_GITHUB_CLIENT_SECRET: "smoke-client-secret",
  },
});
await app.firstWindow();
let win = null;
for (let i = 0; i < 40 && !win; i++) {
  win = app.windows().find((w) => /#(onboarding|main)/.test(w.url())) ?? null;
  if (!win) await new Promise((r) => setTimeout(r, 250));
}
if (!win) throw new Error("main window never appeared");
const errors = [];
win.on("console", (m) => m.type() === "error" && errors.push(m.text()));
win.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
await win.waitForSelector("text=Connect GitHub", { timeout: 15000 });
await win.screenshot({ path: join(out, "smoke-1-welcome.png") });
await win.click("text=Connect GitHub");
await win.waitForSelector("text=What GitHub will ask you to approve");
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-1b-signin.png") });
await win.click("text=Continue with GitHub");
await win.waitForSelector("text=Approve Vault on GitHub");
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-1c-webflow.png") });
await win.click("text=Use another method");
await win.click("text=Skip for now");
await win.waitForSelector("text=Where should the vault live?");
await win.screenshot({ path: join(out, "smoke-2-repo.png") });
await win.click('button:has-text("Continue")');
await win.waitForSelector("text=Vault connected", { timeout: 30000 });
await win.waitForTimeout(500);
await win.screenshot({ path: join(out, "smoke-3-done.png") });
console.log("done screen:", (await win.innerText("body")).match(/[\d,]+ documents indexed/)?.[0]);
await win.click("text=Open the vault");
await win.waitForSelector("text=All documents");
await win.waitForTimeout(500);
await win.click("text=Doc 5 >> nth=0");
await win.waitForTimeout(500);
await win.screenshot({ path: join(out, "smoke-4-main.png") });
// ---- M2: create a document through the editor window and check the commit landed
await win.click('button:has-text("New")');
let editor = null;
for (let i = 0; i < 40 && !editor; i++) {
  editor = app.windows().find((w) => /#editor/.test(w.url())) ?? null;
  if (!editor) await new Promise((r) => setTimeout(r, 250));
}
if (!editor) throw new Error("editor window never appeared");
editor.on("console", (m) => m.type() === "error" && errors.push("editor: " + m.text()));
editor.on("pageerror", (e) => errors.push("editor PAGEERROR: " + e.message));
await editor.waitForSelector(".cm-content");
await editor.click(".cm-content");
await editor.keyboard.type(
  "# Rate limiting at the edge\n\nWe currently rate-limit inside the application layer.\n\n```mermaid\nflowchart LR\n  A[Client] --> B[Edge POP]\n```\n",
);
await editor.fill('input[aria-label="project"]', "Atlas API");
await editor.keyboard.press("Escape");
await editor.fill('input[aria-label="tags"]', "spec");
await editor.keyboard.press("Enter");
await editor.waitForSelector("text=atlas-api/rate-limiting-at-the-edge.md");
await editor.waitForSelector(".mermaid-block svg", { timeout: 20000 });
await editor.waitForTimeout(300);
await editor.screenshot({ path: join(out, "smoke-5-editor.png") });
// Escape on a document with unsaved changes asks rather than throwing work away.
await editor.keyboard.press("Escape");
await editor.waitForSelector("text=Unsaved changes", { timeout: 5000 });
await editor.waitForTimeout(300);
await editor.screenshot({ path: join(out, "smoke-6-unsaved-prompt.png") });
await editor.click('button:has-text("Keep editing")');
await editor.waitForSelector("text=Unsaved changes", { state: "detached" });
await editor.click('button:has-text("Save & commit")');
await editor.waitForEvent("close", { timeout: 15000 });
await win.bringToFront();
await win.click('button:has-text("New")');
let blank = null;
for (let i = 0; i < 40 && !blank; i++) {
  blank = app.windows().find((w) => /#editor/.test(w.url())) ?? null;
  if (!blank) await new Promise((r) => setTimeout(r, 250));
}
await blank.waitForSelector(".cm-content");
await blank.keyboard.press("Escape");
await blank.waitForEvent("close", { timeout: 5000 });
if (app.windows().some((w) => /#editor/.test(w.url())))
  throw new Error("empty editor did not close on Escape");
console.log("empty editor closed on Escape");

const { execSync } = await import("node:child_process");
const log = execSync("git log --oneline -1", { cwd: root }).toString().trim();
console.log("last commit:", log);
if (!log.includes("add: Rate limiting at the edge")) throw new Error("commit not found: " + log);
const readme = (await import("node:fs")).readFileSync(join(root, "README.md"), "utf8");
if (!readme.includes("[Rate limiting at the edge](atlas-api/rate-limiting-at-the-edge.md)"))
  throw new Error("README not regenerated");
await win.bringToFront();
await win.waitForSelector("text=Rate limiting at the edge", { timeout: 10000 });
await win.click("text=Rate limiting at the edge >> nth=0");
await win.waitForTimeout(600);
await win.screenshot({ path: join(out, "smoke-7-main-after-save.png") });
// ---- M3: ⌘K palette, sidebar rail, split view
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("rate limit");
await win.waitForSelector("text=Documents", { timeout: 5000 });
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-8-palette.png") });
await win.keyboard.press("Enter");
await win.waitForSelector("text=Rate limiting at the edge");
await win.click('button[aria-label="toggle sidebar"]');
await win.click("text=Split");
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-9-rail-split.png") });
await win.click('button[aria-label="toggle sidebar"]');
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-10-hidden.png") });
await win.click('button[aria-label="toggle sidebar"]');
// ---- images referenced from a doc load through vault://asset
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("with image");
await win.waitForSelector('[role="dialog"] >> text=With image', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.click('button:has-text("Preview")');
const img = await win.waitForSelector(".prose-doc img", { timeout: 5000 });
await win.waitForFunction((el) => el.complete && el.naturalWidth > 0, img, { timeout: 5000 });
console.log("image src:", await img.getAttribute("src"));
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("badges");
await win.waitForSelector('[role="dialog"] >> text=Badges', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.waitForSelector(".prose-doc img");
const rows = await win.evaluate(() =>
  [...document.querySelectorAll(".prose-doc img")].map((el) => el.getBoundingClientRect().top),
);
if (rows.length !== 3) throw new Error("expected 3 badges, got " + rows.length);
if (new Set(rows).size !== 1)
  throw new Error("badges wrapped onto separate lines: " + rows.join(", "));
console.log("badges inline on one row:", rows.length);
// Mermaid diagrams get zoom controls, like GitHub's.
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("rate limit");
await win.waitForSelector('[role="dialog"] >> text=Rate limiting', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.waitForSelector(".mermaid-block svg", { timeout: 20000 });
const widthOf = () =>
  win.evaluate(() => document.querySelector(".mermaid-canvas svg").getBoundingClientRect().width);
const before = await widthOf();
await win.click('button[aria-label="zoom in"]');
await win.click('button[aria-label="zoom in"]');
await win.waitForSelector('button[aria-label="reset zoom"]:has-text("150%")', { timeout: 5000 });
await win.waitForTimeout(200);
const after = await widthOf();
// The label moving is not enough: the diagram itself has to grow.
if (!(after > before * 1.4)) throw new Error(`zoom did nothing: ${before} -> ${after}`);
console.log("mermaid diagram width:", Math.round(before), "->", Math.round(after));
// Zoomed past the pane, the diagram must be draggable — scrollbars alone are not enough.
for (let i = 0; i < 8; i++) await win.click('button[aria-label="zoom in"]');
const pane = await win.waitForSelector(".mermaid-block .cursor-grab", { timeout: 5000 });
const box = await pane.boundingBox();
await win.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await win.mouse.down();
await win.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 8 });
await win.mouse.up();
const scrolled = await win.evaluate(
  () => document.querySelector(".mermaid-block .overflow-auto").scrollLeft,
);
if (scrolled <= 0) throw new Error("drag did not pan the diagram, scrollLeft=" + scrolled);
console.log("mermaid pan scrollLeft:", Math.round(scrolled));
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-17-mermaid-zoom.png") });
await win.click('button[aria-label="reset zoom"]');
await win.waitForSelector('button[aria-label="reset zoom"]:has-text("100%")', { timeout: 5000 });
console.log("mermaid zoom: 150% then reset");
// ---- M4: the ⌃⌥V sheet, driven through main (xvfb has no global hotkey)
await app.evaluate(async ({ clipboard }) => {
  await clipboard.writeText(
    "# Edge POP inventory\n\nRegion, capacity and provider for each point of presence.\n\n- fra1\n- ams2\n",
  );
});
const capture = await app.evaluate(({ BrowserWindow }) => {
  const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("#capture"));
  if (!w) return false;
  w.show();
  return true;
});
if (!capture) throw new Error("capture window missing");
const sheet = app.windows().find((w) => /#capture/.test(w.url()));
sheet.on("console", (m) => m.type() === "error" && errors.push("capture: " + m.text()));
await app.evaluate(async ({ BrowserWindow, clipboard }) => {
  const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes("#capture"));
  const text = await clipboard.readText();
  w.webContents.send("capture:shown", {
    text,
    words: 12,
    lines: 6,
    looksLikeMarkdown: true,
    detectedSource: "claude",
    detectedTitle: "Edge POP inventory",
  });
});
await sheet.waitForSelector("text=Capture from clipboard");
await sheet.waitForSelector("text=Edge POP inventory");
await sheet.waitForTimeout(400);
await sheet.screenshot({ path: join(out, "smoke-11-capture.png") });
await sheet.keyboard.press("Control+Enter");
await sheet.waitForSelector("text=committed", { timeout: 15000 });
await sheet.screenshot({ path: join(out, "smoke-12-capture-saved.png") });
const log2 = execSync("git log --oneline -1", { cwd: root }).toString().trim();
console.log("capture commit:", log2);
// The sheet hands the new doc straight to the main window.
await win.waitForSelector("text=_inbox/edge-pop-inventory.md", { timeout: 10000 });
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-12b-capture-opened.png") });
if (!log2.includes("add: Edge POP inventory")) throw new Error("capture commit not found: " + log2);
// ---- M5: asset capture through the capture sheet (a source folder with the image)
const srcDir = join(home, "concorde");
mkdirSync(join(srcDir, "docs"), { recursive: true });
writeFileSync(
  join(srcDir, "docs", "hero-flyin.gif"),
  Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
);
await app.evaluate(async ({ clipboard }) => {
  await clipboard.writeText(
    "# Concorde\n\nA flight through history.\n\n![hero](docs/hero-flyin.gif)\n",
  );
});
await app.evaluate(
  async ({ BrowserWindow, clipboard }, sourcePath) => {
    const w = BrowserWindow.getAllWindows().find((x) =>
      x.webContents.getURL().includes("#capture"),
    );
    w.show();
    w.webContents.send("capture:shown", {
      text: await clipboard.readText(),
      words: 8,
      lines: 5,
      looksLikeMarkdown: true,
      detectedSource: "manual",
      detectedTitle: "Concorde",
      sourcePath,
    });
  },
  join(srcDir, "README.md"),
);
await sheet.waitForSelector('[data-testid="asset-panel"] >> text=1 image referenced');
await sheet.waitForSelector('[data-testid="asset-panel"] >> text=1 found');
await sheet.waitForTimeout(300);
await sheet.screenshot({ path: join(out, "smoke-13-capture-assets.png") });
await sheet.keyboard.press("Control+Enter");
await sheet.waitForSelector("text=committed _inbox/concorde.md", { timeout: 15000 });
const concorde = readFileSync(join(root, "_inbox", "concorde.md"), "utf8");
if (!concorde.includes("![hero](assets/hero-flyin.gif)"))
  throw new Error("asset link not rewritten:\n" + concorde);
if (!existsSync(join(root, "_inbox", "assets", "hero-flyin.gif")))
  throw new Error("asset not copied");
const assetCommit = execSync("git show --stat --format=%s HEAD", { cwd: root }).toString();
if (!assetCommit.includes("_inbox/assets/hero-flyin.gif"))
  throw new Error("asset not in commit:\n" + assetCommit);
console.log("asset commit:", assetCommit.split("\n")[0]);

// ---- M5: trash with undo, trash view, settings
await win.bringToFront();
await win.keyboard.press("Control+K");
await win.waitForSelector('input[aria-label="search"]');
await win.keyboard.type("concorde");
await win.waitForSelector('[role="dialog"] >> text=Concorde', { timeout: 5000 });
await win.waitForTimeout(200);
await win.keyboard.press("Enter");
await win.waitForSelector('[role="dialog"]', { state: "detached" });
await win.waitForSelector(".prose-doc img");
await win.click('button[aria-label="move to trash"]');
await win.waitForSelector("text=Moved “Concorde” to trash", { timeout: 10000 });
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-14-trashed.png") });
if (existsSync(join(root, "_inbox", "concorde.md")))
  throw new Error("doc still in place after trash");
await win.click('[role="status"] >> text=Undo');
await win.waitForSelector("text=Concorde >> nth=0", { timeout: 10000 });
await win.waitForTimeout(500);
if (!existsSync(join(root, "_inbox", "concorde.md")))
  throw new Error("undo did not restore the doc");
await win.keyboard.press("Control+Backspace");
await win.waitForSelector("text=Moved “Concorde” to trash", { timeout: 10000 });
await win.click('button[aria-label="dismiss"]');
// Trash has no sidebar row any more — it is reached from Settings.
await win.keyboard.press("Control+,");
await win.waitForSelector("text=Back to vault");
await win.click('button:has-text("View trash")');
await win.waitForSelector("text=Concorde >> nth=0", { timeout: 5000 });
await win.click("text=Concorde >> nth=0");
await win.waitForSelector('button:has-text("Restore")');
await win.waitForTimeout(300);
await win.screenshot({ path: join(out, "smoke-15-trash-view.png") });
await win.click('button:has-text("Delete forever")');
await win.waitForSelector("text=Deleted “Concorde” forever", { timeout: 10000 });
const purge = execSync("git log --oneline -1", { cwd: root }).toString().trim();
if (!purge.includes("purge: Concorde")) throw new Error("purge commit not found: " + purge);
await win.keyboard.press("Control+,");
await win.waitForSelector("text=Back to vault");
await win.waitForSelector('button[aria-label="capture shortcut"]');
await win.click('button[aria-label="capture shortcut"]');
await win.keyboard.press("Control+Alt+J");
await win.waitForSelector("kbd:has-text('J')", { timeout: 5000 });
await win.waitForTimeout(400);
await win.screenshot({ path: join(out, "smoke-16-settings.png") });
const cfg = JSON.parse(readFileSync(join(home, ".config", "Vault", "config.json"), "utf8"));
if (cfg.vault.hotkey !== "Control+Alt+J") throw new Error("hotkey not saved: " + cfg.vault.hotkey);
await win.click("text=Back to vault");
await win.waitForSelector("text=All documents");
console.log("errors:", errors.length ? errors : "none");
await app.close();
